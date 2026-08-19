"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PileStatus } from "@prisma/client";

import { PILE_STATUSES, STATUS_COLOR, STATUS_LABEL } from "@/lib/status";
import type { OverbreakBand } from "@/lib/concrete";
import { m3, num, pct } from "@/lib/format";

export interface BoardPile {
  id: string;
  ref: string;
  status: PileStatus;
  eastingM: number;
  northingM: number;
  diameterMm: number;
  rigName: string | null;
  toeDepthM: number | null;
  pouredM3: number | null;
  overbreakPct: number | null;
  band: OverbreakBand | null;
  workDate: string | null;
}

type ColourMode = "status" | "overbreak";

const BAND_COLOR: Record<OverbreakBand, string> = {
  ok: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
  under: "#8b5cf6",
};

function tooltip(p: BoardPile): string {
  const parts = [p.ref, STATUS_LABEL[p.status]];
  if (p.overbreakPct !== null) parts.push(`${pct(p.overbreakPct)} overbreak`);
  return parts.join(" — ");
}

const PAD = 0.06; // fraction of extent kept as margin around the plan

export function LayoutBoard({
  piles,
  rigs,
}: {
  piles: BoardPile[];
  rigs: string[];
}) {
  const [colourMode, setColourMode] = useState<ColourMode>("status");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [rigFilter, setRigFilter] = useState<string>("");
  const [selected, setSelected] = useState<BoardPile | null>(null);

  const visible = useMemo(
    () =>
      piles.filter(
        (p) =>
          (statusFilter === "" || p.status === statusFilter) &&
          (rigFilter === "" || p.rigName === rigFilter),
      ),
    [piles, statusFilter, rigFilter],
  );

  // The viewBox is fitted to the real survey extents, so the plan keeps its
  // true proportions however the site is shaped.
  const bounds = useMemo(() => {
    if (piles.length === 0) return null;
    const es = piles.map((p) => p.eastingM);
    const ns = piles.map((p) => p.northingM);
    const minE = Math.min(...es);
    const maxE = Math.max(...es);
    const minN = Math.min(...ns);
    const maxN = Math.max(...ns);
    const spanE = Math.max(maxE - minE, 1);
    const spanN = Math.max(maxN - minN, 1);
    const pad = Math.max(spanE, spanN) * PAD;
    return {
      minE: minE - pad,
      minN: minN - pad,
      width: spanE + pad * 2,
      height: spanN + pad * 2,
    };
  }, [piles]);

  if (!bounds) return null;

  // Northing increases upward on a survey plan but downward in SVG, so y flips.
  const toX = (e: number) => e - bounds.minE;
  const toY = (n: number) => bounds.height - (n - bounds.minN);

  const radius = Math.max(Math.max(bounds.width, bounds.height) / 90, 0.35);
  const showLabels = visible.length <= 200;

  function fill(p: BoardPile) {
    if (colourMode === "status") return STATUS_COLOR[p.status];
    return p.band ? BAND_COLOR[p.band] : "#e2e8f0";
  }

  return (
    <div className="space-y-3">
      <div className="card no-print flex flex-wrap items-end gap-3 p-4">
        <label className="block">
          <span className="label">Colour by</span>
          <select
            className="field"
            value={colourMode}
            onChange={(e) => setColourMode(e.target.value as ColourMode)}
          >
            <option value="status">Pile status</option>
            <option value="overbreak">Concrete overbreak</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Status</span>
          <select
            className="field"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All</option>
            {PILE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Rig</span>
          <select
            className="field"
            value={rigFilter}
            onChange={(e) => setRigFilter(e.target.value)}
          >
            <option value="">All</option>
            {rigs.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <p className="ml-auto text-sm text-slate-500">
          Showing {visible.length} of {piles.length} piles
        </p>
      </div>

      <div className="card overflow-hidden p-2">
        <svg
          viewBox={`0 0 ${bounds.width} ${bounds.height}`}
          className="h-[60vh] w-full touch-pan-y"
          role="img"
          aria-label="Pile layout progress board"
        >
          {visible.map((p) => (
            <g key={p.id}>
              <circle
                cx={toX(p.eastingM)}
                cy={toY(p.northingM)}
                r={radius}
                fill={fill(p)}
                stroke={selected?.id === p.id ? "#0f172a" : "#475569"}
                strokeWidth={selected?.id === p.id ? radius * 0.5 : radius * 0.12}
                className="cursor-pointer"
                onClick={() => setSelected(p)}
              >
                <title>{tooltip(p)}</title>
              </circle>
              {showLabels ? (
                <text
                  x={toX(p.eastingM)}
                  y={toY(p.northingM) + radius * 2.4}
                  textAnchor="middle"
                  fontSize={radius * 1.5}
                  fill="#475569"
                  className="pointer-events-none select-none"
                >
                  {p.ref}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      </div>

      <div className="card flex flex-wrap gap-4 p-4">
        {colourMode === "status"
          ? PILE_STATUSES.map((s) => (
              <span key={s} className="flex items-center gap-2 text-sm">
                <span
                  className="inline-block h-3 w-3 rounded-full ring-1 ring-slate-400"
                  style={{ background: STATUS_COLOR[s] }}
                />
                {STATUS_LABEL[s]}
                <span className="tabular-nums text-slate-400">
                  {piles.filter((p) => p.status === s).length}
                </span>
              </span>
            ))
          : (["ok", "amber", "red", "under"] as OverbreakBand[]).map((b) => (
              <span key={b} className="flex items-center gap-2 text-sm">
                <span
                  className="inline-block h-3 w-3 rounded-full ring-1 ring-slate-400"
                  style={{ background: BAND_COLOR[b] }}
                />
                {{ ok: "Within tolerance", amber: "Elevated", red: "Over threshold", under: "Below theoretical" }[b]}
                <span className="tabular-nums text-slate-400">
                  {piles.filter((p) => p.band === b).length}
                </span>
              </span>
            ))}
      </div>

      {selected ? (
        <div className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-bold">Pile {selected.ref}</p>
              <p className="text-sm text-slate-500">
                {STATUS_LABEL[selected.status]} · Ø{selected.diameterMm} mm
                {selected.rigName ? ` · ${selected.rigName}` : ""}
                {selected.workDate ? ` · ${selected.workDate}` : ""}
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setSelected(null)}
            >
              Close
            </button>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-slate-500">Toe depth</dt>
              <dd className="font-medium tabular-nums">
                {selected.toeDepthM === null ? "—" : `${num(selected.toeDepthM)} m`}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Concrete</dt>
              <dd className="font-medium tabular-nums">
                {selected.pouredM3 === null ? "—" : `${m3(selected.pouredM3)} m³`}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Overbreak</dt>
              <dd className="font-medium tabular-nums">
                {selected.overbreakPct === null ? "—" : pct(selected.overbreakPct)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Coordinates</dt>
              <dd className="font-medium tabular-nums">
                {num(selected.eastingM, 2)} E / {num(selected.northingM, 2)} N
              </dd>
            </div>
          </dl>
          <Link href={`/piles/${selected.id}`} className="btn-primary mt-4">
            Open pile record
          </Link>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Tap a pile to see its record.</p>
      )}
    </div>
  );
}
