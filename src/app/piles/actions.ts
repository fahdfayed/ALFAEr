"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PileStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { requireActionAccess, NotPermittedError } from "@/lib/auth/access";
import { diff, recordAudit } from "@/lib/audit";
import { PILE_STATUSES } from "@/lib/status";
import { OFF_SCHEDULE } from "@/lib/constants";
import { parseDateOnly, parseLocalDateTime } from "@/lib/format";
import {
  ActionState,
  FieldError,
  optFloat,
  optInt,
  optString,
  reqFloat,
  reqInt,
  reqString,
} from "@/lib/parse";

interface LoadRow {
  ticketRef: string | null;
  volumeM3: number;
  arrivedAt: Date | null;
  slumpMm: number | null;
}

/** Concrete load rows arrive as parallel indexed fields from the form. */
function readLoads(formData: FormData): LoadRow[] {
  const volumes = formData.getAll("loadVolumeM3");
  const refs = formData.getAll("loadTicketRef");
  const times = formData.getAll("loadArrivedAt");
  const slumps = formData.getAll("loadSlumpMm");

  const rows: LoadRow[] = [];
  for (let i = 0; i < volumes.length; i++) {
    const volume = optFloat(volumes[i] ?? null);
    const ticketRef = optString(refs[i] ?? null);
    // A row with neither a volume nor a ticket is an untouched blank row.
    if (volume === null && ticketRef === null) continue;
    if (volume === null) throw new FieldError(`Load ${i + 1}`, "needs a volume");
    if (volume <= 0) throw new FieldError(`Load ${i + 1}`, "volume must be positive");
    rows.push({
      ticketRef,
      volumeM3: volume,
      arrivedAt: parseLocalDateTime(times[i] ?? null),
      slumpMm: optInt(slumps[i] ?? null),
    });
  }
  return rows;
}

function readStatus(formData: FormData): PileStatus {
  const raw = reqString(formData.get("status"), "Status");
  if (!(PILE_STATUSES as string[]).includes(raw)) {
    throw new FieldError("Status", "is not a recognised value");
  }
  return raw as PileStatus;
}

/**
 * Creates or updates the as-built record for a pile, and the pile itself when
 * the driller logged one that wasn't on the setting-out schedule.
 */
