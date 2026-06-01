"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const ACTIVE_WS_COOKIE = "ai4c_active_ws";

/** Cookie key that stores the currently-selected workspace id. */
export async function getActiveWorkspaceId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(ACTIVE_WS_COOKIE)?.value ?? null;
}

/** Switch the active workspace. Verifies ownership or active membership before writing the cookie. */
export async function switchWorkspace(formData: FormData) {
  const user = await requireUser();
  const wsId = formData.get("workspace_id")?.toString();
  if (!wsId) return;

  const admin = createSupabaseAdminClient();

  // Check ownership first
  const { data: owned } = await admin
    .from("workspaces")
    .select("id")
    .eq("id", wsId)
    .eq("owner_id", user.id)
    .maybeSingle();

  // If not an owner, check for active membership
  if (!owned) {
    if (!user.email) return;
    const { data: member } = await admin
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", wsId)
      .eq("invitee_email", user.email.toLowerCase())
      .eq("status", "active")
      .maybeSingle();
    if (!member) return; // neither owner nor active member — silently ignore
  }

  const data = owned ?? { id: wsId };

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

const NameSchema = z.object({
  name: z.string().min(2).max(80).trim(),
});

/** Rename a workspace. Verifies ownership before updating. */
export async function renameWorkspace(
  workspaceId: string,
  name: string,
): Promise<{ error?: string }> {
  const user = await requireUser();
  const parsed = NameSchema.safeParse({ name });
  if (!parsed.success) return { error: "Name must be 2–80 characters." };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("workspaces")
    .update({ name: parsed.data.name })
    .eq("id", workspaceId)
    .eq("owner_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/workspaces");
  return {};
}

/** Delete a workspace. Cannot delete the last workspace. */
export async function deleteWorkspace(
  workspaceId: string,
): Promise<{ error?: string }> {
  const user = await requireUser();
  const admin = createSupabaseAdminClient();

  // Must own this workspace
  const { data: ws } = await admin
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!ws) return { error: "Workspace not found." };

  const { count } = await admin
    .from("workspaces")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);

  if ((count ?? 0) <= 1) {
    return { error: "You cannot delete your last workspace." };
  }

  const { error } = await admin
    .from("workspaces")
    .delete()
    .eq("id", workspaceId)
    .eq("owner_id", user.id);

  if (error) return { error: error.message };

  // If the deleted workspace was active, switch to another one
  try {
    const jar = await cookies();
    if (jar.get(ACTIVE_WS_COOKIE)?.value === workspaceId) {
      const { data: remaining } = await admin
        .from("workspaces")
        .select("id")
        .eq("owner_id", user.id)
        .eq("onboarded", true)
        .limit(1)
        .maybeSingle();
      if (remaining) {
        jar.set(ACTIVE_WS_COOKIE, remaining.id, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
        });
      } else {
        jar.delete(ACTIVE_WS_COOKIE);
      }
    }
  } catch { /* cookies() may be read-only in some runtimes */ }

  revalidatePath("/", "layout");
  return {};
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
