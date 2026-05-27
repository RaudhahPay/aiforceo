import { redirect } from "next/navigation";
import { Sidebar } from "@/app/_components/Sidebar";
import { getCurrentWorkspace } from "@/lib/workspace";
import { getRemainingTokens, TIER_MONTHLY_TOKENS } from "@/lib/credits";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/require";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const [user, ctx] = await Promise.all([requireUser(), getCurrentWorkspace()]);
  if (!ctx) redirect("/onboarding");
  const { workspace, allWorkspaces } = ctx;

  const admin = createSupabaseAdminClient();
  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  ).toISOString();

  const [
    remaining,
    { data: wsDetails },
    { data: profile },
    { data: voice },
    { data: latestPnl },
    { data: ledger },
    { data: convRows },
  ] = await Promise.all([
    getRemainingTokens(workspace.id),
    admin
      .from("workspaces")
      .select("tier, stripe_customer_id, stripe_subscription_id")
      .eq("id", workspace.id)
      .maybeSingle(),
    admin
      .from("business_profiles")
      .select(
        "industry, size, challenges, goals_90d, primary_offer, target_customer",
      )
      .eq("workspace_id", workspace.id)
      .maybeSingle(),
    admin
      .from("brand_voice")
      .select(
        "source_text, voice_summary, tone_attributes, words_to_use, words_to_avoid",
      )
      .eq("workspace_id", workspace.id)
      .maybeSingle(),
    admin
      .from("financial_snapshots")
      .select("raw_text, period")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("credit_ledger")
      .select("delta_tokens, reason, created_at, stripe_invoice_id")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(30),
    admin
      .from("conversations")
      .select("id, agent_role")
      .eq("workspace_id", workspace.id),
  ]);

  const quota = TIER_MONTHLY_TOKENS[workspace.tier] ?? 100_000;

  // Per-agent message counts MTD
  const convIds = (convRows ?? []).map((c) => c.id);
  let usageByAgent: Array<{ role: string; count: number }> = [];
  if (convIds.length > 0) {
    const { data: msgRows } = await admin
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", convIds)
      .eq("role", "assistant")
      .gte("created_at", startOfMonth);

    const convRoleMap: Record<string, string> = {};
    for (const c of convRows ?? []) convRoleMap[c.id] = c.agent_role;

    const countByRole: Record<string, number> = {};
    for (const m of msgRows ?? []) {
      const r = convRoleMap[m.conversation_id];
      if (r) countByRole[r] = (countByRole[r] ?? 0) + 1;
    }
    usageByAgent = Object.entries(countByRole)
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count);
  }

  return (
    <div
      className="grid min-h-screen"
      style={{ gridTemplateColumns: "240px 1fr" }}
    >
      <Sidebar
        active="settings"
        remainingTokens={remaining}
        monthlyQuota={quota}
        workspaceName={workspace.name}
        workspaceId={workspace.id}
        allWorkspaces={allWorkspaces}
      />
      <main className="p-10 overflow-y-auto">
        <div className="mb-8">
          <h1 className="serif text-3xl">Settings</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Manage your business profile, billing, team, and AI usage.
          </p>
        </div>
        <SettingsClient
          workspaceId={workspace.id}
          tier={wsDetails?.tier ?? workspace.tier}
          remaining={remaining}
          quota={quota}
          stripeCustomerId={wsDetails?.stripe_customer_id ?? null}
          stripeSubscriptionId={wsDetails?.stripe_subscription_id ?? null}
          ledger={(ledger ?? []).map((r) => ({
            deltaTokens: r.delta_tokens,
            reason: r.reason,
            createdAt: r.created_at,
            invoiceId: r.stripe_invoice_id ?? null,
          }))}
          usageByAgent={usageByAgent}
          ownerEmail={user.email ?? ""}
          initial={{
            businessName: workspace.name,
            industry: profile?.industry ?? "",
            size:
              (profile?.size as
                | "solo"
                | "small"
                | "mid"
                | "large"
                | "xlarge") ?? "small",
            challenges: profile?.challenges ?? [],
            goals90d: profile?.goals_90d ?? "",
            primaryOffer: profile?.primary_offer ?? "",
            targetCustomer: profile?.target_customer ?? "",
            voiceSample: voice?.source_text ?? "",
            voiceSummary: voice?.voice_summary ?? "",
            pnlText: latestPnl?.raw_text ?? "",
            pnlPeriod: latestPnl?.period ?? "",
          }}
        />
      </main>
    </div>
  );
}
