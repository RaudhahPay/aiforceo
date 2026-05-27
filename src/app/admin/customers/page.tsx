import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CustomersClient, type CustomerRow } from "./CustomersClient";

export const metadata = { title: "Customers" };

export default async function AdminCustomersPage(): Promise<React.ReactElement> {
  const admin = createSupabaseAdminClient();

  const { data: workspaces } = await admin
    .from("workspaces")
    .select(
      "id, name, tier, onboarded, created_at, stripe_customer_id, owner_id",
    )
    .order("created_at", { ascending: false });

  if (!workspaces || workspaces.length === 0) {
    return (
      <div className="p-10">
        <h1 className="serif text-4xl mb-8">Customers</h1>
        <p className="text-[var(--muted)]">No workspaces yet.</p>
      </div>
    );
  }

  // Owner profiles
  const ownerIds = [...new Set(workspaces.map((w) => w.owner_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, full_name")
    .in("id", ownerIds);

  const profileMap: Record<
    string,
    { email: string | null; full_name: string | null }
  > = {};
  for (const p of profiles ?? []) {
    profileMap[p.id] = { email: p.email, full_name: p.full_name };
  }

  // Token usage MTD
  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  ).toISOString();
  const wsIds = workspaces.map((w) => w.id);
  const { data: ledgerRows } = await admin
    .from("credit_ledger")
    .select("workspace_id, delta_tokens")
    .in("workspace_id", wsIds)
    .lt("delta_tokens", 0)
    .gte("created_at", startOfMonth);

  const tokensByWs: Record<string, number> = {};
  for (const row of ledgerRows ?? []) {
    tokensByWs[row.workspace_id] =
      (tokensByWs[row.workspace_id] ?? 0) + Math.abs(row.delta_tokens);
  }

  const rows: CustomerRow[] = workspaces.map((ws) => ({
    id: ws.id,
    name: ws.name,
    email: profileMap[ws.owner_id]?.email ?? null,
    fullName: profileMap[ws.owner_id]?.full_name ?? null,
    tier: ws.tier,
    tokensMtd: tokensByWs[ws.id] ?? 0,
    onboarded: ws.onboarded,
    createdAt: ws.created_at,
    stripeCustomerId: ws.stripe_customer_id ?? null,
  }));

  return (
    <div className="p-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="serif text-4xl">Customers</h1>
        <span className="px-3 py-1.5 rounded-full text-xs font-bold border border-[var(--line)] text-[var(--muted)]">
          {workspaces.length} total
        </span>
      </div>
      <CustomersClient rows={rows} />
    </div>
  );
}
