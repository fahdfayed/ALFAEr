"use client";

import { useTransition } from "react";

import { endDelay } from "@/app/delays/actions";

/** One tap for "we're moving again" — the only action an open delay needs. */
export function EndDelayButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn-primary !px-3 !py-1.5 text-xs"
      disabled={pending}
      onClick={() => start(() => endDelay(id))}
    >
      {pending ? "Ending…" : "End now"}
    </button>
  );
}
