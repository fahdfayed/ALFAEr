"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { requireActionAccess, NotPermittedError } from "@/lib/auth/access";
import { diff, recordAudit } from "@/lib/audit";
import { isDelayCategory, reasonsFor } from "@/lib/delays";
import { parseDateOnly, parseLocalDateTime } from "@/lib/format";
import { optString, type ActionState } from "@/lib/parse";

function minutesBetween(from: Date, to: Date) {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
}

export async function saveDelay(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let redirectTo: string | null = null;

  try {
    const access = await requireActionAccess("recordWork");
    const siteId = access.site.id;

    const category = optString(formData.get("category"));
    if (!category || !isDelayCategory(category)) {
      return { ok: false, error: "Pick a delay category." };
    }

    const reason = optString(formData.get("reason"));
    if (!reason) return { ok: false, error: "Pick a reason." };
    // Guard against a stale reason list posted from a cached page.
    if (!reasonsFor(category).includes(reason)) {
      return { ok: false, error: `"${reason}" is not a reason under that category.` };
    }

    const startedAt = parseLocalDateTime(formData.get("startedAt"));
    if (!startedAt) return { ok: false, error: "Enter when the delay started." };

    const endedAt = parseLocalDateTime(formData.get("endedAt"));
    if (endedAt && endedAt < startedAt) {
      return { ok: false, error: "The delay ended before it started." };
    }

    const workDate =
      parseDateOnly(formData.get("workDate")) ??
      new Date(`${startedAt.toISOString().slice(0, 10)}T00:00:00Z`);

    const rigId = optString(formData.get("rigId"));
    if (rigId) {
      const rig = await prisma.rig.findFirst({ where: { id: rigId, siteId } });
      if (!rig) return { ok: false, error: "That rig is not on this site." };
    }

    const pileLogId = optString(formData.get("pileLogId"));
    if (pileLogId) {
      const pile = await prisma.pile.findFirst({ where: { id: pileLogId, siteId } });
      if (!pile) return { ok: false, error: "That pile is not on this site." };
    }

    const data = {
      siteId,
      workDate,
      category,
      reason,
      rigId,
      pileLogId,
      startedAt,
      endedAt,
      minutes: endedAt ? minutesBetween(startedAt, endedAt) : null,
      notes: optString(formData.get("notes")),
      recordedBy: optString(formData.get("recordedBy")),
    };

    const id = optString(formData.get("id"));
    if (id) {
      const existing = await prisma.delay.findFirst({ where: { id, siteId } });
      if (!existing) return { ok: false, error: "That delay no longer exists." };
      await prisma.delay.update({ where: { id }, data });
      await recordAudit({
        siteId,
        actorId: access.user.id,
        actorName: access.user.name,
        action: "UPDATE",
        entity: "Delay",
        entityId: id,
        entityLabel: `${reason}`,
        changes: diff(existing as unknown as Record<string, unknown>, data),
      });
    } else {
      const created = await prisma.delay.create({ data });
      await recordAudit({
        siteId,
        actorId: access.user.id,
        actorName: access.user.name,
        action: "CREATE",
        entity: "Delay",
        entityId: created.id,
        entityLabel: `${reason}`,
        changes: diff(null, data),
      });
    }

    redirectTo = `/delays?saved=1`;
  } catch (err) {
    if (err instanceof NotPermittedError) return { ok: false, error: err.message };
    console.error("saveDelay failed", err);
    return { ok: false, error: "Could not save the delay. Please try again." };
  }

  revalidatePath("/", "layout");
  redirect(redirectTo);
}

/** Closes an open delay at the current time — the one-tap "we're moving again". */
export async function endDelay(id: string) {
  const access = await requireActionAccess("recordWork");
  const delay = await prisma.delay.findFirst({
    where: { id, siteId: access.site.id },
  });
  if (!delay || delay.endedAt) return;

  const now = new Date();
  const minutes = minutesBetween(delay.startedAt, now);
  await prisma.delay.update({
    where: { id },
    data: { endedAt: now, minutes },
  });
  await recordAudit({
    siteId: access.site.id,
    actorId: access.user.id,
    actorName: access.user.name,
    action: "UPDATE",
    entity: "Delay",
    entityId: id,
    entityLabel: delay.reason,
    changes: {
      endedAt: { from: null, to: now.toISOString() },
      minutes: { from: null, to: minutes },
    },
  });
  revalidatePath("/", "layout");
}

export async function deleteDelay(id: string) {
  const access = await requireActionAccess("recordWork");
  const delay = await prisma.delay.findFirst({
    where: { id, siteId: access.site.id },
  });
  if (!delay) return;

  await prisma.delay.delete({ where: { id } });
  await recordAudit({
    siteId: access.site.id,
    actorId: access.user.id,
    actorName: access.user.name,
    action: "DELETE",
    entity: "Delay",
    entityId: id,
    entityLabel: delay.reason,
  });
  revalidatePath("/", "layout");
}
