"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const VALID_TIERS = ["trial", "starter", "growth", "scale"] as const;
type Tier = (typeof VALID_TIERS)[number];

/** Change a workspace's subscription tier. */
export async function adminChangeTier(formData: FormData): Promise<void> {
  await requireAdmin();
  const workspaceId = String(formData.get("workspace_id") ?? "");
  const tier = String(formData.get("tier") ?? "") as Tier;
  if (!workspaceId || !VALID_TIERS.includes(tier)) return;

  const admin = createSupabaseAdminClient();
  await admin
    .from("workspaces")
    .update({ tier })
    .eq("id", workspaceId)
    .throwOnError();

  revalidatePath(`/admin/customers/${workspaceId}`);
  revalidatePath("/admin/customers");
  revalidatePath("/admin");
}

/** Manually credit tokens to a workspace (e.g. support gesture, manual top-up). */
export async function adminGrantTokens(formData: FormData): Promise<void> {
  await requireAdmin();
  const workspaceId = String(formData.get("workspace_id") ?? "");
  const amount = parseInt(String(formData.get("amount") ?? "0"), 10);
  const note =
    String(formData.get("note") ?? "admin_grant").trim() || "admin_grant";
  if (!workspaceId || amount <= 0) return;

  const admin = createSupabaseAdminClient();
  await admin
    .from("credit_ledger")
    .insert({ workspace_id: workspaceId, delta_tokens: amount, reason: note })
    .throwOnError();

  revalidatePath(`/admin/customers/${workspaceId}`);
}

/** Toggle the onboarded flag on a workspace. */
export async function adminSetOnboarded(formData: FormData): Promise<void> {
  await requireAdmin();
  const workspaceId = String(formData.get("workspace_id") ?? "");
  const value = formData.get("onboarded") === "true";
  if (!workspaceId) return;

  const admin = createSupabaseAdminClient();
  await admin
    .from("workspaces")
    .update({ onboarded: value })
    .eq("id", workspaceId)
    .throwOnError();

  revalidatePath(`/admin/customers/${workspaceId}`);
  revalidatePath("/admin/customers");
}
