/** Minimal RFC4180-ish CSV parser — enough for a pile schedule export. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const text = input.replace(/^﻿/, "").replace(/\r\n?/g, "\n");

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Maps loose header spellings onto the fields the importer understands. */
const HEADER_ALIASES: Record<string, string> = {
  ref: "ref",
  pile: "ref",
  pileref: "ref",
  pileid: "ref",
  pilemark: "ref",
  mark: "ref",
  easting: "easting",
  e: "easting",
  x: "easting",
  northing: "northing",
  n: "northing",
  y: "northing",
  diameter: "diameter",
  diametermm: "diameter",
  dia: "diameter",
  toedepth: "toedepth",
  toedepthm: "toedepth",
  depth: "toedepth",
  length: "toedepth",
  cutoff: "cutoff",
  cutofflevel: "cutoff",
  cutofflevelm: "cutoff",
  gridref: "gridref",
  grid: "gridref",
};

export function normaliseHeader(h: string): string | null {
  const key = h.toLowerCase().replace(/[^a-z]/g, "");
  return HEADER_ALIASES[key] ?? null;
}
