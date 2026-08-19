"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { getSiteId } from "@/lib/site";
import { parseDateOnly } from "@/lib/format";
import { optInt, optString, type ActionState } from "@/lib/parse";

export async function saveDailyReport(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const siteId = await getSiteId();
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
    await prisma.dailyReport.upsert({
      where: { siteId_reportDate: { siteId, reportDate } },
      create: { siteId, reportDate, ...data },
      update: data,
    });
  } catch (err) {
    console.error("saveDailyReport failed", err);
    return { ok: false, error: "Could not save the daily report." };
  }

  revalidatePath("/daily");
  revalidatePath(`/daily/${formData.get("reportDate")}`);
  return { ok: true, saved: true };
}
