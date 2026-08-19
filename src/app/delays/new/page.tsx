import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/access";
import { DelayForm } from "@/components/DelayForm";
import { isoDate, toLocalDateTimeValue } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function NewDelayPage() {
  const { site } = await requirePermission("recordWork");
  const [rigs, piles] = await Promise.all([
    prisma.rig.findMany({
      where: { siteId: site.id, active: true },
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

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Record a delay</h1>
      <p className="mt-1 text-sm text-slate-500">
        Two taps and a time. This feeds the daily report and the lost-time
        totals — nothing needs writing up later.
      </p>
      <div className="mt-5">
        <DelayForm
          rigs={rigs}
          piles={piles}
          values={{
            id: "",
            workDate: isoDate(new Date()),
            category: "",
            reason: "",
            rigId: "",
            pileLogId: "",
            startedAt: toLocalDateTimeValue(new Date()),
            endedAt: "",
            notes: "",
            recordedBy: "",
          }}
        />
      </div>
    </div>
  );
}
