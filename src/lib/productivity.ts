import type { PileRow } from "@/lib/queries";
import type { DelayRow } from "@/lib/delayQueries";

/**
 * Rig performance derived from timestamps already on the pile log. Nothing
 * here is entered by hand — that is the point. A figure someone types is a
 * figure someone argues with; a figure computed from the shift record is not.
 */
export interface RigStats {
  rigName: string;
  piles: number;
  /** Distinct shifts this rig produced on. */
  shifts: number;
  metresDrilled: number;
  concreteM3: number;
  /** Hours the auger was actually turning. */
  boringHours: number;
  /** Hours from bore start to pour finish, summed — the real occupancy. */
  cycleHours: number;
  /** Hours lost to recorded delays attributed to this rig. */
  delayHours: number;
  /** Planned working hours: shifts worked x the contract shift length. */
  availableHours: number;
  /** Metres per hour of boring. The number estimators actually want. */
  metresPerHour: number | null;
  pilesPerDay: number | null;
  averageCycleHours: number | null;
  /** Waiting between bore finishing and concrete starting. */
  averageWaitForConcreteHours: number | null;
  /**
   * Share of the planned shift the auger was actually turning.
   *
   * Deliberately measured against boring hours rather than full pile cycles:
   * a rig bores the next pile while the last one is being concreted, so cycle
   * times overlap and summing them exceeds the shift, producing a flattering
   * figure above 90% on any busy job.
   */
  utilisationPct: number | null;
  /** Share of the planned shift lost to recorded delays. */
  delaySharePct: number | null;
}

function hoursBetween(from: Date | null, to: Date | null): number | null {
  if (!from || !to) return null;
  const h = (to.getTime() - from.getTime()) / 3600000;
  return h >= 0 ? h : null;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function round(v: number | null, dp = 1): number | null {
  if (v === null || !Number.isFinite(v)) return null;
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}

export function rigProductivity(
  pileRows: PileRow[],
  delayRows: DelayRow[],
  shiftHours = 10,
): RigStats[] {
  const byRig = new Map<string, PileRow[]>();
  for (const row of pileRows) {
    if (!row.pile.log || !row.rigName) continue;
    byRig.set(row.rigName, [...(byRig.get(row.rigName) ?? []), row]);
  }

  const delayMinutesByRig = new Map<string, number>();
  for (const d of delayRows) {
    if (!d.rigName) continue;
    delayMinutesByRig.set(d.rigName, (delayMinutesByRig.get(d.rigName) ?? 0) + d.minutes);
  }

  const stats: RigStats[] = [];

  for (const [rigName, rows] of byRig) {
    const logs = rows.map((r) => r.pile.log!);

    const boringHoursList = logs
      .map((l) => hoursBetween(l.boreStartedAt, l.boreFinishedAt))
      .filter((h): h is number => h !== null && h > 0);

    const cycleHoursList = logs
      .map((l) => hoursBetween(l.boreStartedAt, l.concreteFinishedAt))
      .filter((h): h is number => h !== null && h > 0);

    const waitList = logs
      .map((l) => hoursBetween(l.boreFinishedAt, l.concreteStartedAt))
      .filter((h): h is number => h !== null);

    // Metres per hour is computed from piles that have a usable bore window,
    // not from every pile — otherwise a missing finish time silently deflates
    // the rate for the whole rig.
    const metresWithTime = logs
      .filter((l) => hoursBetween(l.boreStartedAt, l.boreFinishedAt) !== null)
      .reduce((s, l) => s + l.toeDepthM, 0);

    const boringHours = boringHoursList.reduce((s, h) => s + h, 0);
    const cycleHours = cycleHoursList.reduce((s, h) => s + h, 0);
    const delayHours = (delayMinutesByRig.get(rigName) ?? 0) / 60;
    const shifts = new Set(logs.map((l) => l.workDate.toISOString().slice(0, 10))).size;

    stats.push({
      rigName,
      piles: rows.length,
      shifts,
      metresDrilled: round(logs.reduce((s, l) => s + l.toeDepthM, 0), 1) ?? 0,
      concreteM3: round(logs.reduce((s, l) => s + l.pouredVolumeM3, 0), 1) ?? 0,
      boringHours: round(boringHours) ?? 0,
      cycleHours: round(cycleHours) ?? 0,
      delayHours: round(delayHours) ?? 0,
      availableHours: round(shifts * shiftHours) ?? 0,
      metresPerHour: boringHours > 0 ? round(metresWithTime / boringHours, 2) : null,
      pilesPerDay: shifts > 0 ? round(rows.length / shifts, 1) : null,
      averageCycleHours: round(mean(cycleHoursList)),
      averageWaitForConcreteHours: round(mean(waitList)),
      utilisationPct:
        shifts > 0 && shiftHours > 0
          ? round((boringHours / (shifts * shiftHours)) * 100, 1)
          : null,
      delaySharePct:
        shifts > 0 && shiftHours > 0
          ? round((delayHours / (shifts * shiftHours)) * 100, 1)
          : null,
    });
  }

  return stats.sort((a, b) => b.metresDrilled - a.metresDrilled);
}

/** Productivity per soil description, for feeding future tender assumptions. */
export function drillRateByDiameter(pileRows: PileRow[]) {
  const groups = new Map<number, { metres: number; hours: number; piles: number }>();

  for (const row of pileRows) {
    const log = row.pile.log;
    if (!log) continue;
    const h = hoursBetween(log.boreStartedAt, log.boreFinishedAt);
    if (h === null || h <= 0) continue;

    const g = groups.get(log.asBuiltDiameterMm) ?? { metres: 0, hours: 0, piles: 0 };
    g.metres += log.toeDepthM;
    g.hours += h;
    g.piles += 1;
    groups.set(log.asBuiltDiameterMm, g);
  }

  return [...groups.entries()]
    .map(([diameterMm, g]) => ({
      diameterMm,
      piles: g.piles,
      metres: round(g.metres, 1) ?? 0,
      hours: round(g.hours) ?? 0,
      metresPerHour: round(g.metres / g.hours, 2) ?? 0,
    }))
    .sort((a, b) => a.diameterMm - b.diameterMm);
}
