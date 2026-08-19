import Link from "next/link";
import type { Prisma, PileStatus } from "@prisma/client";

import { requireAccess } from "@/lib/auth/access";
import { prisma } from "@/lib/db";
import { getPileRows, totalise } from "@/lib/queries";
import { OverbreakChip, StatusChip, EmptyState } from "@/components/ui";
import { PILE_STATUSES, STATUS_LABEL } from "@/lib/status";
import { isoDate, m3, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PileRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; rig?: string; q?: string; flagged?: string }>;
}) {
  const sp = await searchParams;
  const { site } = await requireAccess();
  const thresholds = {
    amberPct: site.overbreakAmberPct,
    redPct: site.overbreakRedPct,
  };

  const where: Prisma.PileWhereInput = {};
  if (sp.status && (PILE_STATUSES as string[]).includes(sp.status)) {
    where.status = sp.status as PileStatus;
  }
  if (sp.rig) where.log = { is: { rigId: sp.rig } };
  if (sp.q) where.ref = { contains: sp.q, mode: "insensitive" };

  const [rowsRaw, rigs] = await Promise.all([
    getPileRows(site.id, thresholds, where),
    prisma.rig.findMany({
      where: { siteId: site.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const rows =
    sp.flagged === "1"
      ? rowsRaw.filter((r) => r.band === "red" || r.band === "amber" || r.band === "under")
      : rowsRaw;
  const totals = totalise(rows);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pile register</h1>
          <p className="mt-1 text-sm text-slate-500">
            {rows.length} pile{rows.length === 1 ? "" : "s"} · {totals.count} logged ·{" "}
            {m3(totals.drilledM, 1)} m drilled · {m3(totals.pouredM3)} m³ placed
          </p>
        </div>
        <Link href="/piles/new" className="btn-primary no-print">
          + Pile log
        </Link>
      </div>

      <form className="card no-print grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
        <label className="block">
          <span className="label">Search ref</span>
          <input name="q" className="field" defaultValue={sp.q ?? ""} placeholder="P-1" />
        </label>
        <label className="block">
          <span className="label">Status</span>
          <select name="status" className="field" defaultValue={sp.status ?? ""}>
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
          <select name="rig" className="field" defaultValue={sp.rig ?? ""}>
            <option value="">All</option>
            {rigs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Overbreak</span>
          <select name="flagged" className="field" defaultValue={sp.flagged ?? ""}>
            <option value="">All</option>
            <option value="1">Flagged only</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className="btn-primary w-full">
            Apply
          </button>
          <Link href="/piles" className="btn-secondary">
            Clear
          </Link>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title="No piles match"
          body="Import a pile schedule in Settings, or log the first pile straight from the rig."
          actionHref="/piles/new"
          actionLabel="Log a pile"
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Pile</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 text-right font-semibold">Ø mm</th>
                <th className="px-3 py-2 text-right font-semibold">Design m</th>
                <th className="px-3 py-2 text-right font-semibold">Actual m</th>
                <th className="px-3 py-2 font-semibold">Rig</th>
                <th className="px-3 py-2 text-right font-semibold">Theo m³</th>
                <th className="px-3 py-2 text-right font-semibold">Poured m³</th>
                <th className="px-3 py-2 text-right font-semibold">Overbreak</th>
                <th className="px-3 py-2 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.pile.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/piles/${r.pile.id}`} className="text-slate-900 underline">
                      {r.ref}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <StatusChip status={r.status} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.pile.log?.asBuiltDiameterMm ?? r.pile.designDiameterMm}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {num(r.pile.designToeDepthM, 2)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.pile.log ? num(r.pile.log.toeDepthM, 2) : "—"}
                  </td>
                  <td className="px-3 py-2">{r.rigName ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{m3(r.theoreticalM3)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{m3(r.pouredM3)}</td>
                  <td className="px-3 py-2 text-right">
                    <OverbreakChip value={r.overbreakPct} band={r.band} />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                    {r.pile.log ? isoDate(r.pile.log.workDate) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
