import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, AuthError } from "@/lib/auth/require";
import { getCurrentWorkspace } from "@/lib/workspace";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertOrgAdmin } from "@/lib/ceo-dashboard/access";
import type { CeoEntity, CeoRole } from "@/lib/ceo-dashboard/types";
import { EntitiesClient } from "./EntitiesClient";

export const dynamic = "force-dynamic";

export type RoleView = {
  id: string;
  email: string;
  role: CeoRole;
  entity_id: string | null;
  entity_name: string | null;
};

export default async function CeoEntitiesPage() {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }
  const ctx = await getCurrentWorkspace();
  if (!ctx) redirect("/onboarding");

  try {
    await assertOrgAdmin(user.id, ctx.workspace.id);
  } catch (e) {
    if (e instanceof AuthError) redirect("/ceo");
    throw e;
  }

  const admin = createSupabaseAdminClient();
  const [{ data: entities }, { data: roleRows }] = await Promise.all([
    admin
      .from("ceo_entities")
      .select(
        "id, org_id, name, industry_type, currency, is_active, sort_weight",
      )
      .eq("org_id", ctx.workspace.id)
      .order("sort_weight", { ascending: false }),
    admin
      .from("ceo_entity_roles")
      .select("id, role, entity_id, user_id")
      .eq("org_id", ctx.workspace.id)
      .order("created_at"),
  ]);

  const userIds = [...new Set((roleRows ?? []).map((r) => r.user_id))];
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id, email").in("id", userIds)
    : { data: [] };
  const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email]));
  const nameByEntity = new Map((entities ?? []).map((e) => [e.id, e.name]));

  const roles: RoleView[] = (roleRows ?? []).map((r) => ({
    id: r.id,
    email: emailById.get(r.user_id) ?? "unknown",
    role: r.role as CeoRole,
    entity_id: r.entity_id,
    entity_name: r.entity_id ? (nameByEntity.get(r.entity_id) ?? "—") : null,
  }));

  return (
    <main
      style={{ maxWidth: 980, margin: "0 auto", padding: "28px 20px 60px" }}
    >
      <header style={{ marginBottom: 26 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--gold)",
            fontWeight: 600,
            marginBottom: 6,
          }}
        >
          <Link
            href="/ceo"
            style={{ color: "inherit", textDecoration: "none" }}
          >
            ← CEO Command Center
          </Link>
        </div>
        <h1 style={{ fontWeight: 800, fontSize: 30 }}>Ventures & Roles</h1>
        <div style={{ color: "#8597B8", fontSize: 13, marginTop: 4 }}>
          Add ventures, set their revenue weight for the Group Pulse, and give
          your team scoped access.
        </div>
      </header>
      <EntitiesClient
        entities={(entities ?? []) as CeoEntity[]}
        roles={roles}
      />
    </main>
  );
}
