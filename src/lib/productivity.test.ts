import assert from "node:assert/strict";
import { test } from "node:test";

import { rigProductivity, drillRateByDiameter } from "./productivity";
import type { PileRow } from "./queries";
import type { DelayRow } from "./delayQueries";

const D = (iso: string) => new Date(iso);

/** Minimal shape the productivity maths actually reads. */
function pileRow(o: {
  rig: string | null;
  workDate: string;
  toe: number;
  dia: number;
  poured?: number;
  boreStart?: string | null;
  boreEnd?: string | null;
  pourStart?: string | null;
  pourEnd?: string | null;
}): PileRow {
  return {
    rigName: o.rig,
    pile: {
      log: {
        workDate: D(`${o.workDate}T00:00:00Z`),
        toeDepthM: o.toe,
        asBuiltDiameterMm: o.dia,
        pouredVolumeM3: o.poured ?? 10,
        boreStartedAt: o.boreStart ? D(o.boreStart) : null,
        boreFinishedAt: o.boreEnd ? D(o.boreEnd) : null,
        concreteStartedAt: o.pourStart ? D(o.pourStart) : null,
        concreteFinishedAt: o.pourEnd ? D(o.pourEnd) : null,
      },
    },
  } as unknown as PileRow;
}

function delayRow(rig: string | null, minutes: number): DelayRow {
  return { rigName: rig, minutes } as unknown as DelayRow;
}

test("metres per hour uses boring time only", () => {
  const [r] = rigProductivity(
    [
      pileRow({
        rig: "R1",
        workDate: "2026-08-01",
        toe: 24,
        dia: 900,
        boreStart: "2026-08-01T07:00:00Z",
        boreEnd: "2026-08-01T11:00:00Z",
      }),
    ],
    [],
  );
  assert.equal(r.metresDrilled, 24);
  assert.equal(r.boringHours, 4);
  assert.equal(r.metresPerHour, 6);
});

test("a pile with no bore window does not deflate the rate", () => {
  // The second pile has no times. Its metres must be excluded from the rate,
  // or the rig looks slower than it is — but still counted in total metres.
  const [r] = rigProductivity(
    [
      pileRow({
        rig: "R1",
        workDate: "2026-08-01",
        toe: 24,
        dia: 900,
        boreStart: "2026-08-01T07:00:00Z",
        boreEnd: "2026-08-01T11:00:00Z",
      }),
      pileRow({ rig: "R1", workDate: "2026-08-01", toe: 30, dia: 900 }),
    ],
    [],
  );
  assert.equal(r.metresPerHour, 6);
  assert.equal(r.metresDrilled, 54);
  assert.equal(r.piles, 2);
});

test("piles per day counts distinct shifts, not calendar span", () => {
  const rows = [
    pileRow({ rig: "R1", workDate: "2026-08-01", toe: 10, dia: 750 }),
    pileRow({ rig: "R1", workDate: "2026-08-01", toe: 10, dia: 750 }),
    pileRow({ rig: "R1", workDate: "2026-08-05", toe: 10, dia: 750 }),
  ];
  const [r] = rigProductivity(rows, []);
  assert.equal(r.shifts, 2);
  assert.equal(r.pilesPerDay, 1.5);
});

test("wait for concrete is the gap between bore finishing and pour starting", () => {
  const [r] = rigProductivity(
    [
      pileRow({
        rig: "R1",
        workDate: "2026-08-01",
        toe: 20,
        dia: 900,
        boreStart: "2026-08-01T07:00:00Z",
        boreEnd: "2026-08-01T10:00:00Z",
        pourStart: "2026-08-01T11:30:00Z",
        pourEnd: "2026-08-01T12:30:00Z",
      }),
    ],
    [],
  );
  assert.equal(r.averageWaitForConcreteHours, 1.5);
  assert.equal(r.averageCycleHours, 5.5);
});

test("utilisation measures boring against the planned shift, not cycle time", () => {
  // One 10-hour shift, 3 hours boring, 2 hours lost. Cycle time is 6 hours
  // because concreting overlaps the next bore, so a cycle-based figure would
  // claim 75% when the auger only turned for 30% of the shift.
  const [r] = rigProductivity(
    [
      pileRow({
        rig: "R1",
        workDate: "2026-08-01",
        toe: 20,
        dia: 900,
        boreStart: "2026-08-01T07:00:00Z",
        boreEnd: "2026-08-01T10:00:00Z",
        pourEnd: "2026-08-01T13:00:00Z",
      }),
    ],
    [delayRow("R1", 120)],
    10,
  );
  assert.equal(r.cycleHours, 6);
  assert.equal(r.delayHours, 2);
  assert.equal(r.availableHours, 10);
  assert.equal(r.utilisationPct, 30);
  assert.equal(r.delaySharePct, 20);
});

test("utilisation scales with the number of shifts worked", () => {
  const [r] = rigProductivity(
    [
      pileRow({
        rig: "R1",
        workDate: "2026-08-01",
        toe: 20,
        dia: 900,
        boreStart: "2026-08-01T07:00:00Z",
        boreEnd: "2026-08-01T12:00:00Z",
      }),
      pileRow({
        rig: "R1",
        workDate: "2026-08-02",
        toe: 20,
        dia: 900,
        boreStart: "2026-08-02T07:00:00Z",
        boreEnd: "2026-08-02T12:00:00Z",
      }),
    ],
    [],
    10,
  );
  assert.equal(r.availableHours, 20);
  assert.equal(r.boringHours, 10);
  assert.equal(r.utilisationPct, 50);
});

test("delays on another rig do not touch this rig's utilisation", () => {
  const stats = rigProductivity(
    [
      pileRow({
        rig: "R1",
        workDate: "2026-08-01",
        toe: 20,
        dia: 900,
        boreStart: "2026-08-01T07:00:00Z",
        boreEnd: "2026-08-01T09:00:00Z",
        pourEnd: "2026-08-01T10:00:00Z",
      }),
    ],
    [delayRow("R2", 600), delayRow(null, 600)],
  );
  assert.equal(stats.length, 1);
  assert.equal(stats[0].delayHours, 0);
  assert.equal(stats[0].delaySharePct, 0);
});

test("piles with no rig are excluded rather than lumped together", () => {
  const stats = rigProductivity(
    [pileRow({ rig: null, workDate: "2026-08-01", toe: 20, dia: 900 })],
    [],
  );
  assert.equal(stats.length, 0);
});

test("drilling rate groups by as-built diameter", () => {
  const g = drillRateByDiameter([
    pileRow({
      rig: "R1",
      workDate: "2026-08-01",
      toe: 24,
      dia: 900,
      boreStart: "2026-08-01T07:00:00Z",
      boreEnd: "2026-08-01T11:00:00Z",
    }),
    pileRow({
      rig: "R2",
      workDate: "2026-08-01",
      toe: 12,
      dia: 900,
      boreStart: "2026-08-01T07:00:00Z",
      boreEnd: "2026-08-01T09:00:00Z",
    }),
    pileRow({
      rig: "R1",
      workDate: "2026-08-01",
      toe: 30,
      dia: 1200,
      boreStart: "2026-08-01T07:00:00Z",
      boreEnd: "2026-08-01T17:00:00Z",
    }),
  ]);
  assert.deepEqual(
    g.map((x) => [x.diameterMm, x.metresPerHour]),
    [
      [900, 6],
      [1200, 3],
    ],
  );
});
