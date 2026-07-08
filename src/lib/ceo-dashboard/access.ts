/**
 * CEO Dashboard — server-side access checks.
 *
 * Server actions and pages use the admin client (bypasses RLS), so every
 * entry point MUST re-derive the caller's role here first — mirroring the
 * RLS helpers in 0016_ceo_core.sql. Never trust entity_id/org_id from a
 * client payload beyond using it as a lookup key.
 *
 * The workspace owner implicitly holds ALL roles (it is their company —
 * this also bootstraps the module before any roles are assigned). The
 * assigned `admin` role stays scoped per the spec: it manages entities,
 * users, and KPI definitions but is NOT finance.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AuthError } from "@/lib/auth/require";
import type { CeoEntity, CeoRole } from "./types";

const ALL_ROLES: CeoRole[] = [
  "group_ceo",
  "venture_ceo",
  "finance",
  "marketing",
  "ops",
  "admin",
];

export type EntityAccess = {
  entity: CeoEntity;
  roles: Set<CeoRole>;
  isOwner: boolean;
};

/** Load an entity and the caller's effective roles on it. */
export async function getEntityAccess(
  userId: string,
  entityId: string,
): Promise<EntityAccess> {
  const admin = createSupabaseAdminClient();

  const { data: entity, error } = await admin
    .from("ceo_entities")
    .select("id, org_id, name, industry_type, currency, is_active, sort_weight")
    .eq("id", entityId)
    .single();
  if (error || !entity) throw new AuthError("NOT_FOUND", "Venture not found");

  const [{ data: ws }, { data: roleRows }] = await Promise.all([
    admin
      .from("workspaces")
      .select("owner_id")
      .eq("id", entity.org_id)
      .single(),
    admin
      .from("ceo_entity_roles")
      .select("role, entity_id")
      .eq("user_id", userId)
      .eq("org_id", entity.org_id),
  ]);

  const isOwner = ws?.owner_id === userId;
  const roles = new Set<CeoRole>(isOwner ? ALL_ROLES : []);
  for (const r of roleRows ?? []) {
    if (r.entity_id === null || r.entity_id === entityId) {
      roles.add(r.role as CeoRole);
    }
  }

  return { entity: entity as CeoEntity, roles, isOwner };
}

/** Throws FORBIDDEN unless the caller holds one of `allowed` on the entity. */
export async function assertEntityRole(
  userId: string,
  entityId: string,
  allowed: CeoRole[],
): Promise<EntityAccess> {
  const access = await getEntityAccess(userId, entityId);
  if (!allowed.some((r) => access.roles.has(r))) {
    throw new AuthError(
      "FORBIDDEN",
      "You do not have access to do this for this venture",
    );
  }
  return access;
}

/** Throws FORBIDDEN unless the caller is the workspace owner or org-wide admin. */
export async function assertOrgAdmin(
  userId: string,
  orgId: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const [{ data: ws }, { data: roleRows }] = await Promise.all([
    admin.from("workspaces").select("owner_id").eq("id", orgId).single(),
    admin
      .from("ceo_entity_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("org_id", orgId)
      .is("entity_id", null)
      .in("role", ["admin", "group_ceo"]),
  ]);
  if (ws?.owner_id === userId) return;
  if ((roleRows ?? []).length > 0) return;
  throw new AuthError("FORBIDDEN", "Org admin access required");
}

export type GroupHq = { id: string; name: string };

/**
 * Resolve the user's group HQ workspace for the CEO Dashboard.
 *
 * aiforceo lets one user own/select several workspaces (one per business),
 * but the CEO command center is anchored to ONE group workspace holding the
 * ceo_entities. Following the *selected* workspace made /ceo show whatever
 * business the switcher was on (e.g. "WAROBOT — 0 ventures") instead of the
 * group. So: among all workspaces the user owns or holds any ceo role in,
 * pick the one with the most active ventures; fall back to the currently
 * selected workspace when none has ventures yet (first-run).
 */
export async function resolveGroupHq(
  userId: string,
  fallback: GroupHq,
): Promise<GroupHq> {
  const admin = createSupabaseAdminClient();
  const [{ data: owned }, { data: roleRows }] = await Promise.all([
    admin.from("workspaces").select("id, name").eq("owner_id", userId),
    admin.from("ceo_entity_roles").select("org_id").eq("user_id", userId),
  ]);

  const candidates = new Map<string, string | null>();
  for (const w of owned ?? []) candidates.set(w.id, w.name);
  for (const r of roleRows ?? []) {
    if (!candidates.has(r.org_id)) candidates.set(r.org_id, null);
  }
  if (candidates.size === 0) return fallback;

  const ids = [...candidates.keys()];
  const { data: entityRows } = await admin
    .from("ceo_entities")
    .select("org_id")
    .in("org_id", ids)
    .eq("is_active", true);

  const counts = new Map<string, number>();
  for (const e of entityRows ?? []) {
    counts.set(e.org_id, (counts.get(e.org_id) ?? 0) + 1);
  }
  if (counts.size === 0) return fallback;

  let bestId = fallback.id;
  let bestCount = counts.get(fallback.id) ?? 0;
  for (const [orgId, n] of counts) {
    if (n > bestCount) {
      bestId = orgId;
      bestCount = n;
    }
  }
  if (bestId === fallback.id) return fallback;

  let name = candidates.get(bestId) ?? null;
  if (!name) {
    const { data: w } = await admin
      .from("workspaces")
      .select("name")
      .eq("id", bestId)
      .single();
    name = w?.name ?? "Group";
  }
  return { id: bestId, name: name ?? "Group" };
}

/** All entities in the org the caller can see (owner/org-wide → all). */
export async function listAccessibleEntities(
  userId: string,
  orgId: string,
): Promise<CeoEntity[]> {
  const admin = createSupabaseAdminClient();
  const [{ data: ws }, { data: roleRows }, { data: entities }] =
    await Promise.all([
      admin.from("workspaces").select("owner_id").eq("id", orgId).single(),
      admin
        .from("ceo_entity_roles")
        .select("role, entity_id")
        .eq("user_id", userId)
        .eq("org_id", orgId),
      admin
        .from("ceo_entities")
        .select(
          "id, org_id, name, industry_type, currency, is_active, sort_weight",
        )
        .eq("org_id", orgId)
        .eq("is_active", true)
        .order("sort_weight", { ascending: false }),
    ]);

  const all = (entities ?? []) as CeoEntity[];
  const orgWide =
    ws?.owner_id === userId ||
    (roleRows ?? []).some((r) => r.entity_id === null);
  if (orgWide) return all;

  const allowed = new Set(
    (roleRows ?? []).map((r) => r.entity_id).filter(Boolean),
  );
  return all.filter((e) => allowed.has(e.id));
}
