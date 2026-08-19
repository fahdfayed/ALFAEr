"use client";

import { useActionState } from "react";

import { Field } from "@/components/Field";
import { saveDailyReport } from "@/app/daily/actions";
import type { ActionState } from "@/lib/parse";

export interface DailyReportValues {
  weather: string;
  temperatureC: string;
  personnelCount: string;
  plantOnSite: string;
  delays: string;
  hseNotes: string;
  visitors: string;
  generalNotes: string;
  preparedBy: string;
}

export function DailyReportForm({
  reportDate,
  values,
}: {
  reportDate: string;
  values: DailyReportValues;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveDailyReport,
    { ok: true },
  );

  return (
    <form action={formAction} className="card space-y-4 p-4 sm:p-5">
      <input type="hidden" name="reportDate" value={reportDate} />
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title">Shift narrative</h2>
        {state.error ? (
          <span role="alert" className="text-sm font-medium text-red-700">
            {state.error}
          </span>
        ) : null}
      </div>
      <p className="text-sm text-slate-500">
        Production figures come from the pile logs — only what can&rsquo;t be
        derived is typed here.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Weather">
          <input name="weather" className="field" defaultValue={values.weather} />
        </Field>
        <Field label="Temperature (°C)">
          <input
            name="temperatureC"
            className="field"
            type="number"
            defaultValue={values.temperatureC}
          />
        </Field>
        <Field label="Personnel on site">
          <input
            name="personnelCount"
            className="field"
            type="number"
            defaultValue={values.personnelCount}
          />
        </Field>
        <Field label="Plant on site" className="sm:col-span-3">
          <textarea
            name="plantOnSite"
            className="field"
            rows={2}
            defaultValue={values.plantOnSite}
            placeholder="2 × BG28, 1 × 50t crawler crane, 1 × 30t excavator"
          />
        </Field>
        <Field label="Delays / lost time" className="sm:col-span-3">
          <textarea name="delays" className="field" rows={2} defaultValue={values.delays} />
        </Field>
        <Field label="HSE notes" className="sm:col-span-3">
          <textarea name="hseNotes" className="field" rows={2} defaultValue={values.hseNotes} />
        </Field>
        <Field label="Visitors">
          <input name="visitors" className="field" defaultValue={values.visitors} />
        </Field>
        <Field label="Prepared by">
          <input name="preparedBy" className="field" defaultValue={values.preparedBy} />
        </Field>
        <Field label="General notes" className="sm:col-span-3">
          <textarea
            name="generalNotes"
            className="field"
            rows={2}
            defaultValue={values.generalNotes}
          />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save narrative"}
        </button>
        {state.saved && !pending ? (
          <span className="text-sm text-slate-500">Saved.</span>
        ) : null}
      </div>
    </form>
  );
}
