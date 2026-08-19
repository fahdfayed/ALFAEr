import type { ReactNode } from "react";

export function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "amber" | "red" | "emerald";
}) {
  const toneClass = {
    default: "text-slate-900",
    amber: "text-amber-700",
    red: "text-red-700",
    emerald: "text-emerald-700",
  }[tone];

  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}
