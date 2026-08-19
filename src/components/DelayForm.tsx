"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { DelayCategory } from "@prisma/client";

import { Field } from "@/components/Field";
import { saveDelay } from "@/app/delays/actions";
import { DELAY_CATEGORIES, CATEGORY_COLOR, reasonsFor } from "@/lib/delays";
import type { ActionState } from "@/lib/parse";
import type { NamedOption } from "@/components/PileLogForm";

export interface DelayFormValues {
  id: string;
  workDate: string;
  category: string;
  reason: string;
  rigId: string;
  pileLogId: string;
  startedAt: string;
  endedAt: string;
  notes: string;
  recordedBy: string;
}

export function DelayForm({
  rigs,
  piles,
  values,
}: {
  rigs: NamedOption[];
  piles: { id: string; ref: string }[];
  values: DelayFormValues;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveDelay, {
    ok: true,
  });

  const [category, setCategory] = useState(values.category);
  const [reason, setReason] = useState(values.reason);

  const reasons = category ? reasonsFor(category as DelayCategory) : [];

  return (
    <form action={formAction} className="space-y-5">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="reason" value={reason} />

      {state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
        >
          {state.error}
        </p>
      ) : null}

      {/* Two taps to a categorised delay. Anything that needs typing is
          optional and lives below the fold. */}
      <section className="card p-4 sm:p-5">
        <h2 className="section-title">What stopped?</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DELAY_CATEGORIES.map((c) => {
            const active = category === c.category;
            return (
              <button
                key={c.category}
                type="button"
                onClick={() => {
                  setCategory(c.category);
                  setReason("");
                }}
                className={`rounded-lg border-2 px-3 py-4 text-sm font-semibold transition ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                }`}
                style={active ? undefined : { borderLeftColor: CATEGORY_COLOR[c.category] }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </section>

      {category ? (
        <section className="card p-4 sm:p-5">
          <h2 className="section-title">Why?</h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {reasons.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`rounded-lg border px-3 py-3 text-left text-sm font-medium transition ${
                  reason === r
                    ? "border-slate-900 bg-slate-100 text-slate-900"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card p-4 sm:p-5">
        <h2 className="section-title">When</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Started">
            <input
              name="startedAt"
              className="field"
              type="datetime-local"
              defaultValue={values.startedAt}
              required
            />
          </Field>
          <Field label="Ended" hint="Leave blank while it is still ongoing.">
            <input
              name="endedAt"
              className="field"
              type="datetime-local"
              defaultValue={values.endedAt}
            />
          </Field>
          <Field label="Shift date" hint="Which daily report it belongs to.">
            <input
              name="workDate"
              className="field"
              type="date"
              defaultValue={values.workDate}
            />
          </Field>
          <Field label="Rig affected">
            <select name="rigId" className="field" defaultValue={values.rigId}>
              <option value="">Whole site / not rig specific</option>
              {rigs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Pile affected">
            <select name="pileLogId" className="field" defaultValue={values.pileLogId}>
              <option value="">—</option>
              {piles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.ref}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Recorded by">
            <input name="recordedBy" className="field" defaultValue={values.recordedBy} />
          </Field>
          <Field label="Notes" className="sm:col-span-2 lg:col-span-3">
            <textarea name="notes" className="field" rows={2} defaultValue={values.notes} />
          </Field>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="btn-primary"
          disabled={pending || !category || !reason}
        >
          {pending ? "Saving…" : values.id ? "Update delay" : "Record delay"}
        </button>
        <Link href="/delays" className="btn-secondary">
          Cancel
        </Link>
        {!category || !reason ? (
          <span className="text-sm text-slate-500">Pick a category and a reason.</span>
        ) : null}
      </div>
    </form>
  );
}
