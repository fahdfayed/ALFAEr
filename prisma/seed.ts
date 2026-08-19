import { PrismaClient, type DelayCategory, type PileStatus } from "@prisma/client";
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

/** Mirrors src/lib/auth/password.ts so the seed produces verifiable hashes. */
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${derived.toString("base64")}`;
}

const prisma = new PrismaClient();

/** Deterministic pseudo-random so the demo data is stable between runs. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const RIGS = [
  { name: "BG28-01", make: "Bauer BG28" },
  { name: "BG30-02", make: "Bauer BG30" },
  { name: "BG40-01", make: "Bauer BG40" },
];

const DRILLERS = ["A. Rahman", "M. Farouk", "S. Kumar", "J. Okonkwo"];

const STRATA = [
  "0.0–2.4 made ground; 2.4–9.0 loose to medium sand; 9.0+ dense sand",
  "0.0–1.8 fill; 1.8–7.5 silty sand; 7.5–14.0 stiff clay; 14.0+ weathered sandstone",
  "0.0–3.0 made ground; 3.0–11.0 medium dense sand; 11.0+ cemented sand",
];

function isoDayUtc(daysAgo: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return new Date(`${d.toISOString().slice(0, 10)}T00:00:00Z`);
}

function at(day: Date, hour: number, minute: number) {
  return new Date(day.getTime() + hour * 3600000 + minute * 60000);
}

async function main() {
  await prisma.auditEntry.deleteMany();
  await prisma.session.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.delay.deleteMany();
  await prisma.concreteLoad.deleteMany();
  await prisma.pileLog.deleteMany();
  await prisma.pile.deleteMany();
  await prisma.dailyReport.deleteMany();
  await prisma.rig.deleteMany();
  await prisma.driller.deleteMany();
  await prisma.site.deleteMany();

  const site = await prisma.site.create({
    data: {
      name: "Marina Tower — Foundation Works",
      clientName: "Marina Development LLC",
      contractRef: "MT-2026-014",
      location: "Plot 42, Marina District",
      overbreakAmberPct: 8,
      overbreakRedPct: 15,
      concreteRatePerM3: 280,
      currency: "AED",
    },
  });

  // Demo accounts covering each role, so permissions can be seen working.
  const DEMO_PASSWORD = "alfaer-demo-2026";
  const people = [
    { email: "admin@alfaer.test", name: "System Administrator", isAdmin: true, role: null },
    { email: "engineer@alfaer.test", name: "Layla Haddad", isAdmin: false, role: "ENGINEER" as const },
    { email: "foreman@alfaer.test", name: "Tariq Nasser", isAdmin: false, role: "FOREMAN" as const },
    { email: "client@alfaer.test", name: "Marina Development", isAdmin: false, role: "VIEWER" as const },
  ];

  for (const person of people) {
    const user = await prisma.user.create({
      data: {
        email: person.email,
        name: person.name,
        isAdmin: person.isAdmin,
        passwordHash: await hashPassword(DEMO_PASSWORD),
      },
    });
    if (person.role) {
      await prisma.membership.create({
        data: { userId: user.id, siteId: site.id, role: person.role },
      });
    }
  }

  const rigs = await Promise.all(
    RIGS.map((r) => prisma.rig.create({ data: { ...r, siteId: site.id } })),
  );
  const drillers = await Promise.all(
    DRILLERS.map((name) => prisma.driller.create({ data: { name, siteId: site.id } })),
  );

  const rand = rng(20260819);

  // A 12 × 10 grid of piles on a 4.5 m spacing, three diameters by zone.
  const piles: {
    ref: string;
    eastingM: number;
    northingM: number;
    diameter: number;
    depth: number;
    gridRef: string;
  }[] = [];

  let n = 0;
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 12; col++) {
      n++;
      const zone = col < 4 ? "A" : col < 8 ? "B" : "C";
      const diameter = zone === "A" ? 750 : zone === "B" ? 900 : 1200;
      const depth = zone === "A" ? 18 : zone === "B" ? 24 : 29;
      piles.push({
        ref: `P-${String(100 + n)}`,
        eastingM: 452_300 + col * 4.5 + (rand() - 0.5) * 0.1,
        northingM: 2_781_500 + row * 4.5 + (rand() - 0.5) * 0.1,
        diameter,
        depth,
        gridRef: `${zone}${row + 1}`,
      });
    }
  }

  await prisma.pile.createMany({
    data: piles.map((p) => ({
      siteId: site.id,
      ref: p.ref,
      gridRef: p.gridRef,
      eastingM: p.eastingM,
      northingM: p.northingM,
      designDiameterMm: p.diameter,
      designToeDepthM: p.depth,
      designCutoffLevelM: -2.5,
      designPlatformLevelM: 0,
    })),
  });

  const created = await prisma.pile.findMany({
    where: { siteId: site.id },
    orderBy: { ref: "asc" },
  });

  // Log roughly 70% of the register across the last 14 shifts, oldest first.
  const logged = created.slice(0, Math.floor(created.length * 0.7));
  const shifts = 14;
  const perShift = Math.ceil(logged.length / shifts);

  for (let i = 0; i < logged.length; i++) {
    const pile = logged[i];
    const shiftIndex = Math.floor(i / perShift);
    const workDate = isoDayUtc(shifts - 1 - shiftIndex);
    const rig = rigs[i % rigs.length];
    const driller = drillers[i % drillers.length];

    const toeDepth = pile.designToeDepthM + (rand() - 0.4) * 0.8;
    const r = pile.designDiameterMm / 2000;
    const theoretical = Math.PI * r * r * toeDepth;

    // Zone C (1200 mm, loose sand) deliberately runs hotter, so the dashboard
    // has a real pattern to surface rather than uniform noise.
    const base = pile.designDiameterMm === 1200 ? 0.17 : 0.07;
    const rigPenalty = rig.name === "BG40-01" ? 0.05 : 0;
    const overbreak = base + rigPenalty + (rand() - 0.5) * 0.06;
    const poured = Math.round(theoretical * (1 + overbreak) * 100) / 100;

    const boreStart = at(workDate, 7 + (i % 3) * 3, (i * 7) % 60);
    const boreEnd = new Date(boreStart.getTime() + (2.5 + rand() * 2.5) * 3600000);
    const pourStart = new Date(boreEnd.getTime() + (0.75 + rand()) * 3600000);
    const pourEnd = new Date(pourStart.getTime() + (0.8 + rand() * 0.7) * 3600000);

    const age = shifts - 1 - shiftIndex;
    const status: PileStatus =
      age > 9 ? "ACCEPTED" : age > 6 ? "TESTED" : age > 1 ? "CAST" : "CAST";

    await prisma.pile.update({ where: { id: pile.id }, data: { status } });

    await prisma.pileLog.create({
      data: {
        id: pile.id,
        workDate,
        rigId: rig.id,
        drillerId: driller.id,
        boreStartedAt: boreStart,
        boreFinishedAt: boreEnd,
        asBuiltDiameterMm: pile.designDiameterMm,
        toeDepthM: Math.round(toeDepth * 100) / 100,
        platformLevelM: 0,
        cutoffLevelM: -2.5,
        waterStrikeDepthM: rand() > 0.6 ? Math.round((4 + rand() * 6) * 10) / 10 : null,
        verticalityPct: Math.round(rand() * 60) / 100,
        casingDepthM: Math.round((6 + rand() * 4) * 10) / 10,
        casingDiameterMm: pile.designDiameterMm + 100,
        casingType: "Temporary",
        cageMark: `C-${pile.ref.slice(2)}`,
        cageLengthM: Math.round((toeDepth - 2) * 10) / 10,
        cageDiameterMm: pile.designDiameterMm - 150,
        cageMainBars: pile.designDiameterMm === 1200 ? "16T25" : "12T20",
        cageLinks: "T10 @ 150",
        cageTopDepthM: 1.5,
        cageInstalledAt: new Date(boreEnd.getTime() + 1800000),
        concreteStartedAt: pourStart,
        concreteFinishedAt: pourEnd,
        concreteGrade: "C32/40",
        concreteMixRef: "TR-40-180",
        slumpMm: 180 + Math.round(rand() * 20),
        cubesTaken: 6,
        concreteTopDepthM: 0,
        pouredVolumeM3: poured,
        strata: STRATA[i % STRATA.length],
        weather: "Clear, 34 °C",
        remarks: overbreak > 0.2 ? "Loose sand horizon, bore stood open with polymer." : null,
        loads: {
          create: splitIntoLoads(poured).map((v, k) => ({
            ticketRef: `B${21000 + i * 4 + k}`,
            volumeM3: v,
            arrivedAt: new Date(pourStart.getTime() + k * 1_800_000),
            slumpMm: 180 + Math.round(rand() * 20),
            sequence: k,
          })),
        },
      },
    });
  }

  // Delays, weighted the way they actually fall on a piling job: waiting on
  // concrete dominates the hours, and breakdowns cluster on one tired rig.
  const DELAY_MIX: { category: DelayCategory; reason: string; weight: number; mins: [number, number] }[] = [
    { category: "CONCRETE", reason: "Truck delayed", weight: 10, mins: [40, 150] },
    { category: "CONCRETE", reason: "Concrete rejected on slump", weight: 2, mins: [30, 90] },
    { category: "EQUIPMENT", reason: "Rig breakdown", weight: 5, mins: [60, 300] },
    { category: "EQUIPMENT", reason: "Tool / auger failure", weight: 3, mins: [30, 120] },
    { category: "REINFORCEMENT", reason: "Cage not available", weight: 4, mins: [45, 180] },
    { category: "REINFORCEMENT", reason: "Crane unavailable for lift", weight: 2, mins: [30, 90] },
    { category: "CLIENT", reason: "Inspection delay", weight: 3, mins: [30, 120] },
    { category: "SITE", reason: "Setting out pending", weight: 2, mins: [30, 90] },
    { category: "GROUND", reason: "Obstruction", weight: 2, mins: [60, 240] },
  ];

  const weighted = DELAY_MIX.flatMap((d) => Array<typeof d>(d.weight).fill(d));

  for (let shift = 0; shift < shifts; shift++) {
    const workDate = isoDayUtc(shift);
    const eventCount = Math.floor(rand() * 3); // 0-2 delays a shift
    for (let k = 0; k < eventCount; k++) {
      const pick = weighted[Math.floor(rand() * weighted.length)];
      const rig = rigs[Math.floor(rand() * rigs.length)];
      // The oldest rig breaks down more often than the others.
      const chosenRig =
        pick.category === "EQUIPMENT" && rand() > 0.35 ? rigs[2] : rig;

      const startHour = 7 + Math.floor(rand() * 9);
      const startedAt = at(workDate, startHour, Math.floor(rand() * 60));
      const minutes = Math.round(
        pick.mins[0] + rand() * (pick.mins[1] - pick.mins[0]),
      );

      await prisma.delay.create({
        data: {
          siteId: site.id,
          workDate,
          category: pick.category,
          reason: pick.reason,
          rigId: chosenRig.id,
          startedAt,
          endedAt: new Date(startedAt.getTime() + minutes * 60000),
          minutes,
          recordedBy: "Site Engineer",
        },
      });
    }
  }

  // Narratives for the three most recent shifts.
  for (let d = 0; d < 3; d++) {
    await prisma.dailyReport.create({
      data: {
        siteId: site.id,
        reportDate: isoDayUtc(d),
        weather: "Clear",
        temperatureC: 34 - d,
        personnelCount: 26,
        plantOnSite: "3 × piling rig, 1 × 50 t crawler crane, 2 × excavator, 1 × desander",
        delays: d === 1 ? "Concrete truck delayed 70 min on the second pour of the shift." : null,
        hseNotes: "Daily toolbox talk on exclusion zones. No incidents.",
        visitors: d === 0 ? "Consultant geotechnical engineer, morning inspection." : null,
        preparedBy: "Site Engineer",
      },
    });
  }

  const count = await prisma.pileLog.count();
  const delayCount = await prisma.delay.count();
  console.log(
    `Seeded ${site.name}: ${created.length} piles in the register, ${count} logged, ${delayCount} delays.`,
  );
  console.log(
    `Sign in with any of ${people.map((p) => p.email).join(", ")} — password "${DEMO_PASSWORD}".`,
  );
}

/** Splits a pour into 8 m³ truck loads, the way it actually arrives. */
function splitIntoLoads(total: number): number[] {
  const loads: number[] = [];
  let remaining = Math.round(total * 100) / 100;
  while (remaining > 8) {
    loads.push(8);
    remaining = Math.round((remaining - 8) * 100) / 100;
  }
  if (remaining > 0) loads.push(remaining);
  return loads;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
