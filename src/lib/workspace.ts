// Read helpers for the current user's workspace.
// Respects the boardroom_active_ws cookie so multi-workspace users can switch companies.
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

const ACTIVE_WS_COOKIE = "boardroom_active_ws";

export type WorkspaceStub = {
  id: string;
  name: string;
  tier: string;
};

export type WorkspaceContext = {
  user: User;
  workspace: {
    id: string;
    name: string;
    tier: "trial" | "starter" | "growth" | "scale";
    monthly_token_quota: number;
    onboarded: boolean;
  };
  /** All workspaces owned by this user — used for the sidebar switcher and Group View */
  allWorkspaces: WorkspaceStub[];
  profile: {
    industry: string | null;
    size: string | null;
    challenges: string[] | null;
    goals_90d: string | null;
  } | null;
  voice: {
    voice_summary: string | null;
    tone_attributes: string[] | null;
    words_to_use: string[] | null;
    words_to_avoid: string[] | null;
  } | null;
};

export async function getCurrentWorkspace(): Promise<WorkspaceContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Check if the user has selected a specific workspace via cookie
  const jar = await cookies();
  const activeWsId = jar.get(ACTIVE_WS_COOKIE)?.value;

  const baseQuery = supabase
    .from("workspaces")
    .select("id, name, tier, monthly_token_quota, onboarded")
    .eq("owner_id", user.id)
    .limit(1);

  // Try the cookie-selected workspace first; fall back to the oldest (default)
  const { data: ws } = activeWsId
    ? await baseQuery.eq("id", activeWsId).maybeSingle()
    : await baseQuery.order("created_at", { ascending: true }).maybeSingle();

  // If the cookie pointed to a deleted/invalid workspace, fall back
  const { data: fallbackWs } =
    !ws && activeWsId
      ? await supabase
          .from("workspaces")
          .select("id, name, tier, monthly_token_quota, onboarded")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle()
      : { data: null };

  const resolved = ws ?? fallbackWs;
  if (!resolved) return null;

  const [{ data: profile }, { data: voice }, { data: allWs }] =
    await Promise.all([
      supabase
        .from("business_profiles")
        .select("industry, size, challenges, goals_90d")
        .eq("workspace_id", resolved.id)
        .maybeSingle(),
      supabase
        .from("brand_voice")
        .select("voice_summary, tone_attributes, words_to_use, words_to_avoid")
        .eq("workspace_id", resolved.id)
        .maybeSingle(),
      supabase
        .from("workspaces")
        .select("id, name, tier")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true }),
    ]);

  return {
    user,
    workspace: resolved,
    allWorkspaces: (allWs ?? []) as WorkspaceStub[],
    profile: profile ?? null,
    voice: voice ?? null,
  };
}
