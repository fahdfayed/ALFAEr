import { notFound } from "next/navigation";

import { PileLogForm } from "@/components/PileLogForm";
import { formValuesFromPile, loadFormContext, loadPileForEdit } from "@/lib/pileForm";

export const dynamic = "force-dynamic";

export default async function EditPileLogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { site, piles, rigs, drillers, thresholds } = await loadFormContext();
  const result = await loadPileForEdit(id, site.id);
  if (!result) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">
        Pile {result.pile.ref}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {result.pile.log ? "Editing the as-built record." : "No log yet — filling it in now."}
      </p>
      <div className="mt-5">
        <PileLogForm
          mode="edit"
          piles={piles}
          rigs={rigs}
          drillers={drillers}
          values={formValuesFromPile(result.pile)}
          thresholds={thresholds}
        />
      </div>
    </div>
  );
}
