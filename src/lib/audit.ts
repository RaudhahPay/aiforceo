import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AuditAction =
  | "kpi.update"
  | "kpi.create"
  | "task.create"
  | "task.status_change"
  | "task.update"
  | "task.delete"
  | "conversation.create"
  | "conversation.summary_generated"
  | "memory.extract"
  | "memory.delete"
  | "workspace.settings_change"
  | "agent.delegation"
  | "agent.kpi_update_applied";

export type AuditEntry = {
  workspaceId: string;
  actorId?: string;
  actorType?: "user" | "agent" | "system";
  agentRole?: string;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
};

export async function logAudit(entry: AuditEntry): Promise<void> {
  // Fire-and-forget — never throws, never blocks
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("audit_log").insert({
      workspace_id: entry.workspaceId,
      actor_id: entry.actorId ?? null,
      actor_type: entry.actorType ?? "system",
      agent_role: entry.agentRole ?? null,
      action: entry.action,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      summary: entry.summary,
      metadata: entry.metadata ?? {},
    });
  } catch {
    // Audit logging must NEVER crash the main flow — swallow all errors
  }
}
