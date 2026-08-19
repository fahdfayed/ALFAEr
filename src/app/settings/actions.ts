"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { getSite, getSiteId } from "@/lib/site";
import { parseSchedule, toPileCreate } from "@/lib/scheduleImport";
import { optFloat, optString, reqString, type ActionState } from "@/lib/parse";

export async function saveSite(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const site = await getSite();
  try {
    const amber = optFloat(formData.get("overbreakAmberPct")) ?? 8;
    const red = optFloat(formData.get("overbreakRedPct")) ?? 15;
    if (amber < 0 || red < 0) return { ok: false, error: "Thresholds cannot be negative." };
    if (red <= amber) {
      return { ok: false, error: "The red threshold must be above the amber threshold." };
    }

    await prisma.site.update({
      where: { id: site.id },
      data: {
        name: reqString(formData.get("name"), "Site name"),
        clientName: optString(formData.get("clientName")),
        contractRef: optString(formData.get("contractRef")),
        location: optString(formData.get("location")),
        overbreakAmberPct: amber,
        overbreakRedPct: red,
        concreteRatePerM3: optFloat(formData.get("concreteRatePerM3")),
        currency: optString(formData.get("currency")) ?? "AED",
      },
    });
  } catch (err) {
    console.error("saveSite failed", err);
    return { ok: false, error: "Could not save the site details." };
  }

  revalidatePath("/", "layout");
  return { ok: true, saved: true };
}

export async function addRig(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const siteId = await getSiteId();
  const name = optString(formData.get("name"));
  if (!name) return { ok: false, error: "Rig name is required." };

  const existing = await prisma.rig.findUnique({ where: { siteId_name: { siteId, name } } });
  if (existing) return { ok: false, error: `Rig "${name}" already exists.` };

  await prisma.rig.create({
    data: { siteId, name, make: optString(formData.get("make")) },
  });
  revalidatePath("/settings");
  return { ok: true, saved: true };
}

export async function addDriller(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const siteId = await getSiteId();
  const name = optString(formData.get("name"));
  if (!name) return { ok: false, error: "Driller name is required." };

  const existing = await prisma.driller.findUnique({
    where: { siteId_name: { siteId, name } },
  });
  if (existing) return { ok: false, error: `"${name}" is already on the list.` };

  await prisma.driller.create({ data: { siteId, name } });
  revalidatePath("/settings");
  return { ok: true, saved: true };
}

export interface ImportState extends ActionState {
  created?: number;
  updated?: number;
  skipped?: number;
  warnings?: string[];
}

/**
 * Imports a setting-out schedule. Piles already in the register are updated
 * rather than duplicated, so a revised schedule can be re-imported safely
 * without touching any as-built record.
 */
export async function importSchedule(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const siteId = await getSiteId();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a CSV file to import." };
  }
  if (file.size > 5_000_000) {
    return { ok: false, error: "That file is larger than 5 MB." };
  }

  const csv = await file.text();
  const { rows, errors } = parseSchedule(csv);

  if (rows.length === 0) {
    return {
      ok: false,
      error: errors[0] ?? "No pile rows were found in that file.",
      warnings: errors.slice(1, 10),
    };
  }

  const existing = await prisma.pile.findMany({
    where: { siteId, ref: { in: rows.map((r) => r.ref) } },
    select: { id: true, ref: true },
  });
  const existingByRef = new Map(existing.map((p) => [p.ref, p.id]));

  const toCreate = rows.filter((r) => !existingByRef.has(r.ref));
  const toUpdate = rows.filter((r) => existingByRef.has(r.ref));

  try {
    await prisma.$transaction(async (tx) => {
      if (toCreate.length > 0) {
        await tx.pile.createMany({ data: toCreate.map((r) => toPileCreate(siteId, r)) });
      }
      for (const r of toUpdate) {
        // Design data only — an as-built log for this pile is never touched.
        await tx.pile.update({
          where: { id: existingByRef.get(r.ref) as string },
          data: {
            gridRef: r.gridRef,
            eastingM: r.eastingM,
            northingM: r.northingM,
            designDiameterMm: r.designDiameterMm,
            designToeDepthM: r.designToeDepthM,
            designCutoffLevelM: r.designCutoffLevelM,
            designPlatformLevelM: r.designPlatformLevelM,
          },
        });
      }
    });
  } catch (err) {
    console.error("importSchedule failed", err);
    return { ok: false, error: "The import failed and nothing was changed." };
  }

  revalidatePath("/", "layout");
  return {
    ok: true,
    saved: true,
    created: toCreate.length,
    updated: toUpdate.length,
    skipped: errors.length,
    warnings: errors.slice(0, 10),
  };
}
