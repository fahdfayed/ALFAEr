import Link from "next/link";

import { prisma } from "@/lib/db";
import { requireAccess } from "@/lib/auth/access";
import { getPileRows, totalise } from "@/lib/queries";
import { EmptyState } from "@/components/ui";
import { isoDate, longDate, m3, num, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DailyReportsPage() {
  const { site } = await requireAccess();
  const thresholds = {
    amberPct: site.overbreakAmberPct,
    redPct: site.overbreakRedPct,
  };

  const rows = await getPileRows(site.id, thresholds, { log: { isNot: null } });

  // Group the logged piles by shift so every worked day gets a report row,
  // whether or not anyone has written the narrative yet.
  const byDate = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!r.pile.log) continue;
    const key = isoDate(r.pile.log.workDate);
    byDate.set(key, [...(byDate.get(key) ?? []), r]);
  }

  const dates = [...byDate.keys()].sort().reverse();
  const narratives = await prisma.dailyReport.findMany({
    where: { siteId: site.id },
    select: { reportDate: true, preparedBy: true },
  });
  const hasNarrative = new Set(narratives.map((n) => isoDate(n.reportDate)));

  const today = isoDate(new Date());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daily reports</h1>
          <p className="mt-1 text-sm text-slate-500">
            One row per worked shift, built from the pile logs.
          </p>
        </div>
        <Link href={`/daily/${today}`} className="btn-primary no-print">
          Today&rsquo;s report
        </Link>
      </div>

      {dates.length === 0 ? (
        <EmptyState
          title="No shifts logged"
          body="Daily reports assemble themselves from pile logs. Log the first pile and its shift appears here."
          actionHref="/piles/new"
          actionLabel="Log a pile"
        />
      ) : (
        <div className="card divide-y divide-slate-100">
          {dates.map((d) => {
            const dayRows = byDate.get(d) ?? [];
            const totals = totalise(dayRows);
            return (
              <Link
                key={d}
                href={`/daily/${d}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
              >
                <div>
                  <p className="font-medium">{longDate(d)}</p>
                  <p className="text-xs text-slate-500">
                    {dayRows.length} pile{dayRows.length === 1 ? "" : "s"} ·{" "}
                    {num(totals.drilledM, 1)} m drilled · {m3(totals.pouredM3, 1)} m³ ·{" "}
                    {pct(totals.overbreakPct)} overbreak
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                    hasNarrative.has(d)
                      ? "bg-emerald-100 text-emerald-800 ring-emerald-300"
                      : "bg-slate-100 text-slate-600 ring-slate-300"
                  }`}
                >
                  {hasNarrative.has(d) ? "Narrative added" : "Production only"}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
