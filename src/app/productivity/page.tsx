import Link from "next/link";

import { requireAccess } from "@/lib/auth/access";
import { getPileRows } from "@/lib/queries";
import { getDelayRows } from "@/lib/delayQueries";
import { drillRateByDiameter, rigProductivity } from "@/lib/productivity";
import { EmptyState, Stat } from "@/components/ui";
import { isoDate, num } from "@/lib/format";

export const dynamic = "force-dynamic";

const RANGES = [
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "all", label: "Whole contract", days: null },
];

const dash = (v: number | null, suffix = "") =>
  v === null ? "—" : `${v}${suffix}`;

export default async function ProductivityPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const { site } = await requireAccess();
  const range = RANGES.find((r) => r.key === sp.range) ?? RANGES[1];
  const from = range.days
    ? new Date(`${isoDate(new Date(Date.now() - range.days * 86400000))}T00:00:00Z`)
    : null;

  const [pileRows, delayRows] = await Promise.all([
    getPileRows(
      site.id,
      { amberPct: site.overbreakAmberPct, redPct: site.overbreakRedPct },
      from ? { log: { is: { workDate: { gte: from } } } } : { log: { isNot: null } },
    ),
    getDelayRows(site.id, from ? { workDate: { gte: from } } : {}),
  ]);

  const rigs = rigProductivity(pileRows, delayRows, site.shiftHours);
  const byDiameter = drillRateByDiameter(pileRows);

  if (rigs.length === 0) {
    return (
      <EmptyState
        title="Nothing to measure yet"
        body="Productivity is derived from the bore and pour times on the pile logs. Log a few piles with times against a rig and the figures appear here."
        actionHref="/piles/new"
        actionLabel="Log a pile"
      />
    );
  }

  const totalPiles = rigs.reduce((s, r) => s + r.piles, 0);
  const totalMetres = rigs.reduce((s, r) => s + r.metresDrilled, 0);
  const totalBoring = rigs.reduce((s, r) => s + r.boringHours, 0);
  const totalDelay = rigs.reduce((s, r) => s + r.delayHours, 0);
  const shifts = new Set(
    pileRows.filter((r) => r.pile.log).map((r) => isoDate(r.pile.log!.workDate)),
  ).size;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Rig productivity</h1>
        <p className="mt-1 text-sm text-slate-500">
          Derived from the times already on the pile logs. Nothing here is typed
          in, so nothing here is arguable.
        </p>
      </div>

      <nav className="no-print flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/productivity?range=${r.key}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              r.key === range.key
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-100"
            }`}
          >
            {r.label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Piles" value={totalPiles} sub={`over ${shifts} shift${shifts === 1 ? "" : "s"}`} />
        <Stat label="Metres drilled" value={num(totalMetres, 0)} />
        <Stat
          label="Site rate"
          value={totalBoring > 0 ? `${(totalMetres / totalBoring).toFixed(2)} m/hr` : "—"}
          sub="while boring"
        />
        <Stat
          label="Piles / day"
          value={shifts > 0 ? (totalPiles / shifts).toFixed(1) : "—"}
        />
        <Stat
          label="Lost to delays"
          value={`${totalDelay.toFixed(1)} hrs`}
          tone={totalDelay > 0 ? "warn" : "good"}
          href="/delays"
        />
      </div>

      <section className="card overflow-hidden">
        <h2 className="section-title px-4 pt-4">By rig</h2>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Rig</th>
                <th className="px-4 py-2 text-right font-semibold">Piles</th>
                <th className="px-4 py-2 text-right font-semibold">Shifts</th>
                <th className="px-4 py-2 text-right font-semibold">Metres</th>
                <th className="px-4 py-2 text-right font-semibold">m/hr</th>
                <th className="px-4 py-2 text-right font-semibold">Piles/day</th>
                <th className="px-4 py-2 text-right font-semibold">Avg cycle</th>
                <th className="px-4 py-2 text-right font-semibold">Wait for concrete</th>
                <th className="px-4 py-2 text-right font-semibold">Boring hrs</th>
                <th className="px-4 py-2 text-right font-semibold">Delay hrs</th>
                <th className="px-4 py-2 text-right font-semibold">Utilisation</th>
                <th className="px-4 py-2 text-right font-semibold">Delay share</th>
              </tr>
            </thead>
            <tbody>
              {rigs.map((r) => (
                <tr key={r.rigName} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium">{r.rigName}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.piles}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.shifts}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.metresDrilled}</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">
                    {dash(r.metresPerHour)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{dash(r.pilesPerDay)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {dash(r.averageCycleHours, " h")}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {dash(r.averageWaitForConcreteHours, " h")}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.boringHours}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {r.delayHours > 0 ? r.delayHours : "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">
                    {dash(r.utilisationPct, "%")}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {dash(r.delaySharePct, "%")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-3 text-xs text-slate-500">
          Utilisation is boring hours against the planned shift ({site.shiftHours} h
          per rig per shift, set in Settings). It is deliberately not based on
          full pile cycles: a rig bores the next pile while the last is being
          concreted, so cycles overlap and a cycle-based figure flatters every
          busy job.
        </p>
      </section>

      <section className="card overflow-hidden">
        <h2 className="section-title px-4 pt-4">Drilling rate by diameter</h2>
        <p className="px-4 pb-2 pt-1 text-sm text-slate-500">
          The figures a future tender should be priced from, rather than from
          memory.
        </p>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 font-semibold">Diameter</th>
              <th className="px-4 py-2 text-right font-semibold">Piles</th>
              <th className="px-4 py-2 text-right font-semibold">Metres</th>
              <th className="px-4 py-2 text-right font-semibold">Boring hours</th>
              <th className="px-4 py-2 text-right font-semibold">m/hr</th>
            </tr>
          </thead>
          <tbody>
            {byDiameter.map((g) => (
              <tr key={g.diameterMm} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">Ø{g.diameterMm} mm</td>
                <td className="px-4 py-2 text-right tabular-nums">{g.piles}</td>
                <td className="px-4 py-2 text-right tabular-nums">{g.metres}</td>
                <td className="px-4 py-2 text-right tabular-nums">{g.hours}</td>
                <td className="px-4 py-2 text-right font-medium tabular-nums">
                  {g.metresPerHour}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
