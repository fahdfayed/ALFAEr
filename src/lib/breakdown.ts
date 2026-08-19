import type { PileRow, Totals } from "@/lib/queries";
import { totalise } from "@/lib/queries";

export interface BreakdownGroup extends Totals {
  key: string;
  label: string;
}

/**
 * Groups logged piles and totalises each group. Used to answer "which rig /
 * diameter / driller is where the extra concrete is going".
 */
export function breakdownBy(
  rows: PileRow[],
  keyOf: (row: PileRow) => { key: string; label: string } | null,
): BreakdownGroup[] {
  const groups = new Map<string, { label: string; rows: PileRow[] }>();

  for (const row of rows) {
    if (row.theoreticalM3 === null) continue;
    const k = keyOf(row);
    if (!k) continue;
    const existing = groups.get(k.key);
    if (existing) existing.rows.push(row);
    else groups.set(k.key, { label: k.label, rows: [row] });
  }

  return [...groups.entries()]
    .map(([key, g]) => ({ key, label: g.label, ...totalise(g.rows) }))
    .sort((a, b) => b.overbreakM3 - a.overbreakM3);
}

/** Buckets for the overbreak distribution histogram. */
export const DISTRIBUTION_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "< 0%", min: -Infinity, max: 0 },
  { label: "0–5%", min: 0, max: 5 },
  { label: "5–10%", min: 5, max: 10 },
  { label: "10–15%", min: 10, max: 15 },
  { label: "15–25%", min: 15, max: 25 },
  { label: "> 25%", min: 25, max: Infinity },
];

export function distribution(rows: PileRow[]) {
  return DISTRIBUTION_BUCKETS.map((b) => ({
    ...b,
    count: rows.filter(
      (r) => r.overbreakPct !== null && r.overbreakPct >= b.min && r.overbreakPct < b.max,
    ).length,
  }));
}
