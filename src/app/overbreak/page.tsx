import Link from "next/link";

import { getSite } from "@/lib/site";
import { getPileRows, totalise } from "@/lib/queries";
import { breakdownBy, distribution } from "@/lib/breakdown";
import { OverbreakChip, Stat, EmptyState } from "@/components/ui";
import { m3, num, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OverbreakPage() {
  const site = await getSite();
  const thresholds = {
    amberPct: site.overbreakAmberPct,
    redPct: site.overbreakRedPct,
  };

  const rows = await getPileRows(site.id, thresholds);
  const logged = rows.filter((r) => r.theoreticalM3 !== null);
  const totals = totalise(rows);

  if (logged.length === 0) {
    return (
      <EmptyState
        title="No concrete data yet"
        body="Overbreak is calculated from pile logs. Log a pile and the numbers appear here automatically."
        actionHref="/piles/new"
        actionLabel="Log a pile"
      />
    );
  }

  const byRig = breakdownBy(logged, (r) =>
    r.rigName ? { key: r.rigName, label: r.rigName } : null,
  );
  const byDiameter = breakdownBy(logged, (r) => {
    const d = r.pile.log?.asBuiltDiameterMm;
    return d ? { key: String(d), label: `Ø${d} mm` } : null;
  });
  const byDriller = breakdownBy(logged, (r) =>
    r.drillerName ? { key: r.drillerName, label: r.drillerName } : null,
  );

  const dist = distribution(logged);
  const maxBucket = Math.max(...dist.map((d) => d.count), 1);

  const worst = [...logged]
    .sort((a, b) => (b.overbreakM3 ?? 0) - (a.overbreakM3 ?? 0))
    .slice(0, 15);

  const cost =
    site.concreteRatePerM3 !== null
      ? totals.overbreakM3 * site.concreteRatePerM3
      : null;

  const tone =
    totals.overbreakPct >= site.overbreakRedPct
      ? "bad"
      : totals.overbreakPct >= site.overbreakAmberPct
        ? "warn"
        : "good";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Concrete overbreak</h1>
        <p className="mt-1 text-sm text-slate-500">
          {logged.length} logged pile{logged.length === 1 ? "" : "s"}. Theoretical volume
          is the nominal bore cylinder from toe to top of cast concrete.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Theoretical" value={`${m3(totals.theoreticalM3, 0)} m³`} />
        <Stat label="Actual placed" value={`${m3(totals.pouredM3, 0)} m³`} />
        <Stat
          label="Additional"
          value={`${totals.overbreakM3 > 0 ? "+" : ""}${m3(totals.overbreakM3, 0)} m³`}
          tone={tone}
        />
        <Stat label="Average overbreak" value={pct(totals.overbreakPct)} tone={tone} />
        <Stat
          label="Cost of overbreak"
          value={
            cost === null
              ? "—"
              : `${site.currency} ${Math.round(cost).toLocaleString("en-US")}`
          }
          sub={
            site.concreteRatePerM3 === null ? (
              <Link href="/settings" className="underline">
                Set a concrete rate
              </Link>
            ) : (
              `at ${site.currency} ${site.concreteRatePerM3}/m³`
            )
          }
          tone={cost === null ? "neutral" : tone}
        />
      </div>

      <section className="card p-4">
        <h2 className="section-title">Distribution</h2>
        <div className="mt-3 space-y-2">
          {dist.map((b) => (
            <div key={b.label} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-right text-xs tabular-nums text-slate-500">
                {b.label}
              </span>
              <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
                <div
                  className={`h-full ${
                    b.min >= site.overbreakRedPct
                      ? "bg-red-500"
                      : b.min >= site.overbreakAmberPct
                        ? "bg-amber-400"
                        : b.max <= 0
                          ? "bg-violet-400"
                          : "bg-emerald-500"
                  }`}
                  style={{ width: `${(b.count / maxBucket) * 100}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-600">
                {b.count}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <BreakdownTable title="By rig" groups={byRig} />
        <BreakdownTable title="By diameter" groups={byDiameter} />
        <BreakdownTable title="By driller" groups={byDriller} />
      </div>

      <section className="card overflow-hidden">
        <h2 className="section-title px-4 pt-4">
          Largest additional volumes
        </h2>
        <p className="px-4 pb-2 pt-1 text-sm text-slate-500">
          Ranked by cubic metres, not percentage — a 6% overrun on a deep 1200 mm pile
          costs more than 30% on a short one.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Pile</th>
                <th className="px-4 py-2 text-right font-semibold">Ø mm</th>
                <th className="px-4 py-2 text-right font-semibold">Depth m</th>
                <th className="px-4 py-2 font-semibold">Rig</th>
                <th className="px-4 py-2 text-right font-semibold">Theo m³</th>
                <th className="px-4 py-2 text-right font-semibold">Actual m³</th>
                <th className="px-4 py-2 text-right font-semibold">Extra m³</th>
                <th className="px-4 py-2 text-right font-semibold">Overbreak</th>
              </tr>
            </thead>
            <tbody>
              {worst.map((r) => (
                <tr key={r.pile.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium">
                    <Link href={`/piles/${r.pile.id}`} className="underline">
                      {r.ref}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {r.pile.log?.asBuiltDiameterMm}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {num(r.pile.log?.toeDepthM)}
                  </td>
                  <td className="px-4 py-2">{r.rigName ?? "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{m3(r.theoreticalM3)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{m3(r.pouredM3)}</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">
                    {(r.overbreakM3 ?? 0) > 0 ? "+" : ""}
                    {m3(r.overbreakM3)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <OverbreakChip value={r.overbreakPct} band={r.band} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function BreakdownTable({
  title,
  groups,
}: {
  title: string;
  groups: { key: string; label: string; count: number; overbreakM3: number; overbreakPct: number }[];
}) {
  return (
    <section className="card overflow-hidden">
      <h2 className="section-title px-4 pt-4">{title}</h2>
      {groups.length === 0 ? (
        <p className="px-4 py-4 text-sm text-slate-500">Not recorded on any pile yet.</p>
      ) : (
        <table className="mt-2 w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 font-semibold">Group</th>
              <th className="px-4 py-2 text-right font-semibold">Piles</th>
              <th className="px-4 py-2 text-right font-semibold">Extra m³</th>
              <th className="px-4 py-2 text-right font-semibold">Avg</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.key} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{g.label}</td>
                <td className="px-4 py-2 text-right tabular-nums">{g.count}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {g.overbreakM3 > 0 ? "+" : ""}
                  {m3(g.overbreakM3, 1)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{pct(g.overbreakPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
