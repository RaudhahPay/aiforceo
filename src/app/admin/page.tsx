import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export const metadata = { title: "Admin Overview" };

const TIER_MRR: Record<string, number> = {
  trial: 0,
  starter: 49,
  growth: 149,
  scale: 399,
};

const TIER_PILL: Record<string, string> = {
  trial: "bg-gray-100 text-gray-600",
  starter: "bg-blue-100 text-blue-700",
  growth: "bg-purple-100 text-purple-700",
  scale: "bg-orange-100 text-orange-700",
};

export default async function AdminOverviewPage(): Promise<React.ReactElement> {
  const admin = createSupabaseAdminClient();
  const now = new Date();

  const startOfMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  ).toISOString();
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [
    { data: allWorkspaces },
    { data: tokenRows },
    { count: newSignups30d },
    { data: activeWsRows },
    { data: recentMessages },
    { count: allMessageCount },
  ] = await Promise.all([
    admin
      .from("workspaces")
      .select("id, tier, created_at")
      .order("created_at", { ascending: false }),
    admin
      .from("credit_ledger")
      .select("delta_tokens")
      .lt("delta_tokens", 0)
      .gte("created_at", startOfMonth),
    admin
      .from("workspaces")
      .select("*", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo),
    // Distinct workspace_ids with messages in last 7 days
    admin
      .from("messages")
      .select("workspace_id")
      .gte("created_at", sevenDaysAgo),
    admin
      .from("messages")
      .select(
        "id, role, content, created_at, workspace_id, conversations!inner(agent_role)",
      )
      .eq("role", "assistant")
      .order("created_at", { ascending: false })
      .limit(12),
    admin.from("messages").select("id", { count: "exact", head: true }),
  ]);

  // Metrics
  const totalWorkspaces = (allWorkspaces ?? []).length;
  const tokensConsumed = (tokenRows ?? []).reduce(
    (s, r) => s + Math.abs(r.delta_tokens),
    0,
  );

  const tierCounts: Record<string, number> = {};
  let mrr = 0;
  for (const ws of allWorkspaces ?? []) {
    tierCounts[ws.tier] = (tierCounts[ws.tier] ?? 0) + 1;
    mrr += TIER_MRR[ws.tier] ?? 0;
  }

  const activeWsIds = new Set((activeWsRows ?? []).map((r) => r.workspace_id));
  const activeUsers7d = activeWsIds.size;

  const paidCount =
    (tierCounts.starter ?? 0) +
    (tierCounts.growth ?? 0) +
    (tierCounts.scale ?? 0);
  const trialCount = tierCounts.trial ?? 0;
  const convRate =
    totalWorkspaces > 0 ? Math.round((paidCount / totalWorkspaces) * 100) : 0;

  type RawMsg = {
    id: string;
    role: string;
    content: string;
    created_at: string;
    workspace_id: string;
    conversations: { agent_role: string }[] | { agent_role: string } | null;
  };
  const activity = ((recentMessages ?? []) as unknown as RawMsg[]).map((m) => {
    const conv = Array.isArray(m.conversations)
      ? m.conversations[0]
      : m.conversations;
    return { ...m, agent_role: conv?.agent_role ?? "?" };
  });

  return (
    <div className="p-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="serif text-4xl">Admin Overview</h1>
        <span className="text-xs text-[var(--muted)]">
          {now.toLocaleDateString("en-MY", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="MRR (estimate)"
          value={`$${mrr.toLocaleString()}`}
          sub="based on tier"
          accent
        />
        <StatCard
          label="Total Workspaces"
          value={String(totalWorkspaces)}
          sub={`+${newSignups30d ?? 0} in 30d`}
        />
        <StatCard
          label="Active (7d)"
          value={String(activeUsers7d)}
          sub="workspaces with msgs"
        />
        <StatCard
          label="Tokens Used MTD"
          value={fmtNum(tokensConsumed)}
          sub="across all customers"
        />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Paid Customers"
          value={String(paidCount)}
          sub={`${trialCount} on trial`}
        />
        <StatCard
          label="Trial → Paid"
          value={`${convRate}%`}
          sub="conversion rate"
        />
        <StatCard
          label="Total Messages"
          value={fmtNum(allMessageCount ?? 0)}
          sub="all time"
        />
        <StatCard
          label="ARR (estimate)"
          value={`$${(mrr * 12).toLocaleString()}`}
          sub="annualised"
        />
      </div>

      {/* Tier breakdown */}
      <div className="card">
        <h2 className="font-bold text-base mb-4">Tier Breakdown</h2>
        <div className="flex flex-wrap gap-3 mb-4">
          {(["trial", "starter", "growth", "scale"] as const).map((tier) => (
            <div
              key={tier}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${TIER_PILL[tier]}`}
            >
              <span className="capitalize">{tier}</span>
              <span className="font-bold text-base">
                {tierCounts[tier] ?? 0}
              </span>
              {(TIER_MRR[tier] ?? 0) > 0 && (
                <span className="text-[11px] opacity-70">
                  $
                  {(
                    (tierCounts[tier] ?? 0) * (TIER_MRR[tier] ?? 0)
                  ).toLocaleString()}
                  /mo
                </span>
              )}
            </div>
          ))}
        </div>
        {/* Visual bar */}
        <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
          {(["trial", "starter", "growth", "scale"] as const).map((tier) => {
            const count = tierCounts[tier] ?? 0;
            if (!count) return null;
            const pct = (count / totalWorkspaces) * 100;
            const bg: Record<string, string> = {
              trial: "#94a3b8",
              starter: "#0096C7",
              growth: "#7C3AED",
              scale: "#F96167",
            };
            return (
              <div
                key={tier}
                style={{ width: `${pct}%`, background: bg[tier] }}
                title={`${tier}: ${count}`}
              />
            );
          })}
        </div>
      </div>

      {/* Growth signal: recent signups */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-base">Recent Signups</h2>
          <Link
            href="/admin/customers"
            className="text-xs text-[var(--accent)] hover:underline"
          >
            View all →
          </Link>
        </div>
        {(allWorkspaces ?? []).length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No workspaces yet.</p>
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {(allWorkspaces ?? []).slice(0, 8).map((ws) => (
              <div key={ws.id} className="py-2.5 flex items-center gap-3">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${TIER_PILL[ws.tier] ?? "bg-gray-100 text-gray-600"}`}
                >
                  {ws.tier}
                </span>
                <span className="text-xs font-mono text-[var(--muted)] flex-1 truncate">
                  {ws.id.slice(0, 16)}…
                </span>
                <span className="text-xs text-[var(--muted)] shrink-0">
                  {new Date(ws.created_at).toLocaleDateString("en-MY", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <Link
                  href={`/admin/customers/${ws.id}`}
                  className="text-xs text-[var(--accent)] hover:underline shrink-0"
                >
                  View →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent activity */}
      <div className="card">
        <h2 className="font-bold text-base mb-4">Live Activity Feed</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No messages yet.</p>
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {activity.map((m) => (
              <div key={m.id} className="py-3 flex gap-3 items-start">
                <span
                  className="px-2 py-0.5 rounded text-[11px] font-bold uppercase shrink-0 mt-0.5"
                  style={{ background: "var(--soft)", color: "var(--primary)" }}
                >
                  {m.agent_role}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm line-clamp-2 text-[var(--ink)]">
                    {m.content.slice(0, 160)}
                  </p>
                  <p className="text-[11px] text-[var(--muted)] mt-0.5">
                    {new Date(m.created_at).toLocaleString()} · ws:
                    {m.workspace_id.slice(0, 8)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="card">
      <p className="text-xs text-[var(--muted)] font-semibold uppercase tracking-wider mb-1">
        {label}
      </p>
      <p
        className={`serif text-3xl font-bold ${accent ? "text-[var(--accent)]" : ""}`}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-[var(--muted)] mt-1">{sub}</p>}
    </div>
  );
}
