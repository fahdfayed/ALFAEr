import Link from "next/link";

import { getSite } from "@/lib/site";
import { getPileRows } from "@/lib/queries";
import { LayoutBoard, type BoardPile } from "@/components/LayoutBoard";
import { EmptyState } from "@/components/ui";
import { isoDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LayoutPage() {
  const site = await getSite();
  const rows = await getPileRows(site.id, {
    amberPct: site.overbreakAmberPct,
    redPct: site.overbreakRedPct,
  });

  const positioned: BoardPile[] = rows
    .filter((r) => r.pile.eastingM !== null && r.pile.northingM !== null)
    .map((r) => ({
      id: r.pile.id,
      ref: r.ref,
      status: r.status,
      eastingM: r.pile.eastingM as number,
      northingM: r.pile.northingM as number,
      diameterMm: r.pile.log?.asBuiltDiameterMm ?? r.pile.designDiameterMm,
      rigName: r.rigName,
      toeDepthM: r.pile.log?.toeDepthM ?? null,
      pouredM3: r.pouredM3,
      overbreakPct: r.overbreakPct,
      band: r.band,
      workDate: r.pile.log ? isoDate(r.pile.log.workDate) : null,
    }));

  const missingCoords = rows.length - positioned.length;
  const rigs = [...new Set(rows.map((r) => r.rigName).filter((n): n is string => !!n))].sort();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Layout progress</h1>
        <p className="mt-1 text-sm text-slate-500">
          The setting-out plan, coloured live. At handover this is the as-built
          pile map.
        </p>
      </div>

      {positioned.length === 0 ? (
        <EmptyState
          title="No pile coordinates yet"
          body="The board plots piles from their setting-out easting and northing. Import the pile schedule with coordinates to draw it."
          actionHref="/settings"
          actionLabel="Import pile schedule"
        />
      ) : (
        <>
          <LayoutBoard piles={positioned} rigs={rigs} />
          {missingCoords > 0 ? (
            <p className="text-sm text-amber-800">
              {missingCoords} pile{missingCoords === 1 ? " has" : "s have"} no
              coordinates and {missingCoords === 1 ? "is" : "are"} not shown.{" "}
              <Link href="/settings" className="underline">
                Import coordinates
              </Link>{" "}
              to place {missingCoords === 1 ? "it" : "them"}.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
