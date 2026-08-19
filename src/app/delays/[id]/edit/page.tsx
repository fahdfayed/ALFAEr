import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { getSite } from "@/lib/site";
import { DelayForm } from "@/components/DelayForm";
import { isoDate, toLocalDateTimeValue } from "@/lib/format";

export const dynamic = "force-dynamic";

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default async function EditDelayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const site = await getSite();

  const [delay, rigs, piles] = await Promise.all([
    prisma.delay.findFirst({ where: { id, siteId: site.id } }),
    prisma.rig.findMany({
      where: { siteId: site.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.pile.findMany({
      where: { siteId: site.id, log: { isNot: null } },
      orderBy: { ref: "desc" },
      take: 60,
      select: { id: true, ref: true },
    }),
  ]);
  if (!delay) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Edit delay</h1>
      <div className="mt-5">
        <DelayForm
          rigs={rigs}
          piles={piles}
          values={{
            id: delay.id,
            workDate: isoDate(delay.workDate),
            category: delay.category,
            reason: delay.reason,
            rigId: s(delay.rigId),
            pileLogId: s(delay.pileLogId),
            startedAt: toLocalDateTimeValue(delay.startedAt),
            endedAt: toLocalDateTimeValue(delay.endedAt),
            notes: s(delay.notes),
            recordedBy: s(delay.recordedBy),
          }}
        />
      </div>
    </div>
  );
}
