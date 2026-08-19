"use client";

import { useActionState } from "react";

import { Field } from "@/components/Field";
import { bootstrapAdmin, changeOwnPassword, signIn } from "@/lib/auth/actions";
import type { ActionState } from "@/lib/parse";

function ErrorBanner({ state }: { state: ActionState }) {
  if (!state.error) return null;
  return (
    <p
      role="alert"
      className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
    >
      {state.error}
    </p>
  );
}

export function SignInForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(signIn, {
    ok: true,
  });

  return (
    <form action={action} className="space-y-4">
      <ErrorBanner state={state} />
      <Field label="Email">
        <input
          name="email"
          type="email"
          className="field"
          autoComplete="username"
          required
          autoFocus
        />
      </Field>
      <Field label="Password">
        <input
          name="password"
          type="password"
          className="field"
          autoComplete="current-password"
          required
        />
      </Field>
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export function BootstrapForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    bootstrapAdmin,
    { ok: true },
  );

  return (
    <form action={action} className="space-y-4">
      <ErrorBanner state={state} />
      <Field label="Your name">
        <input name="name" className="field" required autoFocus />
      </Field>
      <Field label="Email">
        <input
          name="email"
          type="email"
          className="field"
          autoComplete="username"
          required
        />
      </Field>
      <Field label="Password" hint="At least 10 characters.">
        <input
          name="password"
          type="password"
          className="field"
          autoComplete="new-password"
          required
        />
      </Field>
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Creating…" : "Create administrator"}
      </button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    changeOwnPassword,
    { ok: true },
  );

  return (
    <form action={action} className="card space-y-4 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title">Change password</h2>
        {state.saved ? (
          <span className="text-sm font-medium text-emerald-700">
            Password changed. Other devices were signed out.
          </span>
        ) : null}
      </div>
      <ErrorBanner state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Current password">
          <input
            name="currentPassword"
            type="password"
            className="field"
            autoComplete="current-password"
            required
          />
        </Field>
        <Field label="New password" hint="At least 10 characters.">
          <input
            name="newPassword"
            type="password"
            className="field"
            autoComplete="new-password"
            required
          />
        </Field>
        <Field label="Confirm new password">
          <input
            name="confirmPassword"
            type="password"
            className="field"
            autoComplete="new-password"
            required
          />
        </Field>
      </div>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
