import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { requireAccess } from "@/lib/auth/access";
import { toRow } from "@/lib/queries";
import { auditValue, fieldLabel, type ChangeSet } from "@/lib/audit";
import { BAND_LABEL } from "@/lib/concrete";
import { DataRow, OverbreakChip, Panel, StatusChip } from "@/components/ui";
import {
  clockTime,
  duration,
  isoDate,
  longDate,
  m3,
  num,
  pct,
  text,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PileDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const access = await requireAccess();
  const site = access.site;

  const pile = await prisma.pile.findFirst({
    where: { id, siteId: site.id },
    include: {
      log: {
        include: {
          rig: { select: { name: true } },
          driller: { select: { name: true } },
          loads: { orderBy: { sequence: "asc" } },
        },
      },
    },
  });
  if (!pile) notFound();

  const history = await prisma.auditEntry.findMany({
    where: {
      siteId: site.id,
      entity: { in: ["PileLog", "Pile"] },
      entityId: pile.id,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const row = toRow(pile, {
    amberPct: site.overbreakAmberPct,
    redPct: site.overbreakRedPct,
  });
  const log = pile.log;

  return (
    <div className="space-y-5">
      {saved ? (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Pile log saved. It is now on the daily report, the overbreak dashboard
          and the layout board.
        </p>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Pile {pile.ref}</h1>
            <StatusChip status={pile.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Ø{pile.designDiameterMm} mm design · {num(pile.designToeDepthM)} m design toe
            {pile.gridRef ? ` · grid ${pile.gridRef}` : ""}
          </p>
        </div>
        <div className="no-print flex gap-2">
          {access.can("recordWork") ? (
            <Link href={`/piles/${pile.id}/edit`} className="btn-secondary">
              {log ? "Edit log" : "Add log"}
            </Link>
          ) : null}
          {log ? (
            <a
              href={`/api/piles/${pile.id}/pdf`}
              className="btn-primary"
              target="_blank"
              rel="noreferrer"
            >
              Pile log PDF
            </a>
          ) : null}
        </div>
      </div>

      {!log ? (
        <div className="card p-8 text-center">
          <p className="font-semibold">No as-built record yet</p>
          <p className="mt-1 text-sm text-slate-500">
            This pile is on the schedule but nothing has been logged against it.
          </p>
          {access.can("recordWork") ? (
            <Link href={`/piles/${pile.id}/edit`} className="btn-primary mt-4">
              Fill in the log
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="card p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Theoretical</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {m3(row.theoreticalM3)}
                <span className="ml-1 text-sm font-normal text-slate-500">m³</span>
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Poured</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {m3(row.pouredM3)}
                <span className="ml-1 text-sm font-normal text-slate-500">m³</span>
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Variance</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {row.overbreakM3 !== null && row.overbreakM3 > 0 ? "+" : ""}
                {m3(row.overbreakM3)}
                <span className="ml-1 text-sm font-normal text-slate-500">m³</span>
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Overbreak</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{pct(row.overbreakPct)}</p>
              <p className="mt-1 text-xs text-slate-500">
                {row.band ? BAND_LABEL[row.band] : ""}
              </p>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Shift">
              <DataRow label="Work date" value={longDate(log.workDate)} />
              <DataRow label="Rig" value={text(log.rig?.name)} />
              <DataRow label="Driller" value={text(log.driller?.name)} />
              <DataRow label="Weather" value={text(log.weather)} />
            </Panel>

            <Panel title="Bore">
              <DataRow label="Started" value={clockTime(log.boreStartedAt)} />
              <DataRow label="Finished" value={clockTime(log.boreFinishedAt)} />
              <DataRow
                label="Boring time"
                value={duration(log.boreStartedAt, log.boreFinishedAt)}
              />
              <DataRow label="As-built diameter" value={`${log.asBuiltDiameterMm} mm`} />
              <DataRow label="Toe depth" value={`${num(log.toeDepthM)} m`} />
              <DataRow label="Platform level" value={num(log.platformLevelM, 3)} />
              <DataRow label="Cut-off level" value={num(log.cutoffLevelM, 3)} />
              <DataRow
                label="Water strike"
                value={log.waterStrikeDepthM === null ? "None" : `${num(log.waterStrikeDepthM)} m`}
              />
              <DataRow
                label="Verticality"
                value={log.verticalityPct === null ? "—" : `${num(log.verticalityPct)} %`}
              />
            </Panel>

            <Panel title="Casing">
              <DataRow label="Depth" value={log.casingDepthM === null ? "—" : `${num(log.casingDepthM)} m`} />
              <DataRow
                label="Diameter"
                value={log.casingDiameterMm === null ? "—" : `${log.casingDiameterMm} mm`}
              />
              <DataRow label="Type" value={text(log.casingType)} />
            </Panel>

            <Panel title="Reinforcement cage">
              <DataRow label="Mark" value={text(log.cageMark)} />
              <DataRow label="Length" value={log.cageLengthM === null ? "—" : `${num(log.cageLengthM)} m`} />
              <DataRow
                label="Diameter"
                value={log.cageDiameterMm === null ? "—" : `${log.cageDiameterMm} mm`}
              />
              <DataRow label="Main bars" value={text(log.cageMainBars)} />
              <DataRow label="Links" value={text(log.cageLinks)} />
              <DataRow
                label="Top of cage"
                value={log.cageTopDepthM === null ? "—" : `${num(log.cageTopDepthM)} m`}
              />
              <DataRow label="Installed" value={clockTime(log.cageInstalledAt)} />
            </Panel>

            <Panel title="Concrete">
              <DataRow label="Grade" value={text(log.concreteGrade)} />
              <DataRow label="Mix reference" value={text(log.concreteMixRef)} />
              <DataRow label="Pour started" value={clockTime(log.concreteStartedAt)} />
              <DataRow label="Pour finished" value={clockTime(log.concreteFinishedAt)} />
              <DataRow
                label="Pour time"
                value={duration(log.concreteStartedAt, log.concreteFinishedAt)}
              />
              <DataRow label="Slump" value={log.slumpMm === null ? "—" : `${log.slumpMm} mm`} />
              <DataRow label="Cubes taken" value={log.cubesTaken ?? 0} />
              <DataRow
                label="Concreted length"
                value={`${num(log.toeDepthM - log.concreteTopDepthM)} m`}
              />
            </Panel>

            <Panel title="Ground &amp; remarks">
              <DataRow label="Strata" value={text(log.strata)} />
              <DataRow label="Remarks" value={text(log.remarks)} />
            </Panel>
          </div>

          {log.loads.length > 0 ? (
            <section className="card overflow-hidden">
              <h2 className="section-title px-4 pt-4">Load tickets</h2>
              <div className="overflow-x-auto">
                <table className="mt-2 w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Ticket</th>
                      <th className="px-4 py-2 font-semibold">Arrived</th>
                      <th className="px-4 py-2 text-right font-semibold">Volume (m³)</th>
                      <th className="px-4 py-2 text-right font-semibold">Slump (mm)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {log.loads.map((l) => (
                      <tr key={l.id} className="border-t border-slate-100">
                        <td className="px-4 py-2">{text(l.ticketRef)}</td>
                        <td className="px-4 py-2">{clockTime(l.arrivedAt)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{m3(l.volumeM3)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{l.slumpMm ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                      <td className="px-4 py-2" colSpan={2}>
                        Total
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {m3(log.loads.reduce((s, l) => s + l.volumeM3, 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          ) : null}

          <section className="card p-4">
            <h2 className="section-title">History</h2>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                Nothing recorded against this pile yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {history.map((h) => {
                  const changes = (h.changes ?? null) as ChangeSet | null;
                  const fields = changes ? Object.entries(changes) : [];
                  return (
                    <li key={h.id} className="border-l-2 border-slate-200 pl-3">
                      <p className="text-sm">
                        <span className="font-medium">{h.actorName}</span>{" "}
                        <span className="text-slate-500">
                          {h.action === "CREATE"
                            ? "created the record"
                            : h.action === "DELETE"
                              ? "deleted the record"
                              : "updated the record"}{" "}
                          · {h.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                        </span>
                      </p>
                      {h.reason ? (
                        <p className="text-sm italic text-slate-600">{h.reason}</p>
                      ) : null}
                      {fields.length > 0 ? (
                        <ul className="mt-1 space-y-0.5 text-xs">
                          {fields.slice(0, 12).map(([field, change]) => (
                            <li key={field} className="flex flex-wrap gap-1.5">
                              <span className="text-slate-500">{fieldLabel(field)}:</span>
                              <span className="text-red-700 line-through">
                                {auditValue(change.from)}
                              </span>
                              <span className="text-slate-400">→</span>
                              <span className="font-medium text-emerald-800">
                                {auditValue(change.to)}
                              </span>
                            </li>
                          ))}
                          {fields.length > 12 ? (
                            <li className="text-slate-400">
                              and {fields.length - 12} more field
                              {fields.length - 12 === 1 ? "" : "s"}
                            </li>
                          ) : null}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <p className="text-sm text-slate-500">
            On the{" "}
            <Link href={`/daily/${isoDate(log.workDate)}`} className="underline">
              daily report for {isoDate(log.workDate)}
            </Link>
            . Overbreak status:{" "}
            <OverbreakChip value={row.overbreakPct} band={row.band} />
          </p>
        </>
      )}
    </div>
  );
}
