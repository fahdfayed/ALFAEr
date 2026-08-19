import type { DelayCategory } from "@prisma/client";

/**
 * The pick list a foreman taps on a phone. Categories stay coarse and the
 * reasons under them are the ones that actually recur on a piling job — the
 * point is that two people recording the same stoppage pick the same row, so
 * the monthly totals mean something.
 */
export const DELAY_CATEGORIES: {
  category: DelayCategory;
  label: string;
  reasons: string[];
}[] = [
  {
    category: "EQUIPMENT",
    label: "Equipment",
    reasons: [
      "Rig breakdown",
      "Crane breakdown",
      "Generator failure",
      "Tool / auger failure",
      "Desander or pump fault",
      "Scheduled maintenance",
    ],
  },
  {
    category: "CONCRETE",
    label: "Concrete",
    reasons: [
      "Truck delayed",
      "Pump issue",
      "Concrete rejected on slump",
      "Batching plant stoppage",
      "Tremie blockage",
    ],
  },
  {
    category: "REINFORCEMENT",
    label: "Reinforcement",
    reasons: [
      "Cage not available",
      "Cage modification required",
      "Crane unavailable for lift",
      "Cage damaged",
    ],
  },
  {
    category: "SITE",
    label: "Site",
    reasons: [
      "Access blocked",
      "Setting out pending",
      "Working platform unusable",
      "Permit not issued",
      "Services / utilities clash",
      "Weather",
    ],
  },
  {
    category: "GROUND",
    label: "Ground",
    reasons: [
      "Obstruction",
      "Bore collapse",
      "Groundwater ingress",
      "Hard rock / slow drilling",
      "Loss of support fluid",
    ],
  },
  {
    category: "CLIENT",
    label: "Client / consultant",
    reasons: [
      "Inspection delay",
      "Hold instruction",
      "Design clarification awaited",
      "Change of sequence",
    ],
  },
  { category: "OTHER", label: "Other", reasons: ["Other"] },
];

export const CATEGORY_LABEL = Object.fromEntries(
  DELAY_CATEGORIES.map((c) => [c.category, c.label]),
) as Record<DelayCategory, string>;

export const CATEGORY_ORDER: DelayCategory[] = DELAY_CATEGORIES.map((c) => c.category);

/** Distinct hues per category so the lost-time chart reads at a glance. */
export const CATEGORY_COLOR: Record<DelayCategory, string> = {
  EQUIPMENT: "#ef4444",
  CONCRETE: "#3b82f6",
  REINFORCEMENT: "#8b5cf6",
  SITE: "#f59e0b",
  GROUND: "#0d9488",
  CLIENT: "#ec4899",
  OTHER: "#64748b",
};

export function reasonsFor(category: DelayCategory): string[] {
  return DELAY_CATEGORIES.find((c) => c.category === category)?.reasons ?? ["Other"];
}

export function isDelayCategory(v: string): v is DelayCategory {
  return CATEGORY_ORDER.includes(v as DelayCategory);
}

/**
 * Minutes a delay has consumed. An open delay is counted up to `now`, so an
 * ongoing stoppage shows on the dashboard while it is still happening rather
 * than only once someone remembers to close it.
 */
export function delayMinutes(
  delay: { startedAt: Date; endedAt: Date | null; minutes: number | null },
  now: Date = new Date(),
): number {
  if (delay.minutes !== null) return delay.minutes;
  const end = delay.endedAt ?? now;
  return Math.max(0, Math.round((end.getTime() - delay.startedAt.getTime()) / 60000));
}

export function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Decimal hours, for totals where "46 hrs" reads better than "46h 12m". */
export function toHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}
