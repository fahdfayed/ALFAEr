import type { DailyReport, Site } from "@prisma/client";

import type { PileRow, Totals } from "@/lib/queries";
import { clockTime, isoDate, longDate, m3, num, pct, text } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/status";
import {
  keyValueGrid,
  header,
  paragraph,
  render,
  sectionTitle,
  signatureBlock,
  stampPageNumbers,
  table,
} from "@/lib/pdf/doc";

export function dailyReportPdf(
  site: Site,
  reportDate: Date,
  rows: PileRow[],
  totals: Totals,
  report: DailyReport | null,
): Promise<Buffer> {
  const bored = rows.filter((r) => r.pile.log?.boreFinishedAt).length;
  const cast = rows.filter((r) => r.pile.log?.concreteFinishedAt).length;

  return render((doc) => {
    header(doc, {
      title: "Daily Progress Report",
      siteName: site.name,
      subtitle: site.contractRef ?? undefined,
      meta: [
        site.clientName ? `Client: ${site.clientName}` : "",
        site.location ? `Location: ${site.location}` : "",
        longDate(reportDate),
      ].filter(Boolean),
    });

    sectionTitle(doc, "Shift summary");
    keyValueGrid(doc, [
      ["Piles worked", String(rows.length)],
      ["Bores completed", String(bored)],
      ["Piles cast", String(cast)],
      ["Metres drilled", `${num(totals.drilledM, 1)} m`],
      ["Concrete placed", `${m3(totals.pouredM3)} m³`],
      ["Theoretical concrete", `${m3(totals.theoreticalM3)} m³`],
      ["Additional concrete", `${totals.overbreakM3 > 0 ? "+" : ""}${m3(totals.overbreakM3)} m³`],
      ["Overbreak", totals.count > 0 ? pct(totals.overbreakPct) : "—"],
      ["Weather", text(report?.weather)],
      [
        "Temperature",
        report?.temperatureC === null || report?.temperatureC === undefined
          ? "—"
          : `${report.temperatureC} °C`,
      ],
      [
        "Personnel on site",
        report?.personnelCount === null || report?.personnelCount === undefined
          ? "—"
          : String(report.personnelCount),
      ],
    ]);

    sectionTitle(doc, "Pile production");
    if (rows.length === 0) {
      paragraph(doc, "", "No piles were logged against this shift.");
    } else {
      table(
        doc,
        [
          { header: "Pile", width: 14 },
          { header: "Rig", width: 14 },
          { header: "Driller", width: 16 },
          { header: "Ø mm", width: 11, align: "right" },
          { header: "Depth m", width: 13, align: "right" },
          { header: "Bore", width: 18 },
          { header: "Pour", width: 18 },
          { header: "m³", width: 12, align: "right" },
          { header: "Over", width: 12, align: "right" },
          { header: "Status", width: 16 },
        ],
        rows.map((r) => [
          r.ref,
          r.rigName ?? "—",
          r.drillerName ?? "—",
          String(r.pile.log?.asBuiltDiameterMm ?? "—"),
          num(r.pile.log?.toeDepthM),
          `${clockTime(r.pile.log?.boreStartedAt)}-${clockTime(r.pile.log?.boreFinishedAt)}`,
          `${clockTime(r.pile.log?.concreteStartedAt)}-${clockTime(r.pile.log?.concreteFinishedAt)}`,
          m3(r.pouredM3),
          pct(r.overbreakPct, 0),
          STATUS_LABEL[r.status],
        ]),
        {
          footer: [
            "Totals",
            "",
            "",
            "",
            num(totals.drilledM, 1),
            "",
            "",
            m3(totals.pouredM3),
            totals.count > 0 ? pct(totals.overbreakPct, 0) : "—",
            "",
          ],
        },
      );
    }

    sectionTitle(doc, "Site record");
    paragraph(doc, "Plant on site", text(report?.plantOnSite));
    paragraph(doc, "Visitors", text(report?.visitors));
    paragraph(doc, "Delays and lost time", text(report?.delays));
    paragraph(doc, "HSE", text(report?.hseNotes));
    paragraph(doc, "General notes", text(report?.generalNotes));

    if (report?.preparedBy) {
      doc
        .font("Helvetica")
        .fontSize(9)
        .text(`Prepared by: ${report.preparedBy}`);
      doc.moveDown(0.4);
    }

    signatureBlock(doc, ["Site engineer", "Project manager", "Client representative"]);

    stampPageNumbers(
      doc,
      `${site.name} · DPR ${isoDate(reportDate)} · issued ${isoDate(new Date())}`,
    );
  });
}