export async function savePileLog(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let pileId: string | null = null;
  let pileRef = "";

  try {
    const access = await requireActionAccess("recordWork");
    const siteId = access.site.id;

    const workDate = parseDateOnly(formData.get("workDate"));
    if (!workDate) return { ok: false, error: "Work date is required." };

    const asBuiltDiameterMm = reqInt(formData.get("asBuiltDiameterMm"), "As-built diameter");
    const toeDepthM = reqFloat(formData.get("toeDepthM"), "Toe depth");
    const concreteTopDepthM = optFloat(formData.get("concreteTopDepthM")) ?? 0;

    if (asBuiltDiameterMm <= 0) return { ok: false, error: "As-built diameter must be positive." };
    if (toeDepthM <= 0) return { ok: false, error: "Toe depth must be positive." };
    if (concreteTopDepthM < 0) {
      return { ok: false, error: "Top of concrete cannot be above the platform." };
    }
    if (concreteTopDepthM >= toeDepthM) {
      return { ok: false, error: "Top of concrete must be above the toe." };
    }

    const loads = readLoads(formData);
    const loadTotal = loads.reduce((sum, l) => sum + l.volumeM3, 0);
    const pouredEntered = optFloat(formData.get("pouredVolumeM3"));
    // Load tickets are the auditable source, so they win when present.
    const pouredVolumeM3 = loads.length > 0 ? loadTotal : pouredEntered;
    if (pouredVolumeM3 === null) {
      return { ok: false, error: "Enter the concrete poured, or at least one load ticket." };
    }
    if (pouredVolumeM3 <= 0) return { ok: false, error: "Concrete poured must be positive." };

    const boreStartedAt = parseLocalDateTime(formData.get("boreStartedAt"));
    const boreFinishedAt = parseLocalDateTime(formData.get("boreFinishedAt"));
    if (boreStartedAt && boreFinishedAt && boreFinishedAt < boreStartedAt) {
      return { ok: false, error: "Bore finished before it started." };
    }
    const concreteStartedAt = parseLocalDateTime(formData.get("concreteStartedAt"));
    const concreteFinishedAt = parseLocalDateTime(formData.get("concreteFinishedAt"));
    if (concreteStartedAt && concreteFinishedAt && concreteFinishedAt < concreteStartedAt) {
      return { ok: false, error: "Concreting finished before it started." };
    }

    const status = readStatus(formData);

    // --- resolve the pile ---
    const pileSelection = optString(formData.get("pileId"));
    if (pileSelection === null) {
      return {
        ok: false,
        error: "Pick the pile from the schedule, or choose \u201cPile not on the schedule\u201d.",
      };
    }

    const existingPileId = pileSelection === OFF_SCHEDULE ? null : pileSelection;
    let previousLog: Record<string, unknown> | null = null;
    let previousStatus: string | null = null;

    if (existingPileId) {
      const pile = await prisma.pile.findFirst({
        where: { id: existingPileId, siteId },
        include: { log: true },
      });
      if (!pile) return { ok: false, error: "That pile is not on this site." };
      pileId = pile.id;
      pileRef = pile.ref;
      previousLog = pile.log as Record<string, unknown> | null;
      previousStatus = pile.status;
      await prisma.pile.update({ where: { id: pileId }, data: { status } });
    } else {
      const ref = reqString(formData.get("newPileRef"), "Pile reference");
      const clash = await prisma.pile.findUnique({
        where: { siteId_ref: { siteId, ref } },
      });
      if (clash) {
        return {
          ok: false,
          error: `Pile ${ref} already exists — pick it from the list instead of adding it again.`,
        };
      }
      const created = await prisma.pile.create({
        data: {
          siteId,
          ref,
          designDiameterMm: optInt(formData.get("newPileDesignDiameterMm")) ?? asBuiltDiameterMm,
          designToeDepthM: optFloat(formData.get("newPileDesignToeDepthM")) ?? toeDepthM,
          eastingM: optFloat(formData.get("newPileEastingM")),
          northingM: optFloat(formData.get("newPileNorthingM")),
          status,
        },
      });
      pileId = created.id;
      pileRef = created.ref;
    }

    const logData = {
      workDate,
      rigId: optString(formData.get("rigId")),
      drillerId: optString(formData.get("drillerId")),
      boreStartedAt,
      boreFinishedAt,
      asBuiltDiameterMm,
      toeDepthM,
      platformLevelM: optFloat(formData.get("platformLevelM")),
      cutoffLevelM: optFloat(formData.get("cutoffLevelM")),
      waterStrikeDepthM: optFloat(formData.get("waterStrikeDepthM")),
      verticalityPct: optFloat(formData.get("verticalityPct")),
      casingDepthM: optFloat(formData.get("casingDepthM")),
      casingDiameterMm: optInt(formData.get("casingDiameterMm")),
      casingType: optString(formData.get("casingType")),
      cageMark: optString(formData.get("cageMark")),
      cageLengthM: optFloat(formData.get("cageLengthM")),
      cageDiameterMm: optInt(formData.get("cageDiameterMm")),
      cageMainBars: optString(formData.get("cageMainBars")),
      cageLinks: optString(formData.get("cageLinks")),
      cageTopDepthM: optFloat(formData.get("cageTopDepthM")),
      cageInstalledAt: parseLocalDateTime(formData.get("cageInstalledAt")),
      concreteStartedAt,
      concreteFinishedAt,
      concreteGrade: optString(formData.get("concreteGrade")),
      concreteMixRef: optString(formData.get("concreteMixRef")),
      slumpMm: optInt(formData.get("slumpMm")),
      cubesTaken: optInt(formData.get("cubesTaken")) ?? 0,
      concreteTopDepthM,
      pouredVolumeM3,
      strata: optString(formData.get("strata")),
      weather: optString(formData.get("weather")),
      remarks: optString(formData.get("remarks")),
    };

    const logId = pileId;
    const label = pileRef;

    // Status lives on the pile rather than the log, so it is folded into the
    // same change set — a pile moving to Cast is part of the same edit.
    const changes = diff(previousLog, {
      ...logData,
      ...(previousStatus === null || previousStatus !== status ? { status } : {}),
    });

    await prisma.$transaction(async (tx) => {
      await tx.pileLog.upsert({
        where: { id: logId },
        create: { id: logId, ...logData },
        update: logData,
      });
      // Loads are replaced wholesale — the form always submits the full set.
      await tx.concreteLoad.deleteMany({ where: { pileLogId: logId } });
      if (loads.length > 0) {
        await tx.concreteLoad.createMany({
          data: loads.map((l, i) => ({ ...l, pileLogId: logId, sequence: i })),
        });
      }

      // Written inside the transaction: a record that changed without a trail
      // entry is exactly the situation the trail exists to prevent.
      await recordAudit({
        tx,
        siteId,
        actorId: access.user.id,
        actorName: access.user.name,
        action: previousLog ? "UPDATE" : "CREATE",
        entity: "PileLog",
        entityId: logId,
        entityLabel: label,
        changes,
        reason: optString(formData.get("changeReason")),
      });
    });
  } catch (err) {
    if (err instanceof FieldError) return { ok: false, error: err.message };
    if (err instanceof NotPermittedError) return { ok: false, error: err.message };
    console.error("savePileLog failed", err);
    return { ok: false, error: "Could not save the pile log. Please try again." };
  }

  if (!pileId) return { ok: false, error: "Could not save the pile log." };

  revalidatePath("/");
  revalidatePath("/piles");
  revalidatePath("/overbreak");
  revalidatePath("/layout");
  revalidatePath("/daily");
  redirect(`/piles/${pileId}?saved=1`);
}

/** Status changes from the layout board and pile list, without opening the log. */
export async function setPileStatus(pileId: string, status: PileStatus) {
  const access = await requireActionAccess("recordWork");
  const siteId = access.site.id;
  if (!(PILE_STATUSES as string[]).includes(status)) return;

  const pile = await prisma.pile.findFirst({ where: { id: pileId, siteId } });
  if (!pile || pile.status === status) return;

  await prisma.pile.updateMany({ where: { id: pileId, siteId }, data: { status } });
  await recordAudit({
    siteId,
    actorId: access.user.id,
    actorName: access.user.name,
    action: "UPDATE",
    entity: "Pile",
    entityId: pileId,
    entityLabel: pile.ref,
    changes: { status: { from: pile.status, to: status } },
  });
  revalidatePath("/layout");
  revalidatePath("/piles");
  revalidatePath(`/piles/${pileId}`);
}
