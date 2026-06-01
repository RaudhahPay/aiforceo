// Read helpers for the current user's workspace.
// Supports both workspace owners and invited members.
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { User } from "@supabase/supabase-js";

const ACTIVE_WS_COOKIE = "ai4c_active_ws";

export type WorkspaceStub = {
  id: string;
  name: string;
  tier: string;
  isOwner: boolean;
};

export type WorkspaceContext = {
  user: User;
  workspace: {
    id: string;
    name: string;
    tier: "trial" | "starter" | "growth" | "scale";
    monthly_token_quota: number;
    onboarded: boolean;
    /** True if this user owns the workspace; false if they joined via invite */
    isOwner: boolean;
    /** Role for invited members; null for owners */
    memberRole: "viewer" | "editor" | "manager" | null;
  };
  /** All workspaces this user owns or is an active member of */
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

type WorkspaceRow = {
  id: string;
  name: string;
  tier: "trial" | "starter" | "growth" | "scale";
  monthly_token_quota: number;
  onboarded: boolean;
};

export async function getCurrentWorkspace(): Promise<WorkspaceContext | null> {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const jar = await cookies();
  const activeWsId = jar.get(ACTIVE_WS_COOKIE)?.value;

  let resolved: WorkspaceRow | null = null;
  let isOwner = true;
  let memberRole: "viewer" | "editor" | "manager" | null = null;

  // ── 1. Try the cookie-selected workspace ──────────────────────────────────
  if (activeWsId) {
    // Check ownership first — use admin client (user already verified via auth)
    const { data: ownedWs } = await admin
      .from("workspaces")
      .select("id, name, tier, monthly_token_quota, onboarded")
      .eq("id", activeWsId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (ownedWs) {
      resolved = ownedWs as WorkspaceRow;
      isOwner = true;
    } else if (user.email) {
      // Check membership
      const { data: mem } = await admin
        .from("workspace_members")
        .select(
          "role, workspaces(id, name, tier, monthly_token_quota, onboarded)",
        )
        .eq("workspace_id", activeWsId)
        .eq("invitee_email", user.email.toLowerCase())
        .eq("status", "active")
        .maybeSingle();

      if (mem?.workspaces) {
        resolved = mem.workspaces as unknown as WorkspaceRow;
        isOwner = false;
        memberRole = mem.role as "viewer" | "editor" | "manager";
      }
    }
  }

  // ── 2. No cookie (or cookie miss) — default to oldest onboarded owned workspace ─
  if (!resolved) {
    // Use admin client to bypass RLS — we already verified user via auth.getUser()
    const { data: ownedWs } = await admin
      .from("workspaces")
      .select("id, name, tier, monthly_token_quota, onboarded")
      .eq("owner_id", user.id)
      .eq("onboarded", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (ownedWs) {
      resolved = ownedWs as WorkspaceRow;
      isOwner = true;
    }
  }

  // ── 3. No owned workspace — fall back to oldest active membership ─────────
  if (!resolved && user.email) {
    const { data: mem } = await admin
      .from("workspace_members")
      .select(
        "role, workspaces(id, name, tier, monthly_token_quota, onboarded)",
      )
      .eq("invitee_email", user.email.toLowerCase())
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (mem?.workspaces) {
      resolved = mem.workspaces as unknown as WorkspaceRow;
      isOwner = false;
      memberRole = mem.role as "viewer" | "editor" | "manager";
    }
  }

  if (!resolved) return null;

  // ── 4. Load supporting data + all accessible workspaces ───────────────────
  const [
    { data: profile },
    { data: voice },
    { data: ownedAll },
    { data: memberAll },
  ] = await Promise.all([
    admin
      .from("business_profiles")
      .select("industry, size, challenges, goals_90d")
      .eq("workspace_id", resolved.id)
      .maybeSingle(),
    admin
      .from("brand_voice")
      .select("voice_summary, tone_attributes, words_to_use, words_to_avoid")
      .eq("workspace_id", resolved.id)
      .maybeSingle(),
    admin
      .from("workspaces")
      .select("id, name, tier")
      .eq("owner_id", user.id)
      .eq("onboarded", true)
      .order("created_at", { ascending: true }),
    user.email
      ? admin
          .from("workspace_members")
          .select("workspaces(id, name, tier)")
          .eq("invitee_email", user.email.toLowerCase())
          .eq("status", "active")
      : Promise.resolve({ data: [] }),
  ]);

  const memberWorkspaces: WorkspaceStub[] = (memberAll ?? [])
    .map(
      (m) =>
        (m.workspaces as unknown as {
          id: string;
          name: string;
          tier: string;
        }) ?? null,
    )
    .filter(Boolean)
    .map((w) => ({ ...w, isOwner: false }));

  const ownedWorkspaces: WorkspaceStub[] = (ownedAll ?? []).map((w) => ({
    ...w,
    isOwner: true,
  }));

  // Deduplicate (in case a user somehow owns and is also a member of the same ws)
  const seen = new Set(ownedWorkspaces.map((w) => w.id));
  const allWorkspaces: WorkspaceStub[] = [
    ...ownedWorkspaces,
    ...memberWorkspaces.filter((w) => !seen.has(w.id)),
  ];

  return {
    user,
    workspace: {
      ...resolved,
      isOwner,
      memberRole,
    },
    allWorkspaces,
    profile: profile ?? null,
    voice: voice ?? null,
  };
}
