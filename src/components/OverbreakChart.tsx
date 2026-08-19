import { BAND_LABEL, type OverbreakBand } from "@/lib/concrete";
import { BAND_FILL, CHROME } from "@/lib/viz";

export interface OverbreakPoint {
  ref: string;
  overbreakPct: number;
  band: OverbreakBand;
}

const SLOT = 16;
const BAR = 12;
const H = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 44 };

export function OverbreakChart({
  data,
  amberPct,
  redPct,
}: {
  data: OverbreakPoint[];
  amberPct: number;
  redPct: number;
}) {
  if (data.length === 0) return null;

  const values = data.map((d) => d.overbreakPct);
  const rawMax = Math.max(...values, redPct * 1.15);
  const rawMin = Math.min(...values, 0);
  // Round the domain out to whole percent so the ticks land on readable numbers.
  const yMax = Math.ceil(rawMax / 5) * 5;
  const yMin = Math.floor(rawMin / 5) * 5;

  const plotW = data.length * SLOT;
  const plotH = H - PAD.top - PAD.bottom;
  const width = plotW + PAD.left + PAD.right;

  const y = (v: number) =>
    PAD.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;

  const ticks: number[] = [];
  const step = Math.max(5, Math.round((yMax - yMin) / 5 / 5) * 5);
  for (let t = yMin; t <= yMax; t += step) ticks.push(t);

  const zeroY = y(0);
  const bands: OverbreakBand[] = ["ok", "amber", "under", "red"];

  return (
    <figure className="mt-3">
      <div className="overflow-x-auto">
        <svg
          width={width}
          height={H}
          viewBox={`0 0 ${width} ${H}`}
          role="img"
          aria-label={`Overbreak percentage for ${data.length} piles in pour order`}
          className="block"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke={CHROME.gridline}
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(t) + 4}
                textAnchor="end"
                fontSize={11}
                fill={CHROME.muted}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {t}%
              </text>
            </g>
          ))}

          {/* Trigger levels read as reference lines, not as data. */}
          {[
            { v: amberPct, color: BAND_FILL.amber, label: "amber" },
            { v: redPct, color: BAND_FILL.red, label: "red" },
          ].map((ref) => (
            <g key={ref.label}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(ref.v)}
                y2={y(ref.v)}
                stroke={ref.color}
                strokeWidth={2}
                strokeDasharray="6 4"
              />
              <text
                x={width - PAD.right}
                y={y(ref.v) - 5}
                textAnchor="end"
                fontSize={11}
                fontWeight={600}
                fill={CHROME.secondaryInk}
              >
                {ref.label} {ref.v}%
              </text>
            </g>
          ))}

          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={zeroY}
            y2={zeroY}
            stroke={CHROME.baseline}
            strokeWidth={2}
          />

          {data.map((d, i) => {
            const x = PAD.left + i * SLOT + (SLOT - BAR) / 2;
            const top = d.overbreakPct >= 0 ? y(d.overbreakPct) : zeroY;
            const height = Math.max(Math.abs(y(d.overbreakPct) - zeroY), 1);
            return (
              <rect
                key={`${d.ref}-${i}`}
                x={x}
                y={top}
                width={BAR}
                height={height}
                rx={4}
                fill={BAND_FILL[d.band]}
              >
                <title>
                  {d.ref}: {d.overbreakPct.toFixed(1)}% — {BAND_LABEL[d.band]}
                </title>
              </rect>
            );
          })}

          {/* Only the piles that need a conversation get a direct label. */}
          {data.map((d, i) =>
            d.band === "red" ? (
              <text
                key={`lbl-${d.ref}-${i}`}
                x={PAD.left + i * SLOT + SLOT / 2}
                y={y(d.overbreakPct) - 6}
                textAnchor="middle"
                fontSize={10}
                fontWeight={700}
                fill={CHROME.primaryInk}
              >
                {d.ref}
              </text>
            ) : null,
          )}
        </svg>
      </div>

      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {bands.map((b) => (
          <span key={b} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: BAND_FILL[b] }}
            />
            {BAND_LABEL[b]}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
