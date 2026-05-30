"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const ACTIVE_WS_COOKIE = "boardroom_active_ws";

/** Cookie key that stores the currently-selected workspace id. */
export async function getActiveWorkspaceId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(ACTIVE_WS_COOKIE)?.value ?? null;
}

/** Switch the active workspace. Verifies ownership before writing the cookie. */
export async function switchWorkspace(formData: FormData) {
  const user = await requireUser();
  const wsId = formData.get("workspace_id")?.toString();
  if (!wsId) return;

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("workspaces")
    .select("id")
    .eq("id", wsId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!data) return; // not their workspace — silently ignore

  const jar = await cookies();
  jar.set(ACTIVE_WS_COOKIE, wsId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  // Bust router cache for all agent pages so the new workspace loads fresh
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/** Create a fresh conversation for the given role in the active workspace. */
export async function newConversation(
  role: string,
): Promise<{ id: string } | { error: string }> {
  const user = await requireUser();
  const admin = createSupabaseAdminClient();

  // Resolve active workspace
  const jar = await cookies();
  const wsId = jar.get(ACTIVE_WS_COOKIE)?.value;
  if (!wsId) return { error: "No active workspace" };

  const { data: ws } = await admin
    .from("workspaces")
    .select("id")
    .eq("id", wsId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!ws) return { error: "Workspace not found" };

  const { data, error } = await admin
    .from("conversations")
    .insert({ workspace_id: ws.id, agent_role: role, title: "New chat" })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Insert failed" };
  return { id: data.id };
}

/** Delete a workspace. Cannot delete last workspace or active workspace if it's the only one. */
export async function deleteWorkspace(formData: FormData): Promise<void> {
  const user = await requireUser();
  const wsId = formData.get("workspace_id")?.toString();
  if (!wsId) return;

  const admin = createSupabaseAdminClient();

  // Must own this workspace
  const { data: ws } = await admin
    .from("workspaces")
    .select("id")
    .eq("id", wsId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!ws) return;

  // Must not be last workspace
  const { count } = await admin
    .from("workspaces")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);
  if ((count ?? 0) <= 1) throw new Error("Cannot delete your only workspace.");

  await admin.from("workspaces").delete().eq("id", wsId).eq("owner_id", user.id);

  // Clear active cookie if it pointed to the deleted workspace
  const jar = await cookies();
  if (jar.get(ACTIVE_WS_COOKIE)?.value === wsId) {
    jar.delete(ACTIVE_WS_COOKIE);
  }
  revalidatePath("/", "layout");
  redirect("/workspaces");
}

const CreateSchema = z.object({
  name: z.string().min(2).max(80).trim(),
});

/** Create a new workspace and immediately switch to it. */
export async function createWorkspace(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = CreateSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) throw new Error("Name must be 2–80 characters.");

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("workspaces")
    .insert({
      owner_id: user.id,
      name: parsed.data.name,
      tier: "trial",
      monthly_token_quota: 100_000,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error("Could not create workspace.");

  // Grant 100K trial tokens
  await admin.from("credit_ledger").insert({
    workspace_id: data.id,
    delta_tokens: 100_000,
    reason: "trial_grant",
  });

  const jar = await cookies();
  jar.set(ACTIVE_WS_COOKIE, data.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/onboarding");
}
