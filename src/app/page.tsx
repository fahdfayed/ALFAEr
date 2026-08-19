import Link from "next/link";

import { requireAccess } from "@/lib/auth/access";
import { prisma } from "@/lib/db";
import { getPileRows, getPileRowsForDate, totalise, countByStatus } from "@/lib/queries";
import { OverbreakChip, Stat, StatusChip, EmptyState } from "@/components/ui";
import { isoDate, longDate, m3, num, pct } from "@/lib/format";
import { PILE_STATUSES, STATUS_LABEL } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const access = await requireAccess();
  const site = access.site;
  const thresholds = {
    amberPct: site.overbreakAmberPct,
    redPct: site.overbreakRedPct,
  };

  const today = new Date(`${isoDate(new Date())}T00:00:00Z`);

  const [todayRows, allRows, latestLogged] = await Promise.all([
    getPileRowsForDate(site.id, thresholds, today),
    getPileRows(site.id, thresholds),
    prisma.pileLog.findFirst({ orderBy: { workDate: "desc" }, select: { workDate: true } }),
  ]);

  const todayTotals = totalise(todayRows);
  const projectTotals = totalise(allRows);
  const statusCounts = countByStatus(allRows);

  const cast = allRows.filter((r) =>
    ["CAST", "TESTED", "ACCEPTED"].includes(r.status),
  ).length;
  const completePct = allRows.length > 0 ? (cast / allRows.length) * 100 : 0;

  const flagged = allRows
    .filter((r) => r.band === "red")
    .sort((a, b) => (b.overbreakPct ?? 0) - (a.overbreakPct ?? 0))
    .slice(0, 5);

  const projectTone =
    projectTotals.overbreakPct >= site.overbreakRedPct
      ? "bad"
      : projectTotals.overbreakPct >= site.overbreakAmberPct
        ? "warn"
        : "good";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{site.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {longDate(new Date())}
          {site.clientName ? ` · ${site.clientName}` : ""}
          {site.contractRef ? ` · ${site.contractRef}` : ""}
        </p>
      </div>

      <section>
        <h2 className="section-title">Today</h2>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Piles logged" value={todayTotals.count} />
          <Stat label="Metres drilled" value={num(todayTotals.drilledM, 1)} />
          <Stat label="Concrete placed" value={`${m3(todayTotals.pouredM3, 1)} m³`} />
          <Stat
            label="Overbreak today"
            value={todayTotals.count > 0 ? pct(todayTotals.overbreakPct) : "—"}
            tone={
              todayTotals.count === 0
                ? "neutral"
                : todayTotals.overbreakPct >= site.overbreakRedPct
                  ? "bad"
                  : todayTotals.overbreakPct >= site.overbreakAmberPct
                    ? "warn"
                    : "good"
            }
          />
        </div>
        <div className="no-print mt-3 flex flex-wrap gap-2">
          {access.can("recordWork") ? (
            <Link href="/piles/new" className="btn-primary">
              Log a pile
            </Link>
          ) : null}
          <Link href={`/daily/${isoDate(today)}`} className="btn-secondary">
            Today&rsquo;s report
          </Link>
          {latestLogged && isoDate(latestLogged.workDate) !== isoDate(today) ? (
            <Link href={`/daily/${isoDate(latestLogged.workDate)}`} className="btn-secondary">
              Last shift: {isoDate(latestLogged.workDate)}
            </Link>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="section-title">Project</h2>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Progress"
            value={`${completePct.toFixed(0)}%`}
            sub={`${cast} of ${allRows.length} piles cast or beyond`}
            href="/layout"
          />
          <Stat
            label="Concrete placed"
            value={`${m3(projectTotals.pouredM3, 0)} m³`}
            sub={`theoretical ${m3(projectTotals.theoreticalM3, 0)} m³`}
            href="/overbreak"
          />
          <Stat
            label="Additional concrete"
            value={`${projectTotals.overbreakM3 > 0 ? "+" : ""}${m3(projectTotals.overbreakM3, 0)} m³`}
            sub="beyond theoretical"
            href="/overbreak"
            tone={projectTone}
          />
          <Stat
            label="Average overbreak"
            value={projectTotals.count > 0 ? pct(projectTotals.overbreakPct) : "—"}
            sub={`amber ${site.overbreakAmberPct}% · red ${site.overbreakRedPct}%`}
            href="/overbreak"
            tone={projectTone}
          />
        </div>
      </section>

      <section>
        <h2 className="section-title">Status breakdown</h2>
        <div className="card mt-2 flex flex-wrap gap-4 p-4">
          {allRows.length === 0 ? (
            <p className="text-sm text-slate-500">
              No piles yet. Import a schedule in{" "}
              <Link href="/settings" className="underline">
                Settings
              </Link>
              .
            </p>
          ) : (
            PILE_STATUSES.map((s) => (
              <Link
                key={s}
                href={`/piles?status=${s}`}
                className="min-w-24 rounded-lg px-2 py-1 hover:bg-slate-50"
              >
                <p className="text-2xl font-bold tabular-nums">{statusCounts[s] ?? 0}</p>
                <p className="text-xs text-slate-500">{STATUS_LABEL[s]}</p>
              </Link>
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="section-title">Needs attention</h2>
        <div className="mt-2">
          {flagged.length === 0 ? (
            <div className="card p-4 text-sm text-slate-500">
              No piles above the {site.overbreakRedPct}% overbreak threshold.
            </div>
          ) : (
            <div className="card divide-y divide-slate-100">
              {flagged.map((r) => (
                <Link
                  key={r.pile.id}
                  href={`/piles/${r.pile.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
                >
                  <div>
                    <p className="font-medium">Pile {r.ref}</p>
                    <p className="text-xs text-slate-500">
                      {m3(r.pouredM3)} m³ placed vs {m3(r.theoreticalM3)} m³ theoretical
                      {r.rigName ? ` · ${r.rigName}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusChip status={r.status} />
                    <OverbreakChip value={r.overbreakPct} band={r.band} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {allRows.length === 0 ? (
        <EmptyState
          title="Nothing logged yet"
          body="Set the site name and thresholds, add your rigs and drillers, and import the pile schedule. Then the rig crew can start logging."
          actionHref="/settings"
          actionLabel="Open settings"
        />
      ) : null}
    </div>
  );
}
