import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/access";
import {
  AddDrillerForm,
  AddRigForm,
  ImportScheduleForm,
  SiteForm,
} from "@/components/SettingsForms";

export const dynamic = "force-dynamic";

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default async function SettingsPage() {
  const { site } = await requirePermission("manageProject");
  const [rigs, drillers, pileCount, positionedCount] = await Promise.all([
    prisma.rig.findMany({ where: { siteId: site.id }, orderBy: { name: "asc" } }),
    prisma.driller.findMany({ where: { siteId: site.id }, orderBy: { name: "asc" } }),
    prisma.pile.count({ where: { siteId: site.id } }),
    prisma.pile.count({
      where: { siteId: site.id, eastingM: { not: null }, northingM: { not: null } },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Contract details, thresholds, crew and the pile schedule.
        </p>
      </div>

      <SiteForm
        values={{
          name: s(site.name),
          clientName: s(site.clientName),
          contractRef: s(site.contractRef),
          location: s(site.location),
          shiftHours: s(site.shiftHours),
          overbreakAmberPct: s(site.overbreakAmberPct),
          overbreakRedPct: s(site.overbreakRedPct),
          concreteRatePerM3: s(site.concreteRatePerM3),
          currency: s(site.currency),
        }}
      />

      <section className="card space-y-4 p-4 sm:p-5">
        <div>
          <h2 className="section-title">Pile schedule</h2>
          <p className="mt-1 text-sm text-slate-500">
            {pileCount} pile{pileCount === 1 ? "" : "s"} in the register ·{" "}
            {positionedCount} with setting-out coordinates.
          </p>
        </div>
        <ImportScheduleForm />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card space-y-4 p-4 sm:p-5">
          <h2 className="section-title">Rigs</h2>
          {rigs.length === 0 ? (
            <p className="text-sm text-slate-500">No rigs yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {rigs.map((r) => (
                <li key={r.id} className="flex justify-between py-2">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-slate-500">{r.make ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
          <AddRigForm />
        </section>

        <section className="card space-y-4 p-4 sm:p-5">
          <h2 className="section-title">Drillers</h2>
          {drillers.length === 0 ? (
            <p className="text-sm text-slate-500">No drillers yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {drillers.map((d) => (
                <li key={d.id} className="py-2 font-medium">
                  {d.name}
                </li>
              ))}
            </ul>
          )}
          <AddDrillerForm />
        </section>
      </div>
    </div>
  );
}
