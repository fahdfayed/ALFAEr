import Link from "next/link";

import { getSite } from "@/lib/site";
import { getDelayRows, groupLostTime, totalMinutes } from "@/lib/delayQueries";
import { CATEGORY_COLOR, CATEGORY_LABEL, formatHours, toHours } from "@/lib/delays";
import { EndDelayButton } from "@/components/EndDelayButton";
import { EmptyState, Stat } from "@/components/ui";
import { clockTime, isoDate, longDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const RANGES = [
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
  { key: "all", label: "Whole contract", days: null },
];

export default async function DelaysPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; saved?: string }>;
}) {
  const sp = await searchParams;
  const site = await getSite();

  const range = RANGES.find((r) => r.key === sp.range) ?? RANGES[1];
  const from = range.days
    ? new Date(`${isoDate(new Date(Date.now() - range.days * 86400000))}T00:00:00Z`)
    : null;

  const rows = await getDelayRows(site.id, from ? { workDate: { gte: from } } : {});

  const open = rows.filter((r) => r.open);
  const total = totalMinutes(rows);
  const byCategory = groupLostTime(rows, (r) => ({
    key: r.delay.category,
    label: CATEGORY_LABEL[r.delay.category],
  }));
  const byRig = groupLostTime(rows, (r) =>
    r.rigName ? { key: r.rigName, label: r.rigName } : { key: "__site", label: "Site-wide" },
  );
  const byReason = groupLostTime(rows, (r) => ({
    key: `${r.delay.category}:${r.delay.reason}`,
    label: r.delay.reason,
  })).slice(0, 8);

  const maxCategory = Math.max(...byCategory.map((g) => g.minutes), 1);

  return (
    <div className="space-y-6">
      {sp.saved ? (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Delay recorded. It is on the daily report and the totals below.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lost time</h1>
          <p className="mt-1 text-sm text-slate-500">
            What stopped production, for how long, and where it came from.
          </p>
        </div>
        <Link href="/delays/new" className="btn-primary no-print">
          + Record delay
        </Link>
      </div>

      <nav className="no-print flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/delays?range=${r.key}`}
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

      {rows.length === 0 ? (
        <EmptyState
          title="No delays recorded"
          body="Every stoppage recorded here turns a site complaint into a number you can put in front of a client."
          actionHref="/delays/new"
          actionLabel="Record a delay"
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total lost" value={`${toHours(total)} hrs`} sub={range.label.toLowerCase()} />
            <Stat label="Events" value={rows.length} />
            <Stat
              label="Still open"
              value={open.length}
              tone={open.length > 0 ? "warn" : "good"}
            />
            <Stat
              label="Biggest cause"
              value={byCategory[0] ? byCategory[0].label : "—"}
              sub={byCategory[0] ? `${toHours(byCategory[0].minutes)} hrs` : undefined}
              tone="bad"
            />
          </div>

          {open.length > 0 ? (
            <section className="card border-amber-300 bg-amber-50 p-4">
              <h2 className="section-title text-amber-900">Ongoing right now</h2>
              <ul className="mt-3 space-y-2">
                {open.map((r) => (
                  <li
                    key={r.delay.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-3 py-2"
                  >
                    <div>
                      <p className="font-medium">
                        {r.delay.reason}
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          {CATEGORY_LABEL[r.delay.category]}
                          {r.rigName ? ` · ${r.rigName}` : ""}
                          {r.pileRef ? ` · ${r.pileRef}` : ""}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500">
                        Since {clockTime(r.delay.startedAt)} · {formatHours(r.minutes)} so far
                      </p>
                    </div>
                    <EndDelayButton id={r.delay.id} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="card p-4">
            <h2 className="section-title">Lost hours by cause</h2>
            <div className="mt-3 space-y-2">
              {byCategory.map((g) => (
                <div key={g.key} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-right text-xs text-slate-600">
                    {g.label}
                  </span>
                  <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
                    <div
                      className="h-full"
                      style={{
                        width: `${(g.minutes / maxCategory) * 100}%`,
                        background:
                          CATEGORY_COLOR[g.key as keyof typeof CATEGORY_COLOR] ?? "#64748b",
                      }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right text-xs tabular-nums text-slate-700">
                    {toHours(g.minutes)} hrs
                  </span>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card overflow-hidden">
              <h2 className="section-title px-4 pt-4">Top reasons</h2>
              <table className="mt-2 w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Reason</th>
                    <th className="px-4 py-2 text-right font-semibold">Events</th>
                    <th className="px-4 py-2 text-right font-semibold">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {byReason.map((g) => (
                    <tr key={g.key} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-medium">{g.label}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{g.count}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {toHours(g.minutes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="card overflow-hidden">
              <h2 className="section-title px-4 pt-4">By rig</h2>
              <table className="mt-2 w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Rig</th>
                    <th className="px-4 py-2 text-right font-semibold">Events</th>
                    <th className="px-4 py-2 text-right font-semibold">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {byRig.map((g) => (
                    <tr key={g.key} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-medium">{g.label}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{g.count}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {toHours(g.minutes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <section className="card overflow-hidden">
            <h2 className="section-title px-4 pt-4">Delay log</h2>
            <div className="overflow-x-auto">
              <table className="mt-2 w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Shift</th>
                    <th className="px-4 py-2 font-semibold">Cause</th>
                    <th className="px-4 py-2 font-semibold">Reason</th>
                    <th className="px-4 py-2 font-semibold">Rig</th>
                    <th className="px-4 py-2 font-semibold">Pile</th>
                    <th className="px-4 py-2 font-semibold">From</th>
                    <th className="px-4 py-2 font-semibold">To</th>
                    <th className="px-4 py-2 text-right font-semibold">Lost</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 60).map((r) => (
                    <tr key={r.delay.id} className="border-t border-slate-100">
                      <td className="px-4 py-2 whitespace-nowrap text-slate-500">
                        {isoDate(r.delay.workDate)}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                          style={{ background: CATEGORY_COLOR[r.delay.category] }}
                        />
                        {CATEGORY_LABEL[r.delay.category]}
                      </td>
                      <td className="px-4 py-2 font-medium">{r.delay.reason}</td>
                      <td className="px-4 py-2">{r.rigName ?? "Site"}</td>
                      <td className="px-4 py-2">{r.pileRef ?? "—"}</td>
                      <td className="px-4 py-2">{clockTime(r.delay.startedAt)}</td>
                      <td className="px-4 py-2">
                        {r.open ? (
                          <span className="font-medium text-amber-700">ongoing</span>
                        ) : (
                          clockTime(r.delay.endedAt)
                        )}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatHours(r.minutes)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link
                          href={`/delays/${r.delay.id}/edit`}
                          className="text-xs underline"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 60 ? (
              <p className="px-4 py-3 text-xs text-slate-500">
                Showing the 60 most recent of {rows.length} in {longDate(from ?? new Date())}
                &nbsp;onwards.
              </p>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
