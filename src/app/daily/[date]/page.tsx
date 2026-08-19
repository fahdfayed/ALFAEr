import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { getSite } from "@/lib/site";
import { getPileRowsForDate, totalise } from "@/lib/queries";
import { getDelayRows, totalMinutes } from "@/lib/delayQueries";
import { CATEGORY_COLOR, CATEGORY_LABEL, formatHours, toHours } from "@/lib/delays";
import { DailyReportForm } from "@/components/DailyReportForm";
import { OverbreakChip, Stat, StatusChip } from "@/components/ui";
import { clockTime, isoDate, longDate, m3, num, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default async function DailyReportPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const reportDate = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(reportDate.getTime())) notFound();

  const site = await getSite();
  const thresholds = {
    amberPct: site.overbreakAmberPct,
    redPct: site.overbreakRedPct,
  };

  const [rows, report, delays] = await Promise.all([
    getPileRowsForDate(site.id, thresholds, reportDate),
    prisma.dailyReport.findUnique({
      where: { siteId_reportDate: { siteId: site.id, reportDate } },
    }),
    getDelayRows(site.id, { workDate: reportDate }),
  ]);

  const lostMinutes = totalMinutes(delays);

  const totals = totalise(rows);
  const bored = rows.filter((r) => r.pile.log?.boreFinishedAt).length;
  const cast = rows.filter((r) => r.pile.log?.concreteFinishedAt).length;

  const prev = isoDate(new Date(reportDate.getTime() - 86400000));
  const next = isoDate(new Date(reportDate.getTime() + 86400000));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daily site report</h1>
          <p className="mt-1 text-sm text-slate-500">{longDate(reportDate)}</p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Link href={`/daily/${prev}`} className="btn-secondary">
            ← {prev}
          </Link>
          <Link href={`/daily/${next}`} className="btn-secondary">
            {next} →
          </Link>
          <a
            href={`/api/daily/${date}/pdf`}
            className="btn-primary"
            target="_blank"
            rel="noreferrer"
          >
            Daily report PDF
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Piles worked" value={rows.length} />
        <Stat label="Bores completed" value={bored} />
        <Stat label="Piles cast" value={cast} />
        <Stat label="Metres drilled" value={num(totals.drilledM, 1)} />
        <Stat
          label="Lost time"
          value={delays.length > 0 ? `${toHours(lostMinutes)} hrs` : "—"}
          sub={delays.length > 0 ? `${delays.length} event(s)` : undefined}
          tone={lostMinutes > 0 ? "warn" : "neutral"}
          href="/delays"
        />
        <Stat
          label="Concrete"
          value={`${m3(totals.pouredM3, 1)} m³`}
          sub={totals.count > 0 ? `${pct(totals.overbreakPct)} overbreak` : undefined}
        />
      </div>

      {rows.length === 0 ? (
        <div className="card p-6 text-center text-sm text-slate-500">
          No piles logged against this date.{" "}
          <Link href="/piles/new" className="underline">
            Log one
          </Link>
          .
        </div>
      ) : (
        <section className="card overflow-hidden">
          <h2 className="section-title px-4 pt-4">Pile production</h2>
          <div className="overflow-x-auto">
            <table className="mt-2 w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-semibold">Pile</th>
                  <th className="px-4 py-2 font-semibold">Rig</th>
                  <th className="px-4 py-2 font-semibold">Driller</th>
                  <th className="px-4 py-2 text-right font-semibold">Ø mm</th>
                  <th className="px-4 py-2 text-right font-semibold">Depth m</th>
                  <th className="px-4 py-2 font-semibold">Bore</th>
                  <th className="px-4 py-2 font-semibold">Pour</th>
                  <th className="px-4 py-2 text-right font-semibold">m³</th>
                  <th className="px-4 py-2 text-right font-semibold">Overbreak</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.pile.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-medium">
                      <Link href={`/piles/${r.pile.id}`} className="underline">
                        {r.ref}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{r.rigName ?? "—"}</td>
                    <td className="px-4 py-2">{r.drillerName ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {r.pile.log?.asBuiltDiameterMm}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {num(r.pile.log?.toeDepthM)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-slate-600">
                      {clockTime(r.pile.log?.boreStartedAt)}–
                      {clockTime(r.pile.log?.boreFinishedAt)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-slate-600">
                      {clockTime(r.pile.log?.concreteStartedAt)}–
                      {clockTime(r.pile.log?.concreteFinishedAt)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{m3(r.pouredM3)}</td>
                    <td className="px-4 py-2 text-right">
                      <OverbreakChip value={r.overbreakPct} band={r.band} />
                    </td>
                    <td className="px-4 py-2">
                      <StatusChip status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                  <td className="px-4 py-2" colSpan={4}>
                    Totals
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {num(totals.drilledM, 1)}
                  </td>
                  <td colSpan={2} />
                  <td className="px-4 py-2 text-right tabular-nums">
                    {m3(totals.pouredM3)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {pct(totals.overbreakPct)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
          <h2 className="section-title">Delays</h2>
          <Link href="/delays/new" className="btn-secondary no-print !px-3 !py-1.5 text-xs">
            + Record delay
          </Link>
        </div>
        {delays.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">
            No delays recorded against this shift.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="mt-2 w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-semibold">Cause</th>
                  <th className="px-4 py-2 font-semibold">Reason</th>
                  <th className="px-4 py-2 font-semibold">Rig</th>
                  <th className="px-4 py-2 font-semibold">Pile</th>
                  <th className="px-4 py-2 font-semibold">From</th>
                  <th className="px-4 py-2 font-semibold">To</th>
                  <th className="px-4 py-2 text-right font-semibold">Lost</th>
                </tr>
              </thead>
              <tbody>
                {delays.map((d) => (
                  <tr key={d.delay.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">
                      <span
                        className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                        style={{ background: CATEGORY_COLOR[d.delay.category] }}
                      />
                      {CATEGORY_LABEL[d.delay.category]}
                    </td>
                    <td className="px-4 py-2 font-medium">{d.delay.reason}</td>
                    <td className="px-4 py-2">{d.rigName ?? "Site"}</td>
                    <td className="px-4 py-2">{d.pileRef ?? "—"}</td>
                    <td className="px-4 py-2">{clockTime(d.delay.startedAt)}</td>
                    <td className="px-4 py-2">
                      {d.open ? (
                        <span className="font-medium text-amber-700">ongoing</span>
                      ) : (
                        clockTime(d.delay.endedAt)
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatHours(d.minutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                  <td className="px-4 py-2" colSpan={6}>
                    Total lost
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatHours(lostMinutes)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <div className="no-print">
        <DailyReportForm
          reportDate={date}
          values={{
            weather: s(report?.weather),
            temperatureC: s(report?.temperatureC),
            personnelCount: s(report?.personnelCount),
            plantOnSite: s(report?.plantOnSite),
            delays: s(report?.delays),
            hseNotes: s(report?.hseNotes),
            visitors: s(report?.visitors),
            generalNotes: s(report?.generalNotes),
            preparedBy: s(report?.preparedBy),
          }}
        />
      </div>
    </div>
  );
}
