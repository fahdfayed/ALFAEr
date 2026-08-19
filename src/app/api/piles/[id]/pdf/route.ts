import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAccess } from "@/lib/auth/access";
import { toRow } from "@/lib/queries";
import { pileLogPdf } from "@/lib/pdf/pileLog";
import { isoDate } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { site } = await requireAccess();

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

  if (!pile) return new NextResponse("Pile not found", { status: 404 });
  if (!pile.log) {
    return new NextResponse("This pile has no as-built record yet", { status: 409 });
  }

  const row = toRow(pile, {
    amberPct: site.overbreakAmberPct,
    redPct: site.overbreakRedPct,
  });
  const pdf = await pileLogPdf(site, row);
  const filename = `PileLog_${pile.ref.replace(/[^\w.-]+/g, "-")}_${isoDate(pile.log.workDate)}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
