"use server";

import { requireWorkspaceOwner } from "@/lib/auth/require";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AuditAction } from "@/lib/audit";

export type AuditLogEntry = {
  id: string;
  workspaceId: string;
  actorId: string | null;
  actorType: "user" | "agent" | "system";
  agentRole: string | null;
  action: AuditAction;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export async function listAuditLog(limit = 50): Promise<AuditLogEntry[]> {
  const { workspace } = await requireWorkspaceOwner();
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("audit_log")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    actorId: row.actor_id as string | null,
    actorType: row.actor_type as "user" | "agent" | "system",
    agentRole: row.agent_role as string | null,
    action: row.action as AuditAction,
    entityType: row.entity_type as string | null,
    entityId: row.entity_id as string | null,
    summary: row.summary as string,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.created_at as string,
  }));
}
