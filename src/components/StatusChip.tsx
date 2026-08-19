import type { PileStatus } from "@prisma/client";
import { STATUS_CHIP, STATUS_LABEL } from "@/lib/status";

export function StatusChip({ status }: { status: PileStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_CHIP[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
