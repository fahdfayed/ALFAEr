import type { PileStatus } from "@prisma/client";

export const PILE_STATUSES: PileStatus[] = [
  "NOT_STARTED",
  "BORED",
  "CAST",
  "TESTED",
  "ACCEPTED",
  "REJECTED",
];

export const STATUS_LABEL: Record<PileStatus, string> = {
  NOT_STARTED: "Not started",
  BORED: "Bored",
  CAST: "Cast",
  TESTED: "Tested",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
};

/** Fill colours for the layout board. Deliberately colour-blind safe. */
export const STATUS_COLOR: Record<PileStatus, string> = {
  NOT_STARTED: "#cbd5e1",
  BORED: "#f59e0b",
  CAST: "#3b82f6",
  TESTED: "#8b5cf6",
  ACCEPTED: "#10b981",
  REJECTED: "#ef4444",
};

/** Tailwind classes for status chips in the UI. */
export const STATUS_CHIP: Record<PileStatus, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-700 ring-slate-300",
  BORED: "bg-amber-100 text-amber-800 ring-amber-300",
  CAST: "bg-blue-100 text-blue-800 ring-blue-300",
  TESTED: "bg-violet-100 text-violet-800 ring-violet-300",
  ACCEPTED: "bg-emerald-100 text-emerald-800 ring-emerald-300",
  REJECTED: "bg-red-100 text-red-800 ring-red-300",
};
