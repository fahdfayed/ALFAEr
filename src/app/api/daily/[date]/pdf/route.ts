import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getSite } from "@/lib/site";
import { getPileRowsForDate, totalise } from "@/lib/queries";
import { getDelayRows } from "@/lib/delayQueries";
import { dailyReportPdf } from "@/lib/pdf/dailyReport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new NextResponse("Expected a date as YYYY-MM-DD", { status: 400 });
  }
  const reportDate = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(reportDate.getTime())) {
    return new NextResponse("Invalid date", { status: 400 });
  }

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

  const pdf = await dailyReportPdf(
    site,
    reportDate,
    rows,
    totalise(rows),
    report,
    delays,
  );
  const filename = `DPR_${site.name.replace(/[^\w.-]+/g, "-")}_${date}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
