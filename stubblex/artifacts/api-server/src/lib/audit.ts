import { auditLogsTable, db } from "@workspace/db";

export async function writeAudit(input: {
  actorUserId?: number | null;
  action: string;
  entityType: string;
  entityId: string | number;
  details?: Record<string, unknown>;
}) {
  await db.insert(auditLogsTable).values({
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: String(input.entityId),
    details: input.details ?? {},
  });
}
