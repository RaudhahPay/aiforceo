// Permission gates — the security boundary that every write sits behind.
// Per SOP §4.2 + D-004.
//
// Pattern: every 'use server' action that performs a write MUST first call
// one of these helpers. They either return the verified actor or throw an
// AuthError. The caller then uses createSupabaseAdminClient() for the
// actual write.
//
// Re-derive security-relevant values server-side — never trust a workspace_id
// or owner_id arriving from the client payload (SOP §4.3).
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export class AuthError extends Error {
  readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND";
  constructor(code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND", message: string) {
    super(message);
    this.code = code;
    this.name = "AuthError";
  }
}

/**
 * Asserts the request is from an authenticated user.
 * Throws AuthError("UNAUTHENTICATED") otherwise.
 */
export async function requireUser(): Promise<User> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new AuthError("UNAUTHENTICATED", "Sign in required");
  }
  return data.user;
}

export type OwnedWorkspace = {
  id: string;
  name: string;
  tier: "trial" | "starter" | "growth" | "scale";
  onboarded: boolean;
  monthly_token_quota: number;
};

/**
 * Asserts the current user owns the given workspace. If workspaceId is not
 * supplied, returns the user's first workspace (v0.1 has exactly one per
 * user — D-009). Re-derives ownership server-side; never trust a client
 * payload's workspace_id.
 *
 * Throws:
 *   AuthError("UNAUTHENTICATED") if not signed in
 *   AuthError("NOT_FOUND") if no workspace exists
 *   AuthError("FORBIDDEN") if the user does not own it
 */
export async function requireWorkspaceOwner(
  workspaceId?: string
): Promise<{ user: User; workspace: OwnedWorkspace }> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const query = supabase
    .from("workspaces")
    .select("id, name, tier, onboarded, monthly_token_quota, owner_id")
    .limit(1);

  const { data, error } = workspaceId
    ? await query.eq("id", workspaceId).maybeSingle()
    : await query.eq("owner_id", user.id).order("created_at", { ascending: true }).maybeSingle();

  if (error) {
    throw new AuthError("NOT_FOUND", error.message);
  }
  if (!data) {
    throw new AuthError("NOT_FOUND", "No workspace");
  }
  if (data.owner_id !== user.id) {
    throw new AuthError("FORBIDDEN", "Not your workspace");
  }
  return {
    user,
    workspace: {
      id: data.id,
      name: data.name,
      tier: data.tier,
      onboarded: data.onboarded,
      monthly_token_quota: data.monthly_token_quota
    }
  };
}
