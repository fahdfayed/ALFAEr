/**
 * Concrete volume maths for a bored pile.
 *
 * Theoretical volume is the cylinder of the nominal bore between the toe and
 * the top of the cast concrete. Anything placed beyond that is overbreak —
 * the bore has taken more concrete than its nominal shape holds, because the
 * ground has relaxed, collapsed, or been over-drilled.
 */

export type OverbreakBand = "ok" | "amber" | "red" | "under";

export interface OverbreakInput {
  diameterMm: number;
  toeDepthM: number;
  /** Depth below platform of the top of the cast concrete. */
  concreteTopDepthM: number;
  pouredVolumeM3: number;
}

export interface OverbreakResult {
  /** Length of bore actually filled with concrete, in metres. */
  concretedLengthM: number;
  theoreticalM3: number;
  pouredM3: number;
  overbreakM3: number;
  /** Overbreak as a percentage of theoretical. Negative means a shortfall. */
  overbreakPct: number;
}

export function theoreticalVolumeM3(
  diameterMm: number,
  concretedLengthM: number,
): number {
  const r = diameterMm / 1000 / 2;
  return Math.PI * r * r * Math.max(concretedLengthM, 0);
}

export function calcOverbreak(input: OverbreakInput): OverbreakResult {
  const concretedLengthM = Math.max(input.toeDepthM - input.concreteTopDepthM, 0);
  const theoreticalM3 = theoreticalVolumeM3(input.diameterMm, concretedLengthM);
  const pouredM3 = input.pouredVolumeM3;
  const overbreakM3 = pouredM3 - theoreticalM3;
  const overbreakPct = theoreticalM3 > 0 ? (overbreakM3 / theoreticalM3) * 100 : 0;

  return { concretedLengthM, theoreticalM3, pouredM3, overbreakM3, overbreakPct };
}

export function overbreakBand(
  overbreakPct: number,
  amberPct: number,
  redPct: number,
): OverbreakBand {
  // A shortfall against theoretical is its own problem — it can mean a
  // necked shaft or a mis-recorded pour — so it gets called out, not ignored.
  if (overbreakPct < 0) return "under";
  if (overbreakPct >= redPct) return "red";
  if (overbreakPct >= amberPct) return "amber";
  return "ok";
}

export const BAND_LABEL: Record<OverbreakBand, string> = {
  ok: "Within tolerance",
  amber: "Elevated",
  red: "Over threshold",
  under: "Below theoretical",
};
