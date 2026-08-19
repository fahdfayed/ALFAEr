import Link from "next/link";
import type { ReactNode } from "react";
import type { PileStatus } from "@prisma/client";

import type { OverbreakBand } from "@/lib/concrete";
import { STATUS_CHIP, STATUS_LABEL } from "@/lib/status";
import { pct } from "@/lib/format";

export function StatusChip({ status }: { status: PileStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_CHIP[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

const BAND_CHIP: Record<OverbreakBand, string> = {
  ok: "bg-emerald-100 text-emerald-800 ring-emerald-300",
  amber: "bg-amber-100 text-amber-900 ring-amber-300",
  red: "bg-red-100 text-red-800 ring-red-300",
  under: "bg-violet-100 text-violet-800 ring-violet-300",
};

export function OverbreakChip({
  value,
  band,
}: {
  value: number | null;
  band: OverbreakBand | null;
}) {
  if (value === null || band === null) {
    return <span className="text-slate-400">—</span>;
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-inset ${BAND_CHIP[band]}`}
    >
      {pct(value)}
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "neutral",
  href,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
  href?: string;
}) {
  const toneClass = {
    neutral: "text-slate-900",
    good: "text-emerald-700",
    warn: "text-amber-700",
    bad: "text-red-700",
  }[tone];

  const body = (
    <div className="card h-full p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );

  return href ? (
    <Link href={href} className="block transition hover:opacity-80">
      {body}
    </Link>
  ) : (
    body
  );
}

export function DataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-1.5 last:border-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-medium tabular-nums text-slate-900">
        {value}
      </dd>
    </div>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="section-title">{title}</h2>
      <dl className="mt-2">{children}</dl>
    </section>
  );
}

export function EmptyState({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="card p-8 text-center">
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{body}</p>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="btn-primary mt-4">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
