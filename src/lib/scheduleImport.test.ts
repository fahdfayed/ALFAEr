import assert from "node:assert/strict";
import { test } from "node:test";

import { parseSchedule, splitCsvLine } from "./scheduleImport";

test("quoted fields keep their commas", () => {
  assert.deepEqual(splitCsvLine('a,"b,c",d'), ["a", "b,c", "d"]);
  assert.deepEqual(splitCsvLine('"say ""hi""",2'), ['say "hi"', "2"]);
});

test("semicolon and tab separated exports also parse", () => {
  assert.deepEqual(splitCsvLine("a;b;c"), ["a", "b", "c"]);
  assert.deepEqual(splitCsvLine("a\tb\tc"), ["a", "b", "c"]);
});

test("headers carrying their units still map to the right field", () => {
  const { rows, errors } = parseSchedule(
    [
      "Pile ID,Easting,Northing,Diameter (mm),Design Depth (m),Cut-off Level",
      "P-1,100.5,200.25,900,24.5,-2.5",
    ].join("\n"),
  );
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    ref: "P-1",
    gridRef: null,
    eastingM: 100.5,
    northingM: 200.25,
    designDiameterMm: 900,
    designToeDepthM: 24.5,
    designCutoffLevelM: -2.5,
    designPlatformLevelM: null,
  });
});

test("a repeated pile reference is reported and skipped once", () => {
  const { rows, errors } = parseSchedule(
    ["Pile,Diameter,Depth", "P-1,900,24", "P-1,900,24"].join("\n"),
  );
  assert.equal(rows.length, 1);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /appears more than once/);
});

test("rows missing the numbers a pile needs are skipped, not guessed", () => {
  const { rows, errors } = parseSchedule(
    ["Pile,Diameter,Depth", "P-1,,24", "P-2,900,", "P-3,900,24"].join("\n"),
  );
  assert.deepEqual(
    rows.map((r) => r.ref),
    ["P-3"],
  );
  assert.equal(errors.length, 2);
});

test("a file with no recognisable pile column fails loudly", () => {
  const { rows, errors } = parseSchedule(["Foo,Bar", "1,2"].join("\n"));
  assert.equal(rows.length, 0);
  assert.match(errors[0], /No pile reference column/);
});

test("blank lines and a trailing newline are tolerated", () => {
  const { rows } = parseSchedule("Pile,Diameter,Depth\n\nP-1,900,24\n\n");
  assert.equal(rows.length, 1);
});
