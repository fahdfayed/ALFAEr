"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { prisma } from "@/lib/db";
import { checkPasswordStrength, hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  cookieSecure,
  createSession,
  destroyCurrentSession,
  getSessionUser,
  pruneExpiredSessions,
  SITE_COOKIE,
} from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { optString, type ActionState } from "@/lib/parse";

/** Failed attempts allowed in the window before sign-in is refused. */
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;

async function tooManyAttempts(email: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const count = await prisma.loginAttempt.count({
    where: { email, createdAt: { gte: since } },
  });
  return count >= MAX_ATTEMPTS;
}

export async function signIn(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = optString(formData.get("email"))?.toLowerCase();
  const password = typeof formData.get("password") === "string"
    ? (formData.get("password") as string)
    : "";

  if (!email || !password) {
    return { ok: false, error: "Enter your email and password." };
  }

  if (await tooManyAttempts(email)) {
    return {
      ok: false,
      error: "Too many failed attempts. Wait 15 minutes and try again.",
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // The same work happens whether or not the account exists, so response time
  // does not reveal which emails are registered.
  const storedHash =
    user?.passwordHash ??
    "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(88);
  const valid = await verifyPassword(password, storedHash);

  if (!user || !valid || !user.active) {
    await prisma.loginAttempt.create({ data: { email } });
    return { ok: false, error: "That email and password do not match." };
  }

  await prisma.loginAttempt.deleteMany({ where: { email } });
  await pruneExpiredSessions();

  const hdrs = await headers();
  await createSession(user.id, hdrs.get("user-agent"));
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  redirect("/");
}

export async function signOut() {
  await destroyCurrentSession();
  redirect("/sign-in");
}

/**
 * Creates the first administrator on a fresh install. Refuses once any user
 * exists, so the route cannot be used to add a second admin.
 */
export async function bootstrapAdmin(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if ((await prisma.user.count()) > 0) {
    return { ok: false, error: "This installation already has users." };
  }

  const email = optString(formData.get("email"))?.toLowerCase();
  const name = optString(formData.get("name"));
  const password = String(formData.get("password") ?? "");

  if (!email || !name) return { ok: false, error: "Name and email are required." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "That does not look like an email address." };
  }

  const weak = checkPasswordStrength(password);
  if (weak) return { ok: false, error: weak.message };

  let userId: string;
  try {
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await hashPassword(password),
        isAdmin: true,
      },
    });
    userId = user.id;

    await recordAudit({
      siteId: null,
      actorId: user.id,
      actorName: name,
      action: "CREATE",
      entity: "User",
      entityId: user.id,
      entityLabel: `${name} <${email}>`,
      changes: { isAdmin: { from: null, to: true } },
      reason: "First administrator created during setup",
    });
  } catch (err) {
    console.error("bootstrapAdmin failed", err);
    return { ok: false, error: "Could not create the account." };
  }

  const hdrs = await headers();
  await createSession(userId, hdrs.get("user-agent"));
  redirect("/");
}

export async function changeOwnPassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { ok: false, error: "Your session has expired." };

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) return { ok: false, error: "Your account no longer exists." };

  if (!(await verifyPassword(current, user.passwordHash))) {
    return { ok: false, error: "Your current password is not correct." };
  }
  if (next !== confirm) return { ok: false, error: "The new passwords do not match." };

  const weak = checkPasswordStrength(next);
  if (weak) return { ok: false, error: weak.message };

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next) },
  });

  // Every other browser is signed out, so a changed password actually revokes
  // access rather than only affecting future sign-ins.
  await prisma.session.deleteMany({ where: { userId: user.id } });

  await recordAudit({
    siteId: null,
    actorId: user.id,
    actorName: user.name,
    action: "UPDATE",
    entity: "User",
    entityId: user.id,
    entityLabel: `${user.name} <${user.email}>`,
    reason: "Password changed",
  });

  const hdrs = await headers();
  await createSession(user.id, hdrs.get("user-agent"));

  revalidatePath("/account");
  return { ok: true, saved: true };
}

/** Switches the active project, validating the user actually has access. */
export async function selectSite(siteId: string) {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  const allowed = user.isAdmin
    ? await prisma.site.findUnique({ where: { id: siteId } })
    : await prisma.membership.findUnique({
        where: { userId_siteId: { userId: user.id, siteId } },
      });

  if (!allowed) return;

  const { cookies } = await import("next/headers");
  const jar = await cookies();
  jar.set(SITE_COOKIE, siteId, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
}
