import type { Site } from "@prisma/client";

import type { PileRow } from "@/lib/queries";
import { clockTime, duration, isoDate, longDate, m3, num, pct, text } from "@/lib/format";
import { BAND_LABEL } from "@/lib/concrete";
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

export function pileLogPdf(site: Site, row: PileRow): Promise<Buffer> {
  const pile = row.pile;
  const log = pile.log;
  if (!log) throw new Error("Pile has no as-built record");

  return render((doc) => {
    header(doc, {
      title: `Bored Pile Log — ${pile.ref}`,
      siteName: site.name,
      subtitle: site.contractRef ?? undefined,
      meta: [
        site.clientName ? `Client: ${site.clientName}` : "",
        site.location ? `Location: ${site.location}` : "",
        `Shift: ${longDate(log.workDate)}`,
      ].filter(Boolean),
    });

    sectionTitle(doc, "Identification");
    keyValueGrid(doc, [
      ["Pile reference", pile.ref],
      ["Status", STATUS_LABEL[pile.status]],
      ["Grid reference", text(pile.gridRef)],
      ["Rig", text(log.rig?.name)],
      [
        "Setting out (E / N)",
        pile.eastingM !== null && pile.northingM !== null
          ? `${num(pile.eastingM, 3)} / ${num(pile.northingM, 3)}`
          : "—",
      ],
      ["Driller", text(log.driller?.name)],
    ]);

    sectionTitle(doc, "Design vs as-built");
    keyValueGrid(doc, [
      ["Design diameter", `${pile.designDiameterMm} mm`],
      ["As-built diameter", `${log.asBuiltDiameterMm} mm`],
      ["Design toe depth", `${num(pile.designToeDepthM)} m`],
      ["As-built toe depth", `${num(log.toeDepthM)} m`],
      ["Design cut-off level", num(pile.designCutoffLevelM, 3)],
      ["As-built cut-off level", num(log.cutoffLevelM, 3)],
      ["Platform level", num(log.platformLevelM, 3)],
      ["Verticality", log.verticalityPct === null ? "—" : `${num(log.verticalityPct)} %`],
    ]);

    sectionTitle(doc, "Boring");
    keyValueGrid(doc, [
      ["Bore started", clockTime(log.boreStartedAt)],
      ["Bore finished", clockTime(log.boreFinishedAt)],
      ["Boring time", duration(log.boreStartedAt, log.boreFinishedAt)],
      [
        "Water strike",
        log.waterStrikeDepthM === null ? "None recorded" : `${num(log.waterStrikeDepthM)} m`,
      ],
      ["Casing depth", log.casingDepthM === null ? "—" : `${num(log.casingDepthM)} m`],
      [
        "Casing diameter",
        log.casingDiameterMm === null ? "—" : `${log.casingDiameterMm} mm`,
      ],
      ["Casing type", text(log.casingType)],
      ["Weather", text(log.weather)],
    ]);

    sectionTitle(doc, "Reinforcement cage");
    keyValueGrid(doc, [
      ["Cage mark", text(log.cageMark)],
      ["Installed", clockTime(log.cageInstalledAt)],
      ["Cage length", log.cageLengthM === null ? "—" : `${num(log.cageLengthM)} m`],
      ["Cage diameter", log.cageDiameterMm === null ? "—" : `${log.cageDiameterMm} mm`],
      ["Main bars", text(log.cageMainBars)],
      ["Links", text(log.cageLinks)],
      ["Top of cage", log.cageTopDepthM === null ? "—" : `${num(log.cageTopDepthM)} m`],
      ["", ""],
    ]);

    sectionTitle(doc, "Concrete");
    keyValueGrid(doc, [
      ["Grade", text(log.concreteGrade)],
      ["Mix reference", text(log.concreteMixRef)],
      ["Pour started", clockTime(log.concreteStartedAt)],
      ["Pour finished", clockTime(log.concreteFinishedAt)],
      ["Pour time", duration(log.concreteStartedAt, log.concreteFinishedAt)],
      ["Slump", log.slumpMm === null ? "—" : `${log.slumpMm} mm`],
      ["Cubes taken", String(log.cubesTaken ?? 0)],
      ["Top of concrete", `${num(log.concreteTopDepthM)} m below platform`],
    ]);

    if (log.loads.length > 0) {
      sectionTitle(doc, "Delivery tickets");
      table(
        doc,
        [
          { header: "Ticket", width: 30 },
          { header: "Arrived", width: 20 },
          { header: "Volume (m³)", width: 25, align: "right" },
          { header: "Slump (mm)", width: 25, align: "right" },
        ],
        log.loads.map((l) => [
          text(l.ticketRef),
          clockTime(l.arrivedAt),
          m3(l.volumeM3),
          l.slumpMm === null ? "—" : String(l.slumpMm),
        ]),
        {
          footer: [
            "Total",
            "",
            m3(log.loads.reduce((s, l) => s + l.volumeM3, 0)),
            "",
          ],
        },
      );
    }

    sectionTitle(doc, "Concrete reconciliation");
    keyValueGrid(
      doc,
      [
        ["Concreted length", `${num(log.toeDepthM - log.concreteTopDepthM)} m`],
        ["Theoretical volume", `${m3(row.theoreticalM3)} m³`],
        ["Actual placed", `${m3(row.pouredM3)} m³`],
        [
          "Variance",
          `${(row.overbreakM3 ?? 0) > 0 ? "+" : ""}${m3(row.overbreakM3)} m³`,
        ],
        ["Overbreak", pct(row.overbreakPct)],
        ["Assessment", row.band ? BAND_LABEL[row.band] : "—"],
      ],
      2,
    );

    paragraph(doc, "Strata encountered", text(log.strata));
    paragraph(doc, "Remarks", text(log.remarks));

    signatureBlock(doc, ["Site engineer", "Project manager", "Consultant"]);

    stampPageNumbers(
      doc,
      `${site.name} · Pile ${pile.ref} · issued ${isoDate(new Date())}`,
    );
  });
}
