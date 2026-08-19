import type { DelayCategory, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { delayMinutes } from "@/lib/delays";

export type DelayRecord = Prisma.DelayGetPayload<{
  include: {
    rig: { select: { name: true } };
    pileLog: { select: { id: true } };
  };
}>;

export interface DelayRow {
  delay: DelayRecord;
  minutes: number;
  open: boolean;
  rigName: string | null;
  pileRef: string | null;
}

export async function getDelayRows(
  siteId: string,
  where: Prisma.DelayWhereInput = {},
  now: Date = new Date(),
): Promise<DelayRow[]> {
  const delays = await prisma.delay.findMany({
    where: { siteId, ...where },
    include: { rig: { select: { name: true } }, pileLog: { select: { id: true } } },
    orderBy: { startedAt: "desc" },
  });

  // A delay points at a PileLog, which shares its id with the Pile, so one
  // extra lookup resolves every pile reference without a join per row.
  const pileIds = delays.map((d) => d.pileLogId).filter((id): id is string => !!id);
  const piles = pileIds.length
    ? await prisma.pile.findMany({
        where: { id: { in: pileIds } },
        select: { id: true, ref: true },
      })
    : [];
  const refById = new Map(piles.map((p) => [p.id, p.ref]));

  return delays.map((delay) => ({
    delay,
    minutes: delayMinutes(delay, now),
    open: delay.endedAt === null,
    rigName: delay.rig?.name ?? null,
    pileRef: delay.pileLogId ? (refById.get(delay.pileLogId) ?? null) : null,
  }));
}

export interface LostTimeGroup {
  key: string;
  label: string;
  minutes: number;
  count: number;
}

export function groupLostTime(
  rows: DelayRow[],
  keyOf: (row: DelayRow) => { key: string; label: string } | null,
): LostTimeGroup[] {
  const groups = new Map<string, LostTimeGroup>();
  for (const row of rows) {
    const k = keyOf(row);
    if (!k) continue;
    const g = groups.get(k.key);
    if (g) {
      g.minutes += row.minutes;
      g.count += 1;
    } else {
      groups.set(k.key, { ...k, minutes: row.minutes, count: 1 });
    }
  }
  return [...groups.values()].sort((a, b) => b.minutes - a.minutes);
}

export function totalMinutes(rows: DelayRow[]): number {
  return rows.reduce((s, r) => s + r.minutes, 0);
}

/** Minutes lost per category, used for the daily report and the dashboard. */
export function byCategory(rows: DelayRow[]): Map<DelayCategory, number> {
  const out = new Map<DelayCategory, number>();
  for (const r of rows) {
    out.set(r.delay.category, (out.get(r.delay.category) ?? 0) + r.minutes);
  }
  return out;
}
