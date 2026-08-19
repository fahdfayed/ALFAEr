import assert from "node:assert/strict";
import { test } from "node:test";

import { hasPermission, PERMISSIONS, ROLES } from "./roles";

test("a viewer can read and nothing else", () => {
  assert.equal(hasPermission("VIEWER", "view"), true);
  assert.equal(hasPermission("VIEWER", "recordWork"), false);
  assert.equal(hasPermission("VIEWER", "manageProject"), false);
});

test("a foreman records work but cannot change the contract", () => {
  assert.equal(hasPermission("FOREMAN", "view"), true);
  assert.equal(hasPermission("FOREMAN", "recordWork"), true);
  assert.equal(hasPermission("FOREMAN", "manageProject"), false);
});

test("an engineer can do everything on the project", () => {
  for (const p of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) {
    assert.equal(hasPermission("ENGINEER", p), true, p);
  }
});

test("every role can at least view, or it could not use the app", () => {
  for (const r of ROLES) assert.equal(hasPermission(r, "view"), true, r);
});

test("permissions widen monotonically from viewer to engineer", () => {
  // Any permission a lesser role holds must also be held by a greater one.
  const order = ["VIEWER", "FOREMAN", "ENGINEER"] as const;
  for (const p of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) {
    let seenGranted = false;
    for (const role of order) {
      const granted = hasPermission(role, p);
      if (seenGranted) {
        assert.equal(granted, true, `${role} should keep ${p}`);
      }
      if (granted) seenGranted = true;
    }
  }
});
