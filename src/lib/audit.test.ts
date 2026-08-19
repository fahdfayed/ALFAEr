import assert from "node:assert/strict";
import { test } from "node:test";

import { auditValue, diff } from "./auditDiff";

test("only changed fields are recorded", () => {
  const changes = diff(
    { toeDepthM: 24, pouredVolumeM3: 18.5, remarks: null },
    { toeDepthM: 24, pouredVolumeM3: 19, remarks: null },
  );
  assert.deepEqual(Object.keys(changes), ["pouredVolumeM3"]);
  assert.deepEqual(changes.pouredVolumeM3, { from: 18.5, to: 19 });
});

test("float noise from the database is not reported as a change", () => {
  const changes = diff({ toeDepthM: 24.400000000000002 }, { toeDepthM: 24.4 });
  assert.deepEqual(changes, {});
});

test("dates are compared as instants, not object identity", () => {
  const changes = diff(
    { boreStartedAt: new Date("2026-08-19T07:00:00Z") },
    { boreStartedAt: new Date("2026-08-19T07:00:00Z") },
  );
  assert.deepEqual(changes, {});
});

test("a changed date is recorded in both directions", () => {
  const changes = diff(
    { boreStartedAt: new Date("2026-08-19T07:00:00Z") },
    { boreStartedAt: new Date("2026-08-19T08:00:00Z") },
  );
  assert.deepEqual(changes.boreStartedAt, {
    from: "2026-08-19T07:00:00.000Z",
    to: "2026-08-19T08:00:00.000Z",
  });
});

test("creation records only the fields that carry a value", () => {
  const changes = diff(null, { toeDepthM: 24, remarks: null, weather: "Clear" });
  assert.deepEqual(Object.keys(changes).sort(), ["toeDepthM", "weather"]);
});

test("untouched fields absent from the update are not reported as cleared", () => {
  // A partial update must not claim it wiped everything it did not mention.
  const changes = diff(
    { toeDepthM: 24, remarks: "something", weather: "Clear" },
    { toeDepthM: 25 },
  );
  assert.deepEqual(Object.keys(changes), ["toeDepthM"]);
});

test("bookkeeping columns never appear in the trail", () => {
  const changes = diff(
    { id: "a", createdAt: new Date(0), updatedAt: new Date(0), siteId: "s", toeDepthM: 1 },
    { id: "b", createdAt: new Date(1), updatedAt: new Date(1), siteId: "t", toeDepthM: 2 },
  );
  assert.deepEqual(Object.keys(changes), ["toeDepthM"]);
});

test("clearing a value is recorded as a change to nothing", () => {
  const changes = diff({ remarks: "obstruction" }, { remarks: null });
  assert.deepEqual(changes.remarks, { from: "obstruction", to: null });
});

test("values render for a human reader", () => {
  assert.equal(auditValue(null), "—");
  assert.equal(auditValue(""), "—");
  assert.equal(auditValue(true), "Yes");
  assert.equal(auditValue(false), "No");
  assert.equal(auditValue(19.5), "19.5");
  assert.equal(auditValue("2026-08-19T07:30:00.000Z"), "2026-08-19 07:30");
});
