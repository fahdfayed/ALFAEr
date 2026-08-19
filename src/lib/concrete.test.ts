import assert from "node:assert/strict";
import { test } from "node:test";

import { calcOverbreak, overbreakBand, theoreticalVolumeM3 } from "./concrete";

test("theoretical volume is the bore cylinder", () => {
  // 900 mm over 25 m: pi * 0.45^2 * 25
  assert.equal(theoreticalVolumeM3(900, 25).toFixed(2), "15.90");
  assert.equal(theoreticalVolumeM3(1200, 30).toFixed(2), "33.93");
});

test("a bore with no concreted length holds nothing", () => {
  assert.equal(theoreticalVolumeM3(900, 0), 0);
  assert.equal(theoreticalVolumeM3(900, -5), 0);
});

test("overbreak is measured against the concreted length, not the whole bore", () => {
  // Cast from 3 m below platform to a 23 m toe is 20 m of concrete, not 23.
  const r = calcOverbreak({
    diameterMm: 900,
    toeDepthM: 23,
    concreteTopDepthM: 3,
    pouredVolumeM3: 14,
  });
  assert.equal(r.concretedLengthM, 20);
  assert.equal(r.theoreticalM3.toFixed(2), "12.72");
  assert.equal(r.overbreakM3.toFixed(2), "1.28");
  assert.equal(r.overbreakPct.toFixed(1), "10.0");
});

test("the worked example from the spec reproduces", () => {
  // 900 mm, 25 m, 18.1 m3 placed -> ~13.8% overbreak.
  const r = calcOverbreak({
    diameterMm: 900,
    toeDepthM: 25,
    concreteTopDepthM: 0,
    pouredVolumeM3: 18.1,
  });
  assert.equal(r.theoreticalM3.toFixed(1), "15.9");
  assert.equal(r.overbreakM3.toFixed(1), "2.2");
  assert.equal(Math.round(r.overbreakPct * 10) / 10, 13.8);
});

test("a shortfall against theoretical reads as negative, not as zero", () => {
  const r = calcOverbreak({
    diameterMm: 900,
    toeDepthM: 25,
    concreteTopDepthM: 0,
    pouredVolumeM3: 14,
  });
  assert.ok(r.overbreakM3 < 0);
  assert.ok(r.overbreakPct < 0);
  assert.equal(overbreakBand(r.overbreakPct, 8, 15), "under");
});

test("bands sit on the configured thresholds", () => {
  assert.equal(overbreakBand(0, 8, 15), "ok");
  assert.equal(overbreakBand(7.9, 8, 15), "ok");
  assert.equal(overbreakBand(8, 8, 15), "amber");
  assert.equal(overbreakBand(14.9, 8, 15), "amber");
  assert.equal(overbreakBand(15, 8, 15), "red");
  assert.equal(overbreakBand(-0.1, 8, 15), "under");
});

test("a zero-length pour cannot divide by zero", () => {
  const r = calcOverbreak({
    diameterMm: 900,
    toeDepthM: 5,
    concreteTopDepthM: 5,
    pouredVolumeM3: 2,
  });
  assert.equal(r.theoreticalM3, 0);
  assert.equal(r.overbreakPct, 0);
});
