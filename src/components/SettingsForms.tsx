"use client";

import { useActionState } from "react";

import { Field } from "@/components/Field";
import {
  addDriller,
  addRig,
  importSchedule,
  saveSite,
  type ImportState,
} from "@/app/settings/actions";
import type { ActionState } from "@/lib/parse";

function Feedback({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm font-medium text-red-700">
        {state.error}
      </p>
    );
  }
  if (state.saved) return <p className="text-sm font-medium text-emerald-700">Saved.</p>;
  return null;
}

export interface SiteValues {
  name: string;
  clientName: string;
  contractRef: string;
  location: string;
  overbreakAmberPct: string;
  overbreakRedPct: string;
  concreteRatePerM3: string;
  currency: string;
}

export function SiteForm({ values }: { values: SiteValues }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSite, {
    ok: true,
  });

  return (
    <form action={action} className="card space-y-4 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title">Contract</h2>
        <Feedback state={state} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Site name">
          <input name="name" className="field" defaultValue={values.name} required />
        </Field>
        <Field label="Client">
          <input name="clientName" className="field" defaultValue={values.clientName} />
        </Field>
        <Field label="Contract reference">
          <input name="contractRef" className="field" defaultValue={values.contractRef} />
        </Field>
        <Field label="Location">
          <input name="location" className="field" defaultValue={values.location} />
        </Field>
        <Field label="Amber overbreak (%)" hint="Elevated, worth a look.">
          <input
            name="overbreakAmberPct"
            className="field"
            type="number"
            step="0.1"
            defaultValue={values.overbreakAmberPct}
          />
        </Field>
        <Field label="Red overbreak (%)" hint="Flagged on every dashboard.">
          <input
            name="overbreakRedPct"
            className="field"
            type="number"
            step="0.1"
            defaultValue={values.overbreakRedPct}
          />
        </Field>
        <Field label="Concrete rate per m³" hint="Prices the overbreak. Optional.">
          <input
            name="concreteRatePerM3"
            className="field"
            type="number"
            step="0.01"
            defaultValue={values.concreteRatePerM3}
          />
        </Field>
        <Field label="Currency">
          <input name="currency" className="field" defaultValue={values.currency} />
        </Field>
      </div>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save contract details"}
      </button>
    </form>
  );
}

export function AddRigForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(addRig, {
    ok: true,
  });
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <Field label="Rig name" className="flex-1">
        <input name="name" className="field" placeholder="BG28-01" required />
      </Field>
      <Field label="Make / model" className="flex-1">
        <input name="make" className="field" placeholder="Bauer BG28" />
      </Field>
      <button type="submit" className="btn-secondary" disabled={pending}>
        Add rig
      </button>
      <div className="w-full">
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function AddDrillerForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(addDriller, {
    ok: true,
  });
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <Field label="Driller name" className="flex-1">
        <input name="name" className="field" required />
      </Field>
      <button type="submit" className="btn-secondary" disabled={pending}>
        Add driller
      </button>
      <div className="w-full">
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function ImportScheduleForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importSchedule, {
    ok: true,
  });

  return (
    <form action={action} className="space-y-3">
      <Field
        label="Pile schedule (CSV)"
        hint="Columns are matched loosely: pile / diameter / depth / easting / northing / cut-off. Re-importing a revised schedule updates design data and never touches an as-built log."
      >
        <input
          name="file"
          type="file"
          accept=".csv,text/csv"
          className="field"
          required
        />
      </Field>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Importing…" : "Import schedule"}
      </button>

      {state.error ? (
        <p role="alert" className="text-sm font-medium text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.saved ? (
        <p className="text-sm font-medium text-emerald-700">
          {state.created} pile{state.created === 1 ? "" : "s"} added,{" "}
          {state.updated} updated
          {state.skipped ? `, ${state.skipped} row(s) skipped` : ""}.
        </p>
      ) : null}
      {state.warnings && state.warnings.length > 0 ? (
        <ul className="list-inside list-disc rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          {state.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
