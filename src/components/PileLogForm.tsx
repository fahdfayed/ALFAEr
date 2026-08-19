"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";

import { Field, Fieldset } from "@/components/Field";
import { savePileLog } from "@/app/piles/actions";
import { calcOverbreak, overbreakBand, BAND_LABEL } from "@/lib/concrete";
import { m3, pct } from "@/lib/format";
import { PILE_STATUSES, STATUS_LABEL } from "@/lib/status";
import type { ActionState } from "@/lib/parse";
import { OFF_SCHEDULE } from "@/lib/constants";

export interface PileOption {
  id: string;
  ref: string;
  designDiameterMm: number;
  designToeDepthM: number;
  hasLog: boolean;
}

export interface NamedOption {
  id: string;
  name: string;
}

export interface PileLogFormValues {
  pileId: string;
  workDate: string;
  rigId: string;
  drillerId: string;
  boreStartedAt: string;
  boreFinishedAt: string;
  asBuiltDiameterMm: string;
  toeDepthM: string;
  platformLevelM: string;
  cutoffLevelM: string;
  waterStrikeDepthM: string;
  verticalityPct: string;
  casingDepthM: string;
  casingDiameterMm: string;
  casingType: string;
  cageMark: string;
  cageLengthM: string;
  cageDiameterMm: string;
  cageMainBars: string;
  cageLinks: string;
  cageTopDepthM: string;
  cageInstalledAt: string;
  concreteStartedAt: string;
  concreteFinishedAt: string;
  concreteGrade: string;
  concreteMixRef: string;
  slumpMm: string;
  cubesTaken: string;
  concreteTopDepthM: string;
  pouredVolumeM3: string;
  strata: string;
  weather: string;
  remarks: string;
  status: string;
  loads: LoadRowValues[];
}

export interface LoadRowValues {
  ticketRef: string;
  volumeM3: string;
  arrivedAt: string;
  slumpMm: string;
}

const EMPTY_LOAD: LoadRowValues = {
  ticketRef: "",
  volumeM3: "",
  arrivedAt: "",
  slumpMm: "",
};

