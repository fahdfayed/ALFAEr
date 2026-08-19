import assert from "node:assert/strict";
import { test } from "node:test";

import { delayMinutes, formatHours, isDelayCategory, reasonsFor, toHours } from "./delays";

test("a closed delay uses its cached minutes", () => {
  assert.equal(
    delayMinutes({
      startedAt: new Date("2026-08-01T08:00:00Z"),
      endedAt: new Date("2026-08-01T09:30:00Z"),
      minutes: 90,
    }),
    90,
  );
});

test("an open delay counts up to now, so it shows while it is happening", () => {
  const now = new Date("2026-08-01T10:00:00Z");
  assert.equal(
    delayMinutes(
      { startedAt: new Date("2026-08-01T08:30:00Z"), endedAt: null, minutes: null },
      now,
    ),
    90,
  );
});

test("a delay with no cached minutes falls back to its timestamps", () => {
  assert.equal(
    delayMinutes({
      startedAt: new Date("2026-08-01T08:00:00Z"),
      endedAt: new Date("2026-08-01T08:45:00Z"),
      minutes: null,
    }),
    45,
  );
});

test("clock skew cannot produce negative lost time", () => {
  const now = new Date("2026-08-01T07:00:00Z");
  assert.equal(
    delayMinutes(
      { startedAt: new Date("2026-08-01T08:00:00Z"), endedAt: null, minutes: null },
      now,
    ),
    0,
  );
});

test("hours format for humans", () => {
  assert.equal(formatHours(45), "45m");
  assert.equal(formatHours(60), "1h");
  assert.equal(formatHours(135), "2h 15m");
  assert.equal(toHours(135), 2.3);
});

test("every category has at least one reason", () => {
  for (const c of ["EQUIPMENT", "CONCRETE", "REINFORCEMENT", "SITE", "GROUND", "CLIENT", "OTHER"] as const) {
    assert.ok(reasonsFor(c).length > 0, `${c} has no reasons`);
  }
});

test("unknown categories are rejected", () => {
  assert.equal(isDelayCategory("EQUIPMENT"), true);
  assert.equal(isDelayCategory("NONSENSE"), false);
});
