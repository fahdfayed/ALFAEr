/** Form-value coercion helpers. Empty strings become null, not 0. */

export function optString(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

export function reqString(v: FormDataEntryValue | null, field: string): string {
  const s = optString(v);
  if (s === null) throw new FieldError(field, "is required");
  return s;
}

export function optFloat(v: FormDataEntryValue | null): number | null {
  const s = optString(v);
  if (s === null) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) throw new FieldError(s, "is not a number");
  return n;
}

export function reqFloat(v: FormDataEntryValue | null, field: string): number {
  const n = optFloat(v);
  if (n === null) throw new FieldError(field, "is required");
  return n;
}

export function optInt(v: FormDataEntryValue | null): number | null {
  const n = optFloat(v);
  return n === null ? null : Math.round(n);
}

export function reqInt(v: FormDataEntryValue | null, field: string): number {
  return Math.round(reqFloat(v, field));
}

export class FieldError extends Error {
  constructor(
    public field: string,
    message: string,
  ) {
    super(`${field} ${message}`);
    this.name = "FieldError";
  }
}

export interface ActionState {
  ok: boolean;
  error?: string;
  /** Set only after a successful submit, so a fresh form shows no banner. */
  saved?: boolean;
}
