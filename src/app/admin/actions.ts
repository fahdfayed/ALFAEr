"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/access";
import { checkPasswordStrength, hashPassword } from "@/lib/auth/password";
import { recordAudit } from "@/lib/audit";
import { optString, type ActionState } from "@/lib/parse";

const ROLES: Role[] = ["VIEWER", "FOREMAN", "ENGINEER"];

export async function createUser(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await requireAdmin();

  const email = optString(formData.get("email"))?.toLowerCase();
  const name = optString(formData.get("name"));
  const password = String(formData.get("password") ?? "");
  const isAdmin = formData.get("isAdmin") === "on";

  if (!email || !name) return { ok: false, error: "Name and email are required." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "That does not look like an email address." };
  }

  const weak = checkPasswordStrength(password);
  if (weak) return { ok: false, error: weak.message };

  if (await prisma.user.findUnique({ where: { email } })) {
    return { ok: false, error: `${email} already has an account.` };
  }

  const user = await prisma.user.create({
    data: { email, name, passwordHash: await hashPassword(password), isAdmin },
  });

  await recordAudit({
    siteId: null,
    actorId: access.user.id,
    actorName: access.user.name,
    action: "CREATE",
    entity: "User",
    entityId: user.id,
    entityLabel: `${name} <${email}>`,
    changes: { isAdmin: { from: null, to: isAdmin } },
  });

  revalidatePath("/admin/users");
  return { ok: true, saved: true };
}

export async function setUserActive(userId: string, active: boolean) {
  const access = await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  // The last active administrator cannot lock themselves out.
  if (!active && user.isAdmin) {
    const admins = await prisma.user.count({ where: { isAdmin: true, active: true } });
    if (admins <= 1) return;
  }

  await prisma.user.update({ where: { id: userId }, data: { active } });
  // Deactivating revokes live sessions immediately.
  if (!active) await prisma.session.deleteMany({ where: { userId } });

  await recordAudit({
    siteId: null,
    actorId: access.user.id,
    actorName: access.user.name,
    action: "UPDATE",
    entity: "User",
    entityId: userId,
    entityLabel: `${user.name} <${user.email}>`,
    changes: { active: { from: user.active, to: active } },
  });

  revalidatePath("/admin/users");
}

export async function setMembership(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await requireAdmin();

  const userId = optString(formData.get("userId"));
  const siteId = optString(formData.get("siteId"));
  const roleRaw = optString(formData.get("role"));

  if (!userId || !siteId) return { ok: false, error: "Pick a person and a project." };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!user || !site) return { ok: false, error: "That person or project no longer exists." };

  // An empty role removes the membership.
  if (!roleRaw) {
    const existing = await prisma.membership.findUnique({
      where: { userId_siteId: { userId, siteId } },
    });
    if (existing) {
      await prisma.membership.delete({ where: { id: existing.id } });
      await recordAudit({
        siteId,
        actorId: access.user.id,
        actorName: access.user.name,
        action: "DELETE",
        entity: "Membership",
        entityId: existing.id,
        entityLabel: `${user.name} on ${site.name}`,
        changes: { role: { from: existing.role, to: null } },
      });
    }
    revalidatePath("/admin/users");
    return { ok: true, saved: true };
  }

  if (!ROLES.includes(roleRaw as Role)) {
    return { ok: false, error: "That is not a valid role." };
  }
  const role = roleRaw as Role;

  const existing = await prisma.membership.findUnique({
    where: { userId_siteId: { userId, siteId } },
  });

  const membership = await prisma.membership.upsert({
    where: { userId_siteId: { userId, siteId } },
    create: { userId, siteId, role },
    update: { role },
  });

  await recordAudit({
    siteId,
    actorId: access.user.id,
    actorName: access.user.name,
    action: existing ? "UPDATE" : "CREATE",
    entity: "Membership",
    entityId: membership.id,
    entityLabel: `${user.name} on ${site.name}`,
    changes: { role: { from: existing?.role ?? null, to: role } },
  });

  revalidatePath("/admin/users");
  return { ok: true, saved: true };
}

export async function resetUserPassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await requireAdmin();

  const userId = optString(formData.get("userId"));
  const password = String(formData.get("password") ?? "");
  if (!userId) return { ok: false, error: "Pick a person." };

  const weak = checkPasswordStrength(password);
  if (weak) return { ok: false, error: weak.message };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "That person no longer exists." };

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password) },
  });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.loginAttempt.deleteMany({ where: { email: user.email } });

  await recordAudit({
    siteId: null,
    actorId: access.user.id,
    actorName: access.user.name,
    action: "UPDATE",
    entity: "User",
    entityId: userId,
    entityLabel: `${user.name} <${user.email}>`,
    reason: "Password reset by administrator",
  });

  revalidatePath("/admin/users");
  return { ok: true, saved: true };
}

export async function createProject(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await requireAdmin();

  const name = optString(formData.get("name"));
  if (!name) return { ok: false, error: "The project needs a name." };

  const site = await prisma.site.create({
    data: {
      name,
      clientName: optString(formData.get("clientName")),
      contractRef: optString(formData.get("contractRef")),
      location: optString(formData.get("location")),
      // The creator is made an engineer on it, so a new project is immediately
      // workable rather than needing a second setup step.
      memberships: { create: { userId: access.user.id, role: "ENGINEER" } },
    },
  });

  await recordAudit({
    siteId: site.id,
    actorId: access.user.id,
    actorName: access.user.name,
    action: "CREATE",
    entity: "Site",
    entityId: site.id,
    entityLabel: name,
  });

  revalidatePath("/", "layout");
  return { ok: true, saved: true };
}

export async function setProjectArchived(siteId: string, archived: boolean) {
  const access = await requireAdmin();
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) return;

  await prisma.site.update({ where: { id: siteId }, data: { archived } });
  await recordAudit({
    siteId,
    actorId: access.user.id,
    actorName: access.user.name,
    action: "UPDATE",
    entity: "Site",
    entityId: siteId,
    entityLabel: site.name,
    changes: { archived: { from: site.archived, to: archived } },
  });

  revalidatePath("/", "layout");
}