export function PileLogForm({
  piles,
  rigs,
  drillers,
  values,
  thresholds,
  mode,
}: {
  piles: PileOption[];
  rigs: NamedOption[];
  drillers: NamedOption[];
  values: PileLogFormValues;
  thresholds: { amberPct: number; redPct: number };
  mode: "create" | "edit";
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    savePileLog,
    { ok: true },
  );

  const [pileId, setPileId] = useState(values.pileId);
  const [diameter, setDiameter] = useState(values.asBuiltDiameterMm);
  const [toeDepth, setToeDepth] = useState(values.toeDepthM);
  const [topDepth, setTopDepth] = useState(values.concreteTopDepthM || "0");
  const [poured, setPoured] = useState(values.pouredVolumeM3);
  const [loads, setLoads] = useState<LoadRowValues[]>(
    values.loads.length > 0 ? values.loads : [],
  );

  const offSchedule = pileId === OFF_SCHEDULE;

  // Live overbreak preview. Seeing this before the sheet is filed is the whole
  // point — an 18% pour is a conversation to have at the rig, not at month end.
  const loadTotal = loads.reduce((sum, l) => sum + (Number(l.volumeM3) || 0), 0);
  const effectivePoured = loads.length > 0 ? loadTotal : Number(poured) || 0;

  const preview = useMemo(() => {
    const d = Number(diameter);
    const toe = Number(toeDepth);
    if (!d || !toe || !effectivePoured) return null;
    return calcOverbreak({
      diameterMm: d,
      toeDepthM: toe,
      concreteTopDepthM: Number(topDepth) || 0,
      pouredVolumeM3: effectivePoured,
    });
  }, [diameter, toeDepth, topDepth, effectivePoured]);

  const band = preview
    ? overbreakBand(preview.overbreakPct, thresholds.amberPct, thresholds.redPct)
    : null;

  const bandStyle: Record<string, string> = {
    ok: "border-emerald-300 bg-emerald-50 text-emerald-900",
    amber: "border-amber-300 bg-amber-50 text-amber-900",
    red: "border-red-300 bg-red-50 text-red-900",
    under: "border-violet-300 bg-violet-50 text-violet-900",
  };

  function updateLoad(i: number, patch: Partial<LoadRowValues>) {
    setLoads((rows) => rows.map((r, j) => (i === j ? { ...r, ...patch } : r)));
  }

  return (
    <form action={formAction} className="space-y-5 pb-28">
      {state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
        >
          {state.error}
        </p>
      ) : null}

      <Fieldset title="Pile">
        <Field label="Pile reference">
          <select
            name="pileId"
            className="field"
            value={pileId}
            onChange={(e) => {
              const id = e.target.value;
              setPileId(id);
              const pile = piles.find((p) => p.id === id);
              if (pile && mode === "create") {
                setDiameter(String(pile.designDiameterMm));
                setToeDepth(String(pile.designToeDepthM));
              }
            }}
            disabled={mode === "edit"}
          >
            <option value="">Select a pile…</option>
            {piles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.ref}
                {p.hasLog ? " (logged)" : ""} · Ø{p.designDiameterMm} ·{" "}
                {p.designToeDepthM}m
              </option>
            ))}
            <option value={OFF_SCHEDULE}>+ Pile not on the schedule</option>
          </select>
          {mode === "edit" ? (
            <input type="hidden" name="pileId" value={values.pileId} />
          ) : null}
        </Field>

        {offSchedule && mode === "create" ? (
          <>
            <Field label="New pile ref" hint="Adds it to the schedule too.">
              <input name="newPileRef" className="field" required placeholder="P-101" />
            </Field>
            <Field label="Design diameter (mm)">
              <input
                name="newPileDesignDiameterMm"
                className="field"
                type="number"
                inputMode="numeric"
                placeholder="900"
              />
            </Field>
            <Field label="Design toe depth (m)">
              <input
                name="newPileDesignToeDepthM"
                className="field"
                type="number"
                step="0.01"
                inputMode="decimal"
              />
            </Field>
            <Field label="Easting (m)" hint="Optional — needed for the layout board.">
              <input name="newPileEastingM" className="field" type="number" step="0.001" />
            </Field>
            <Field label="Northing (m)">
              <input name="newPileNorthingM" className="field" type="number" step="0.001" />
            </Field>
          </>
        ) : null}

        <Field label="Work date">
          <input
            name="workDate"
            className="field"
            type="date"
            defaultValue={values.workDate}
            required
          />
        </Field>
        <Field label="Rig">
          <select name="rigId" className="field" defaultValue={values.rigId}>
            <option value="">—</option>
            {rigs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Driller">
          <select name="drillerId" className="field" defaultValue={values.drillerId}>
            <option value="">—</option>
            {drillers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select name="status" className="field" defaultValue={values.status}>
            {PILE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
      </Fieldset>

      <Fieldset title="Bore">
        <Field label="Started">
          <input
            name="boreStartedAt"
            className="field"
            type="datetime-local"
            defaultValue={values.boreStartedAt}
          />
        </Field>
        <Field label="Finished">
          <input
            name="boreFinishedAt"
            className="field"
            type="datetime-local"
            defaultValue={values.boreFinishedAt}
          />
        </Field>
        <Field label="As-built diameter (mm)">
          <input
            name="asBuiltDiameterMm"
            className="field"
            type="number"
            inputMode="numeric"
            required
            value={diameter}
            onChange={(e) => setDiameter(e.target.value)}
          />
        </Field>
        <Field label="Toe depth (m)" hint="Below working platform.">
          <input
            name="toeDepthM"
            className="field"
            type="number"
            step="0.01"
            inputMode="decimal"
            required
            value={toeDepth}
            onChange={(e) => setToeDepth(e.target.value)}
          />
        </Field>
        <Field label="Platform level (m)">
          <input
            name="platformLevelM"
            className="field"
            type="number"
            step="0.001"
            defaultValue={values.platformLevelM}
          />
        </Field>
        <Field label="Cut-off level (m)">
          <input
            name="cutoffLevelM"
            className="field"
            type="number"
            step="0.001"
            defaultValue={values.cutoffLevelM}
          />
        </Field>
        <Field label="Water strike (m)">
          <input
            name="waterStrikeDepthM"
            className="field"
            type="number"
            step="0.01"
            defaultValue={values.waterStrikeDepthM}
          />
        </Field>
        <Field label="Verticality (%)">
          <input
            name="verticalityPct"
            className="field"
            type="number"
            step="0.01"
            defaultValue={values.verticalityPct}
          />
        </Field>
      </Fieldset>

      <Fieldset title="Casing">
        <Field label="Casing depth (m)">
          <input
            name="casingDepthM"
            className="field"
            type="number"
            step="0.01"
            defaultValue={values.casingDepthM}
          />
        </Field>
        <Field label="Casing diameter (mm)">
          <input
            name="casingDiameterMm"
            className="field"
            type="number"
            defaultValue={values.casingDiameterMm}
          />
        </Field>
        <Field label="Type">
          <input
            name="casingType"
            className="field"
            defaultValue={values.casingType}
            placeholder="Temporary"
          />
        </Field>
      </Fieldset>

      <Fieldset title="Reinforcement cage">
        <Field label="Cage mark">
          <input name="cageMark" className="field" defaultValue={values.cageMark} />
        </Field>
        <Field label="Cage length (m)">
          <input
            name="cageLengthM"
            className="field"
            type="number"
            step="0.01"
            defaultValue={values.cageLengthM}
          />
        </Field>
        <Field label="Cage diameter (mm)">
          <input
            name="cageDiameterMm"
            className="field"
            type="number"
            defaultValue={values.cageDiameterMm}
          />
        </Field>
        <Field label="Main bars">
          <input
            name="cageMainBars"
            className="field"
            defaultValue={values.cageMainBars}
            placeholder="12T25"
          />
        </Field>
        <Field label="Links">
          <input
            name="cageLinks"
            className="field"
            defaultValue={values.cageLinks}
            placeholder="T10 @ 150"
          />
        </Field>
        <Field label="Top of cage (m below platform)">
          <input
            name="cageTopDepthM"
            className="field"
            type="number"
            step="0.01"
            defaultValue={values.cageTopDepthM}
          />
        </Field>
        <Field label="Cage installed">
          <input
            name="cageInstalledAt"
            className="field"
            type="datetime-local"
            defaultValue={values.cageInstalledAt}
          />
        </Field>
      </Fieldset>

      <Fieldset title="Concrete">
        <Field label="Concreting started">
          <input
            name="concreteStartedAt"
            className="field"
            type="datetime-local"
            defaultValue={values.concreteStartedAt}
          />
        </Field>
        <Field label="Concreting finished">
          <input
            name="concreteFinishedAt"
            className="field"
            type="datetime-local"
            defaultValue={values.concreteFinishedAt}
          />
        </Field>
        <Field label="Grade">
          <input
            name="concreteGrade"
            className="field"
            defaultValue={values.concreteGrade}
            placeholder="C32/40"
          />
        </Field>
        <Field label="Mix reference">
          <input name="concreteMixRef" className="field" defaultValue={values.concreteMixRef} />
        </Field>
        <Field label="Slump (mm)">
          <input
            name="slumpMm"
            className="field"
            type="number"
            defaultValue={values.slumpMm}
          />
        </Field>
        <Field label="Cubes taken">
          <input
            name="cubesTaken"
            className="field"
            type="number"
            defaultValue={values.cubesTaken}
          />
        </Field>
        <Field
          label="Top of concrete (m below platform)"
          hint="0 if cast up to platform level."
        >
          <input
            name="concreteTopDepthM"
            className="field"
            type="number"
            step="0.01"
            value={topDepth}
            onChange={(e) => setTopDepth(e.target.value)}
          />
        </Field>
        <Field
          label="Concrete poured (m³)"
          hint={
            loads.length > 0
              ? "Taken from the load tickets below."
              : "Or add load tickets below and this fills itself."
          }
        >
          <input
            name="pouredVolumeM3"
            className="field"
            type="number"
            step="0.01"
            inputMode="decimal"
            value={loads.length > 0 ? loadTotal.toFixed(2) : poured}
            onChange={(e) => setPoured(e.target.value)}
            readOnly={loads.length > 0}
          />
        </Field>
      </Fieldset>

      <section className="card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="section-title">Load tickets</h2>
            <p className="mt-1 text-sm text-slate-500">
              Optional. Recording dockets makes the poured volume auditable
              against the batching plant.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary shrink-0"
            onClick={() => setLoads((rows) => [...rows, { ...EMPTY_LOAD }])}
          >
            + Load
          </button>
        </div>

        {loads.length > 0 ? (
          <div className="mt-4 space-y-3">
            {loads.map((load, i) => (
              <div
                key={i}
                className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-5"
              >
                <Field label="Ticket">
                  <input
                    name="loadTicketRef"
                    className="field"
                    value={load.ticketRef}
                    onChange={(e) => updateLoad(i, { ticketRef: e.target.value })}
                  />
                </Field>
                <Field label="Volume (m³)">
                  <input
                    name="loadVolumeM3"
                    className="field"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={load.volumeM3}
                    onChange={(e) => updateLoad(i, { volumeM3: e.target.value })}
                  />
                </Field>
                <Field label="Arrived">
                  <input
                    name="loadArrivedAt"
                    className="field"
                    type="datetime-local"
                    value={load.arrivedAt}
                    onChange={(e) => updateLoad(i, { arrivedAt: e.target.value })}
                  />
                </Field>
                <Field label="Slump (mm)">
                  <input
                    name="loadSlumpMm"
                    className="field"
                    type="number"
                    value={load.slumpMm}
                    onChange={(e) => updateLoad(i, { slumpMm: e.target.value })}
                  />
                </Field>
                <div className="flex items-end">
                  <button
                    type="button"
                    className="btn-secondary w-full !text-red-700"
                    onClick={() => setLoads((rows) => rows.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <p className="text-sm font-medium text-slate-700">
              Total from tickets: {loadTotal.toFixed(2)} m³
            </p>
          </div>
        ) : null}
      </section>

      {mode === "edit" ? (
        <Fieldset
          title="Reason for this change"
          description="Recorded against the audit trail. A quantity that changes without a reason is the one a quantity surveyor will challenge."
        >
          <Field label="Why is this record changing?" className="sm:col-span-3">
            <input
              name="changeReason"
              className="field"
              placeholder="Missing final delivery ticket added"
            />
          </Field>
        </Fieldset>
      ) : null}

      <Fieldset title="Ground &amp; notes">
        <Field label="Weather" className="sm:col-span-1">
          <input name="weather" className="field" defaultValue={values.weather} />
        </Field>
        <Field label="Strata encountered" className="sm:col-span-2">
          <textarea
            name="strata"
            className="field"
            rows={3}
            defaultValue={values.strata}
            placeholder="0.0–2.5 made ground; 2.5–9.0 stiff clay; 9.0+ weathered rock"
          />
        </Field>
        <Field label="Remarks" className="sm:col-span-3">
          <textarea name="remarks" className="field" rows={3} defaultValue={values.remarks} />
        </Field>
      </Fieldset>

      {/* Sticky footer: the overbreak verdict and the save button follow the
          driller down the form, so neither is missed on a small screen. */}
      <div className="no-print fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          {preview && band ? (
            <div
              className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-xs sm:text-sm ${bandStyle[band]}`}
            >
              <span className="font-semibold">{pct(preview.overbreakPct)}</span>{" "}
              {BAND_LABEL[band].toLowerCase()}
              <span className="hidden sm:inline">
                {" "}
                · theoretical {m3(preview.theoreticalM3)} m³ vs poured{" "}
                {m3(preview.pouredM3)} m³
              </span>
            </div>
          ) : (
            <p className="hidden flex-1 text-sm text-slate-500 sm:block">
              Diameter, toe depth and poured volume give the live overbreak.
            </p>
          )}
          <Link href="/piles" className="btn-secondary no-print shrink-0">
            Cancel
          </Link>
          <button type="submit" className="btn-primary shrink-0" disabled={pending}>
            {pending ? "Saving…" : mode === "edit" ? "Update log" : "Save pile log"}
          </button>
        </div>
      </div>
    </form>
  );
}
