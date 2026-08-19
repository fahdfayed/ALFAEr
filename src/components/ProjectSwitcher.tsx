"use client";

import { useTransition } from "react";

import { selectSite } from "@/lib/auth/actions";

export function ProjectSwitcher({
  sites,
  currentId,
}: {
  sites: { id: string; name: string; archived: boolean }[];
  currentId: string;
}) {
  const [pending, start] = useTransition();

  if (sites.length <= 1) {
    return (
      <span className="truncate text-sm font-medium text-slate-600">
        {sites[0]?.name ?? ""}
      </span>
    );
  }

  return (
    <select
      aria-label="Active project"
      className="max-w-52 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm font-medium text-slate-700"
      value={currentId}
      disabled={pending}
      onChange={(e) => {
        const id = e.target.value;
        start(() => selectSite(id));
      }}
    >
      {sites.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
          {s.archived ? " (archived)" : ""}
        </option>
      ))}
    </select>
  );
}
