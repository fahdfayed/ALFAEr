import "server-only";

import type { AuditAction, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import type { ChangeSet } from "@/lib/auditDiff";

export {
  diff,
  fieldLabel,
  auditValue,
  FIELD_LABEL,
  type ChangeSet,
  type FieldChange,
} from "@/lib/auditDiff";

export interface RecordAuditInput {
  siteId: string | null;
  actorId: string | null;
  actorName: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  entityLabel: string;
  changes?: ChangeSet;
  reason?: string | null;
  /** Runs the write inside a caller's transaction when one is in progress. */
  tx?: Prisma.TransactionClient;
}

/**
 * Writes one audit entry. An UPDATE with an empty change set is skipped —
 * saving a form without altering anything is not an event worth recording,
 * and logging it would bury the changes that matter.
 */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  if (
    input.action === "UPDATE" &&
    input.changes &&
    Object.keys(input.changes).length === 0
  ) {
    return;
  }

  const client = input.tx ?? prisma;

  await client.auditEntry.create({
    data: {
      siteId: input.siteId,
      actorId: input.actorId,
      actorName: input.actorName,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      entityLabel: input.entityLabel,
      changes:
        input.changes && Object.keys(input.changes).length > 0
          ? (input.changes as unknown as Prisma.InputJsonValue)
          : undefined,
      reason: input.reason ?? null,
    },
  });
}
