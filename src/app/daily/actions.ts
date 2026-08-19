"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireActionAccess, NotPermittedError } from "@/lib/auth/access";
import { diff, recordAudit } from "@/lib/audit";
import { parseDateOnly } from "@/lib/format";
import { optInt, optString, type ActionState } from "@/lib/parse";

export async function saveDailyReport(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let access;
  try {
    access = await requireActionAccess("recordWork");
  } catch (err) {
    if (err instanceof NotPermittedError) return { ok: false, error: err.message };
    throw err;
  }
  const siteId = access.site.id;
  const reportDate = parseDateOnly(formData.get("reportDate"));
  if (!reportDate) return { ok: false, error: "Report date is required." };

  const data = {
    weather: optString(formData.get("weather")),
    temperatureC: optInt(formData.get("temperatureC")),
    personnelCount: optInt(formData.get("personnelCount")),
    plantOnSite: optString(formData.get("plantOnSite")),
    delays: optString(formData.get("delays")),
    hseNotes: optString(formData.get("hseNotes")),
    visitors: optString(formData.get("visitors")),
    generalNotes: optString(formData.get("generalNotes")),
    preparedBy: optString(formData.get("preparedBy")),
  };

  try {
    const existing = await prisma.dailyReport.findUnique({
      where: { siteId_reportDate: { siteId, reportDate } },
    });
    const saved = await prisma.dailyReport.upsert({
      where: { siteId_reportDate: { siteId, reportDate } },
      create: { siteId, reportDate, ...data },
      update: data,
    });
    await recordAudit({
      siteId,
      actorId: access.user.id,
      actorName: access.user.name,
      action: existing ? "UPDATE" : "CREATE",
      entity: "DailyReport",
      entityId: saved.id,
      entityLabel: reportDate.toISOString().slice(0, 10),
      changes: diff(existing as unknown as Record<string, unknown> | null, data),
    });
  } catch (err) {
    console.error("saveDailyReport failed", err);
    return { ok: false, error: "Could not save the daily report." };
  }

  revalidatePath("/daily");
  revalidatePath(`/daily/${formData.get("reportDate")}`);
  return { ok: true, saved: true };
}
