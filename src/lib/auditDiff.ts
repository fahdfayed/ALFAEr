/**
 * Pure audit helpers: computing what changed and rendering it. Kept out of
 * audit.ts so they can be unit tested without pulling in the database.
 */

export interface FieldChange {
  from: unknown;
  to: unknown;
}

export type ChangeSet = Record<string, FieldChange>;

/** Fields that carry no meaning in an audit trail. */
const IGNORED = new Set(["id", "createdAt", "updatedAt", "siteId"]);

function normalise(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined) return null;
  return value;
}

function sameValue(a: unknown, b: unknown): boolean {
  const na = normalise(a);
  const nb = normalise(b);
  if (typeof na === "number" && typeof nb === "number") {
    // Floats round-trip through Postgres with tiny error; a pile depth that
    // reads identically to the user should not appear as a change.
    return Math.abs(na - nb) < 1e-9;
  }
  return na === nb;
}

/**
 * Field-level diff between what was stored and what is being written. Only
 * keys present in `next` are compared, so a partial update does not report
 * every untouched column as cleared.
 */
export function diff(
  previous: Record<string, unknown> | null,
  next: Record<string, unknown>,
): ChangeSet {
  const changes: ChangeSet = {};

  for (const [key, value] of Object.entries(next)) {
    if (IGNORED.has(key)) continue;
    const before = previous ? previous[key] : undefined;
    if (previous && sameValue(before, value)) continue;
    if (!previous && (value === null || value === undefined)) continue;
    changes[key] = { from: normalise(before), to: normalise(value) };
  }

  return changes;
}


/** Human-readable field names for the audit view. */
export const FIELD_LABEL: Record<string, string> = {
  workDate: "Work date",
  rigId: "Rig",
  drillerId: "Driller",
  boreStartedAt: "Bore started",
  boreFinishedAt: "Bore finished",
  asBuiltDiameterMm: "As-built diameter (mm)",
  toeDepthM: "Toe depth (m)",
  platformLevelM: "Platform level",
  cutoffLevelM: "Cut-off level",
  waterStrikeDepthM: "Water strike (m)",
  verticalityPct: "Verticality (%)",
  casingDepthM: "Casing depth (m)",
  casingDiameterMm: "Casing diameter (mm)",
  casingType: "Casing type",
  cageMark: "Cage mark",
  cageLengthM: "Cage length (m)",
  cageDiameterMm: "Cage diameter (mm)",
  cageMainBars: "Main bars",
  cageLinks: "Links",
  cageTopDepthM: "Top of cage (m)",
  cageInstalledAt: "Cage installed",
  concreteStartedAt: "Pour started",
  concreteFinishedAt: "Pour finished",
  concreteGrade: "Concrete grade",
  concreteMixRef: "Mix reference",
  slumpMm: "Slump (mm)",
  cubesTaken: "Cubes taken",
  concreteTopDepthM: "Top of concrete (m)",
  pouredVolumeM3: "Concrete poured (m³)",
  strata: "Strata",
  weather: "Weather",
  remarks: "Remarks",
  status: "Status",
  category: "Delay category",
  reason: "Delay reason",
  startedAt: "Started",
  endedAt: "Ended",
  minutes: "Duration (minutes)",
  notes: "Notes",
  loads: "Load tickets",
  name: "Name",
  clientName: "Client",
  contractRef: "Contract reference",
  location: "Location",
  shiftHours: "Shift hours",
  overbreakAmberPct: "Amber overbreak threshold (%)",
  overbreakRedPct: "Red overbreak threshold (%)",
  concreteRatePerM3: "Concrete rate per m³",
  currency: "Currency",
  role: "Role",
  active: "Active",
  isAdmin: "System administrator",
};

export function fieldLabel(field: string): string {
  return FIELD_LABEL[field] ?? field;
}

/** Renders an audited value for display. */
export function auditValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 16).replace("T", " ");
    }
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
