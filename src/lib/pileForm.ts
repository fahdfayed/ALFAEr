import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/access";
import { isoDate, toLocalDateTimeValue } from "@/lib/format";
import type { PileLogFormValues } from "@/components/PileLogForm";

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export async function loadFormContext() {
  const { site } = await requirePermission("recordWork");
  const [piles, rigs, drillers] = await Promise.all([
    prisma.pile.findMany({
      where: { siteId: site.id },
      orderBy: { ref: "asc" },
      select: {
        id: true,
        ref: true,
        designDiameterMm: true,
        designToeDepthM: true,
        log: { select: { id: true } },
      },
    }),
    prisma.rig.findMany({
      where: { siteId: site.id, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.driller.findMany({
      where: { siteId: site.id, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return {
    site,
    rigs,
    drillers,
    piles: piles.map((p) => ({
      id: p.id,
      ref: p.ref,
      designDiameterMm: p.designDiameterMm,
      designToeDepthM: p.designToeDepthM,
      hasLog: p.log !== null,
    })),
    thresholds: { amberPct: site.overbreakAmberPct, redPct: site.overbreakRedPct },
  };
}

export function emptyFormValues(): PileLogFormValues {
  return {
    pileId: "",
    workDate: isoDate(new Date()),
    rigId: "",
    drillerId: "",
    boreStartedAt: "",
    boreFinishedAt: "",
    asBuiltDiameterMm: "",
    toeDepthM: "",
    platformLevelM: "",
    cutoffLevelM: "",
    waterStrikeDepthM: "",
    verticalityPct: "",
    casingDepthM: "",
    casingDiameterMm: "",
    casingType: "",
    cageMark: "",
    cageLengthM: "",
    cageDiameterMm: "",
    cageMainBars: "",
    cageLinks: "",
    cageTopDepthM: "",
    cageInstalledAt: "",
    concreteStartedAt: "",
    concreteFinishedAt: "",
    concreteGrade: "",
    concreteMixRef: "",
    slumpMm: "",
    cubesTaken: "",
    concreteTopDepthM: "0",
    pouredVolumeM3: "",
    strata: "",
    weather: "",
    remarks: "",
    status: "CAST",
    loads: [],
  };
}

type PileWithLog = NonNullable<
  Awaited<ReturnType<typeof loadPileForEdit>>
>["pile"];

export async function loadPileForEdit(pileId: string, siteId: string) {
  const pile = await prisma.pile.findFirst({
    where: { id: pileId, siteId },
    include: { log: { include: { loads: { orderBy: { sequence: "asc" } } } } },
  });
  if (!pile) return null;
  return { pile };
}

export function formValuesFromPile(pile: PileWithLog): PileLogFormValues {
  const log = pile.log;
  const base = emptyFormValues();
  if (!log) {
    return {
      ...base,
      pileId: pile.id,
      asBuiltDiameterMm: s(pile.designDiameterMm),
      toeDepthM: s(pile.designToeDepthM),
      status: pile.status,
    };
  }

  return {
    pileId: pile.id,
    workDate: isoDate(log.workDate),
    rigId: s(log.rigId),
    drillerId: s(log.drillerId),
    boreStartedAt: toLocalDateTimeValue(log.boreStartedAt),
    boreFinishedAt: toLocalDateTimeValue(log.boreFinishedAt),
    asBuiltDiameterMm: s(log.asBuiltDiameterMm),
    toeDepthM: s(log.toeDepthM),
    platformLevelM: s(log.platformLevelM),
    cutoffLevelM: s(log.cutoffLevelM),
    waterStrikeDepthM: s(log.waterStrikeDepthM),
    verticalityPct: s(log.verticalityPct),
    casingDepthM: s(log.casingDepthM),
    casingDiameterMm: s(log.casingDiameterMm),
    casingType: s(log.casingType),
    cageMark: s(log.cageMark),
    cageLengthM: s(log.cageLengthM),
    cageDiameterMm: s(log.cageDiameterMm),
    cageMainBars: s(log.cageMainBars),
    cageLinks: s(log.cageLinks),
    cageTopDepthM: s(log.cageTopDepthM),
    cageInstalledAt: toLocalDateTimeValue(log.cageInstalledAt),
    concreteStartedAt: toLocalDateTimeValue(log.concreteStartedAt),
    concreteFinishedAt: toLocalDateTimeValue(log.concreteFinishedAt),
    concreteGrade: s(log.concreteGrade),
    concreteMixRef: s(log.concreteMixRef),
    slumpMm: s(log.slumpMm),
    cubesTaken: s(log.cubesTaken),
    concreteTopDepthM: s(log.concreteTopDepthM),
    pouredVolumeM3: s(log.pouredVolumeM3),
    strata: s(log.strata),
    weather: s(log.weather),
    remarks: s(log.remarks),
    status: pile.status,
    loads: log.loads.map((l) => ({
      ticketRef: s(l.ticketRef),
      volumeM3: s(l.volumeM3),
      arrivedAt: toLocalDateTimeValue(l.arrivedAt),
      slumpMm: s(l.slumpMm),
    })),
  };
}
