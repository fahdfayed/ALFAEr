import { PileLogForm } from "@/components/PileLogForm";
import { emptyFormValues, loadFormContext } from "@/lib/pileForm";

export const dynamic = "force-dynamic";

export default async function NewPileLogPage() {
  const { piles, rigs, drillers, thresholds } = await loadFormContext();

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">New pile log</h1>
      <p className="mt-1 text-sm text-slate-500">
        One record per pile. Everything else in the app is built from this.
      </p>
      <div className="mt-5">
        <PileLogForm
          mode="create"
          piles={piles}
          rigs={rigs}
          drillers={drillers}
          values={emptyFormValues()}
          thresholds={thresholds}
        />
      </div>
    </div>
  );
}
