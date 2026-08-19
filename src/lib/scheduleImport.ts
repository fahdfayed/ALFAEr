import type { Prisma } from "@prisma/client";

/**
 * Parses a pile setting-out schedule exported as CSV. Column names are matched
 * loosely because every consultant exports a different header row.
 */

export interface ImportRow {
  ref: string;
  gridRef: string | null;
  eastingM: number | null;
  northingM: number | null;
  designDiameterMm: number;
  designToeDepthM: number;
  designCutoffLevelM: number | null;
  designPlatformLevelM: number | null;
}

export interface ImportResult {
  rows: ImportRow[];
  errors: string[];
  headers: string[];
}

const ALIASES: Record<keyof ImportRow, string[]> = {
  ref: ["pile", "pileid", "pileref", "pileno", "pilenumber", "ref", "mark", "id"],
  gridRef: ["grid", "gridref", "gridreference", "zone", "location"],
  eastingM: ["easting", "east", "e", "x", "xcoord", "xcoordinate"],
  northingM: ["northing", "north", "n", "y", "ycoord", "ycoordinate"],
  designDiameterMm: ["diameter", "dia", "diameter(mm)", "diamm", "size", "piediameter"],
  designToeDepthM: [
    "depth",
    "designdepth",
    "toedepth",
    "pilelength",
    "length",
    "designtoedepth",
  ],
  designCutoffLevelM: ["cutoff", "cutofflevel", "col", "cutofflevel(m)"],
  designPlatformLevelM: ["platform", "platformlevel", "workinglevel", "pl"],
};

function normalise(header: string) {
  return header.toLowerCase().replace(/[\s_\-().µ]/g, "");
}

/** Minimal RFC4180 splitter — handles quoted fields containing commas. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === "," || ch === ";" || ch === "\t") {
      out.push(field.trim());
      field = "";
    } else {
      field += ch;
    }
  }
  out.push(field.trim());
  return out;
}

function toNumber(v: string | undefined): number | null {
  if (v === undefined) return null;
  const cleaned = v.replace(/[^\d.\-+eE]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === "+") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseSchedule(csv: string): ImportResult {
  const errors: string[] = [];
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");

  if (lines.length < 2) {
    return { rows: [], errors: ["The file needs a header row and at least one pile."], headers: [] };
  }

  const headers = splitCsvLine(lines[0]);
  const normalised = headers.map(normalise);

  // Headers are matched exactly first, then by prefix, so real-world columns
  // that carry their units — "Diameter (mm)", "Design Depth (m)" — still land
  // on the right field. Prefix matching is limited to aliases of three or more
  // characters, or "E"/"N"/"X"/"Y" would swallow unrelated columns.
  const indexOf = (field: keyof ImportRow) => {
    for (const alias of ALIASES[field]) {
      const i = normalised.indexOf(alias);
      if (i !== -1) return i;
    }
    for (const alias of ALIASES[field]) {
      if (alias.length < 3) continue;
      const i = normalised.findIndex((h) => h.startsWith(alias));
      if (i !== -1) return i;
    }
    return -1;
  };

  const idx = {
    ref: indexOf("ref"),
    gridRef: indexOf("gridRef"),
    eastingM: indexOf("eastingM"),
    northingM: indexOf("northingM"),
    designDiameterMm: indexOf("designDiameterMm"),
    designToeDepthM: indexOf("designToeDepthM"),
    designCutoffLevelM: indexOf("designCutoffLevelM"),
    designPlatformLevelM: indexOf("designPlatformLevelM"),
  };

  if (idx.ref === -1) {
    errors.push(`No pile reference column found. Headers read: ${headers.join(", ")}`);
    return { rows: [], errors, headers };
  }

  const rows: ImportRow[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const ref = cells[idx.ref]?.trim();
    if (!ref) continue;

    if (seen.has(ref)) {
      errors.push(`Row ${i + 1}: pile "${ref}" appears more than once in the file — skipped.`);
      continue;
    }

    const diameter = idx.designDiameterMm === -1 ? null : toNumber(cells[idx.designDiameterMm]);
    const depth = idx.designToeDepthM === -1 ? null : toNumber(cells[idx.designToeDepthM]);

    if (diameter === null || diameter <= 0) {
      errors.push(`Row ${i + 1} (${ref}): missing or invalid diameter — skipped.`);
      continue;
    }
    if (depth === null || depth <= 0) {
      errors.push(`Row ${i + 1} (${ref}): missing or invalid design depth — skipped.`);
      continue;
    }

    seen.add(ref);
    rows.push({
      ref,
      gridRef: idx.gridRef === -1 ? null : cells[idx.gridRef]?.trim() || null,
      eastingM: idx.eastingM === -1 ? null : toNumber(cells[idx.eastingM]),
      northingM: idx.northingM === -1 ? null : toNumber(cells[idx.northingM]),
      designDiameterMm: Math.round(diameter),
      designToeDepthM: depth,
      designCutoffLevelM:
        idx.designCutoffLevelM === -1 ? null : toNumber(cells[idx.designCutoffLevelM]),
      designPlatformLevelM:
        idx.designPlatformLevelM === -1 ? null : toNumber(cells[idx.designPlatformLevelM]),
    });
  }

  return { rows, errors, headers };
}

export function toPileCreate(siteId: string, row: ImportRow): Prisma.PileCreateManyInput {
  return {
    siteId,
    ref: row.ref,
    gridRef: row.gridRef,
    eastingM: row.eastingM,
    northingM: row.northingM,
    designDiameterMm: row.designDiameterMm,
    designToeDepthM: row.designToeDepthM,
    designCutoffLevelM: row.designCutoffLevelM,
    designPlatformLevelM: row.designPlatformLevelM,
  };
}
