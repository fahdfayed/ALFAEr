"use client";

import { useActionState, useTransition } from "react";

import { Field } from "@/components/Field";
import {
  createProject,
  createUser,
  resetUserPassword,
  setMembership,
  setProjectArchived,
  setUserActive,
} from "@/app/admin/actions";
import { ROLE_DESCRIPTION, ROLE_LABEL, ROLES } from "@/lib/auth/roles";
import type { ActionState } from "@/lib/parse";

function Feedback({ state, okMessage }: { state: ActionState; okMessage: string }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm font-medium text-red-700">
        {state.error}
      </p>
    );
  }
  if (state.saved) {
    return <p className="text-sm font-medium text-emerald-700">{okMessage}</p>;
  }
  return null;
}

export function CreateUserForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createUser, {
    ok: true,
  });

  return (
    <form action={action} className="card space-y-4 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title">Add someone</h2>
        <Feedback state={state} okMessage="Account created." />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Name">
          <input name="name" className="field" required />
        </Field>
        <Field label="Email">
          <input name="email" type="email" className="field" required />
        </Field>
        <Field label="Initial password" hint="At least 10 characters. They can change it.">
          <input name="password" type="password" className="field" required />
        </Field>
        <label className="flex items-end gap-2 pb-2">
          <input name="isAdmin" type="checkbox" className="h-5 w-5 rounded" />
          <span className="text-sm font-medium text-slate-700">
            System administrator
          </span>
        </label>
      </div>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}

export function MembershipForm({
  users,
  sites,
}: {
  users: { id: string; name: string }[];
  sites: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    setMembership,
    { ok: true },
  );

  return (
    <form action={action} className="card space-y-4 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title">Project access</h2>
        <Feedback state={state} okMessage="Access updated." />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Person">
          <select name="userId" className="field" required>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Project">
          <select name="siteId" className="field" required>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Role" hint="Leave blank to remove their access.">
          <select name="role" className="field" defaultValue="FOREMAN">
            <option value="">No access</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <ul className="space-y-1 text-xs text-slate-500">
        {ROLES.map((r) => (
          <li key={r}>
            <strong className="text-slate-700">{ROLE_LABEL[r]}</strong> —{" "}
            {ROLE_DESCRIPTION[r]}
          </li>
        ))}
      </ul>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Set access"}
      </button>
    </form>
  );
}

export function ResetPasswordForm({
  users,
}: {
  users: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    resetUserPassword,
    { ok: true },
  );

  return (
    <form action={action} className="card space-y-4 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title">Reset a password</h2>
        <Feedback state={state} okMessage="Password reset. Their devices were signed out." />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Person">
          <select name="userId" className="field" required>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="New password" hint="At least 10 characters.">
          <input name="password" type="password" className="field" required />
        </Field>
      </div>
      <button type="submit" className="btn-secondary" disabled={pending}>
        {pending ? "Resetting…" : "Reset password"}
      </button>
    </form>
  );
}

export function ToggleUserButton({
  userId,
  active,
  disabled,
}: {
  userId: string;
  active: boolean;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn-secondary !px-3 !py-1 text-xs"
      disabled={pending || disabled}
      title={disabled ? "The last active administrator cannot be deactivated." : undefined}
      onClick={() => start(() => setUserActive(userId, !active))}
    >
      {pending ? "…" : active ? "Deactivate" : "Reactivate"}
    </button>
  );
}

export function CreateProjectForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createProject,
    { ok: true },
  );

  return (
    <form action={action} className="card space-y-4 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title">New project</h2>
        <Feedback state={state} okMessage="Project created. Switch to it in the header." />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Project name">
          <input name="name" className="field" required placeholder="Metro Station — Piling" />
        </Field>
        <Field label="Client">
          <input name="clientName" className="field" />
        </Field>
        <Field label="Contract reference">
          <input name="contractRef" className="field" />
        </Field>
        <Field label="Location">
          <input name="location" className="field" />
        </Field>
      </div>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Creating…" : "Create project"}
      </button>
    </form>
  );
}

export function ArchiveProjectButton({
  siteId,
  archived,
}: {
  siteId: string;
  archived: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn-secondary !px-3 !py-1 text-xs"
      disabled={pending}
      onClick={() => start(() => setProjectArchived(siteId, !archived))}
    >
      {pending ? "…" : archived ? "Unarchive" : "Archive"}
    </button>
  );
}
