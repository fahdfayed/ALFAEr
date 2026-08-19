import type { Prisma, PileStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { calcOverbreak, overbreakBand, type OverbreakBand } from "@/lib/concrete";

export type PileWithLog = Prisma.PileGetPayload<{
  include: {
    log: {
      include: {
        rig: { select: { name: true } };
        driller: { select: { name: true } };
        loads: true;
      };
    };
  };
}>;

export interface PileRow {
  pile: PileWithLog;
  ref: string;
  status: PileStatus;
  rigName: string | null;
  drillerName: string | null;
  /** Null until the pile has an as-built record. */
  theoreticalM3: number | null;
  pouredM3: number | null;
  overbreakM3: number | null;
  overbreakPct: number | null;
  band: OverbreakBand | null;
  drilledM: number | null;
}

const INCLUDE = {
  log: {
    include: {
      rig: { select: { name: true } },
      driller: { select: { name: true } },
      loads: { orderBy: { sequence: "asc" } },
    },
  },
} satisfies Prisma.PileInclude;

export function toRow(
  pile: PileWithLog,
  thresholds: { amberPct: number; redPct: number },
): PileRow {
  const log = pile.log;
  if (!log) {
    return {
      pile,
      ref: pile.ref,
      status: pile.status,
      rigName: null,
      drillerName: null,
      theoreticalM3: null,
      pouredM3: null,
      overbreakM3: null,
      overbreakPct: null,
      band: null,
      drilledM: null,
    };
  }

  const ob = calcOverbreak({
    diameterMm: log.asBuiltDiameterMm,
    toeDepthM: log.toeDepthM,
    concreteTopDepthM: log.concreteTopDepthM,
    pouredVolumeM3: log.pouredVolumeM3,
  });

  return {
    pile,
    ref: pile.ref,
    status: pile.status,
    rigName: log.rig?.name ?? null,
    drillerName: log.driller?.name ?? null,
    theoreticalM3: ob.theoreticalM3,
    pouredM3: ob.pouredM3,
    overbreakM3: ob.overbreakM3,
    overbreakPct: ob.overbreakPct,
    band: overbreakBand(ob.overbreakPct, thresholds.amberPct, thresholds.redPct),
    drilledM: log.toeDepthM,
  };
}

export async function getPileRows(
  siteId: string,
  thresholds: { amberPct: number; redPct: number },
  where: Prisma.PileWhereInput = {},
  orderBy: Prisma.PileOrderByWithRelationInput = { ref: "asc" },
): Promise<PileRow[]> {
  const piles = await prisma.pile.findMany({
    where: { siteId, ...where },
    include: INCLUDE,
    orderBy,
  });
  return piles.map((p) => toRow(p, thresholds));
}

/** Piles whose as-built record is dated to a given shift. */
export async function getPileRowsForDate(
  siteId: string,
  thresholds: { amberPct: number; redPct: number },
  workDate: Date,
): Promise<PileRow[]> {
  return getPileRows(siteId, thresholds, { log: { is: { workDate } } });
}

export interface Totals {
  count: number;
  theoreticalM3: number;
  pouredM3: number;
  overbreakM3: number;
  /** Weighted by volume, not a mean of percentages — a mean of percentages
   *  lets a tiny pile with a huge variance dominate the project figure. */
  overbreakPct: number;
  drilledM: number;
}

export function totalise(rows: PileRow[]): Totals {
  const logged = rows.filter((r) => r.theoreticalM3 !== null);
  const theoreticalM3 = logged.reduce((s, r) => s + (r.theoreticalM3 ?? 0), 0);
  const pouredM3 = logged.reduce((s, r) => s + (r.pouredM3 ?? 0), 0);
  const drilledM = logged.reduce((s, r) => s + (r.drilledM ?? 0), 0);
  const overbreakM3 = pouredM3 - theoreticalM3;

  return {
    count: logged.length,
    theoreticalM3,
    pouredM3,
    overbreakM3,
    overbreakPct: theoreticalM3 > 0 ? (overbreakM3 / theoreticalM3) * 100 : 0,
    drilledM,
  };
}

export function countByStatus(rows: { status: PileStatus }[]) {
  const counts: Partial<Record<PileStatus, number>> = {};
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return counts;
}
