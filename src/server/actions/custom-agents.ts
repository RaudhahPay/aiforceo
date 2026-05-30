"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspace } from "@/lib/workspace";

export type CustomAgent = {
  id: string;
  workspace_id: string;
  name: string;
  title: string;
  description: string;
  system_prompt: string;
  gradient_from: string;
  gradient_to: string;
  created_at: string;
  updated_at: string;
};

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: string };

const AgentSchema = z.object({
  name:          z.string().min(2).max(40).trim(),
  title:         z.string().min(2).max(60).trim(),
  description:   z.string().max(200).default(""),
  system_prompt: z.string().min(20).max(4000).trim(),
  gradient_from: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366F1"),
  gradient_to:   z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#8B5CF6"),
});

export async function getCustomAgents(): Promise<CustomAgent[]> {
  await requireUser();
  const ctx = await getCurrentWorkspace();
  if (!ctx) return [];
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("custom_agents")
    .select("*")
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: true });
  return (data ?? []) as CustomAgent[];
}

export async function createCustomAgent(input: unknown): Promise<Result<{ id: string }>> {
  const parsed = AgentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  await requireUser();
  const ctx = await getCurrentWorkspace();
  if (!ctx) return { ok: false, error: "No workspace found." };

  // Limit: 10 custom agents per workspace
  const admin = createSupabaseAdminClient();
  const { count } = await admin
    .from("custom_agents")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", ctx.workspace.id);
  if ((count ?? 0) >= 10) return { ok: false, error: "Maximum 10 custom agents per workspace." };

  const { data, error } = await admin
    .from("custom_agents")
    .insert({ workspace_id: ctx.workspace.id, ...parsed.data })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed." };
  revalidatePath("/", "layout");
  return { ok: true, data: { id: data.id } };
}

export async function updateCustomAgent(id: string, input: unknown): Promise<Result> {
  const parsed = AgentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  await requireUser();
  const ctx = await getCurrentWorkspace();
  if (!ctx) return { ok: false, error: "No workspace found." };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("custom_agents")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteCustomAgent(id: string): Promise<Result> {
  await requireUser();
  const ctx = await getCurrentWorkspace();
  if (!ctx) return { ok: false, error: "No workspace found." };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("custom_agents")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
