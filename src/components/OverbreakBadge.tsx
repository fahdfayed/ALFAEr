import { BAND_LABEL, type OverbreakBand } from "@/lib/concrete";
import { pct } from "@/lib/format";

const BAND_CLASS: Record<OverbreakBand, string> = {
  ok: "bg-emerald-100 text-emerald-800 ring-emerald-300",
  amber: "bg-amber-100 text-amber-900 ring-amber-300",
  red: "bg-red-100 text-red-800 ring-red-300",
  under: "bg-violet-100 text-violet-800 ring-violet-300",
};

export function OverbreakBadge({
  band,
  overbreakPct,
}: {
  band: OverbreakBand | null;
  overbreakPct: number | null;
}) {
  if (!band || overbreakPct === null) {
    return <span className="text-slate-400">—</span>;
  }
  return (
    <span
      title={BAND_LABEL[band]}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-inset ${BAND_CLASS[band]}`}
    >
      {pct(overbreakPct)}
    </span>
  );
}
