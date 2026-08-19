/**
 * Chart palette. Two encodings are in play and they are deliberately
 * different jobs:
 *
 *  - Overbreak band is a STATUS (good / warning / serious / critical), so it
 *    uses the reserved status colours. Two of them sit below 3:1 on a light
 *    surface by design, which is why every band is shipped with a visible
 *    label or value, never colour alone.
 *  - Pile status is ORDINAL — not started, bored, cast, tested, accepted is a
 *    progression — so it uses a single-hue ramp stepping light to dark, with
 *    "not started" as an unfilled neutral (absence of progress) and
 *    "rejected" pulled out as a status colour because it is an exception, not
 *    a further stage. Validated with scripts/validate_palette.js --ordinal.
 */
import type { PileStatus } from "@prisma/client";
import type { OverbreakBand } from "@/lib/concrete";

export const CHROME = {
  surface: "#fcfcfb",
  primaryInk: "#0b0b0b",
  secondaryInk: "#52514e",
  muted: "#898781",
  gridline: "#e1e0d9",
  baseline: "#c3c2b7",
} as const;

export const STATUS_FILL: Record<PileStatus, string> = {
  NOT_STARTED: "#fcfcfb",
  BORED: "#86b6ef",
  CAST: "#3987e5",
  TESTED: "#256abf",
  ACCEPTED: "#104281",
  REJECTED: "#d03b3b",
};

export const STATUS_STROKE: Record<PileStatus, string> = {
  NOT_STARTED: "#c3c2b7",
  BORED: "#86b6ef",
  CAST: "#3987e5",
  TESTED: "#256abf",
  ACCEPTED: "#104281",
  REJECTED: "#d03b3b",
};

export const BAND_FILL: Record<OverbreakBand, string> = {
  ok: "#0ca30c",
  amber: "#fab219",
  under: "#ec835a",
  red: "#d03b3b",
};
