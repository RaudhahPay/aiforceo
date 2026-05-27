import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  adminChangeTier,
  adminGrantTokens,
  adminSetOnboarded,
} from "@/server/actions/admin";
import { TIER_MONTHLY_TOKENS } from "@/lib/credits";

export const metadata = { title: "Customer Detail" };

const TIERS = ["trial", "starter", "growth", "scale"] as const;

const TIER_PILL: Record<string, string> = {
  trial: "bg-gray-100 text-gray-600",
  starter: "bg-blue-100 text-blue-700",
  growth: "bg-purple-100 text-purple-700",
  scale: "bg-orange-100 text-orange-700",
};

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

function fmtReason(r: string): string {
  const map: Record<string, string> = {
    monthly_reset: "Monthly quota",
    topup: "Top-up",
    chat: "AI usage",
    admin_grant: "Admin grant",
  };
  return map[r] ?? r;
}

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const admin = createSupabaseAdminClient();

  const { data: ws } = await admin
    .from("workspaces")
    .select(
      "id, name, tier, onboarded, setup_fee_paid, stripe_customer_id, stripe_subscription_id, owner_id, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!ws) notFound();

  const { data: profile } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", ws.owner_id)
    .maybeSingle();

  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  ).toISOString();

  const [
    { data: ledger },
    { data: conversations },
    { data: lastMessages },
    { data: connectors },
  ] = await Promise.all([
    admin
      .from("credit_ledger")
      .select("delta_tokens, reason, created_at, stripe_invoice_id")
      .eq("workspace_id", id)
      .order("created_at", { ascending: false })
      .limit(40),
    admin
      .from("conversations")
      .select("id, agent_role, title, updated_at")
      .eq("workspace_id", id)
      .order("updated_at", { ascending: false }),
    admin
      .from("messages")
      .select("id, role, content, created_at, conversations!inner(agent_role)")
      .eq("workspace_id", id)
      .order("created_at", { ascending: false })
      .limit(6),
    admin.from("connectors").select("provider, status").eq("workspace_id", id),
  ]);

  const tokensUsedMtd = (ledger ?? [])
    .filter((r) => r.delta_tokens < 0 && r.created_at >= startOfMonth)
    .reduce((s, r) => s + Math.abs(r.delta_tokens), 0);

  const tokensUsedAllTime = (ledger ?? [])
    .filter((r) => r.delta_tokens < 0)
    .reduce((s, r) => s + Math.abs(r.delta_tokens), 0);

  const quota = TIER_MONTHLY_TOKENS[ws.tier] ?? 100_000;

  const convIds = (conversations ?? []).map((c) => c.id);
  const { data: msgCountRows } = await admin
    .from("messages")
    .select("conversation_id")
    .in(
      "conversation_id",
      convIds.length > 0 ? convIds : ["00000000-0000-0000-0000-000000000000"],
    );

  const msgCounts: Record<string, number> = {};
  for (const r of msgCountRows ?? [])
    msgCounts[r.conversation_id] = (msgCounts[r.conversation_id] ?? 0) + 1;

  type RawMsg = {
    id: string;
    role: string;
    content: string;
    created_at: string;
    conversations: { agent_role: string }[] | { agent_role: string } | null;
  };
  const messages = ((lastMessages ?? []) as unknown as RawMsg[]).map((m) => {
    const conv = Array.isArray(m.conversations)
      ? m.conversations[0]
      : m.conversations;
    return { ...m, agent_role: conv?.agent_role ?? "?" };
  });

  return (
    <div className="p-10 max-w-5xl space-y-6">
      {/* Breadcrumb + title */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href="/admin/customers"
          className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
        >
          ← Customers
        </Link>
        <span className="text-[var(--line)]">/</span>
        <h1 className="serif text-2xl">{ws.name}</h1>
        <span
          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${TIER_PILL[ws.tier] ?? "bg-gray-100"}`}
        >
          {ws.tier}
        </span>
      </div>

      {/* Top info cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Owner */}
        <div className="card">
          <h2 className="font-bold text-xs uppercase tracking-wide text-[var(--muted)] mb-3">
            Owner
          </h2>
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ background: "var(--accent)" }}
            >
              {(profile?.email ?? "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">
                {profile?.full_name ?? "—"}
              </p>
              <p className="text-xs text-[var(--muted)] truncate">
                {profile?.email ?? "—"}
              </p>
            </div>
          </div>
          <dl className="space-y-1.5 text-xs">
            <Row
              label="Joined"
              value={new Date(ws.created_at).toLocaleDateString("en-MY", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            />
            <Row
              label="Stripe customer"
              value={
                ws.stripe_customer_id
                  ? ws.stripe_customer_id.slice(0, 20) + "…"
                  : "—"
              }
            />
            <Row
              label="Subscription"
              value={
                ws.stripe_subscription_id
                  ? ws.stripe_subscription_id.slice(0, 20) + "…"
                  : "—"
              }
            />
            <Row
              label="Setup fee"
              value={ws.setup_fee_paid ? "Paid" : "Not paid"}
            />
          </dl>
        </div>

        {/* Token usage */}
        <div className="card">
          <h2 className="font-bold text-xs uppercase tracking-wide text-[var(--muted)] mb-3">
            Token Usage
          </h2>
          <p className="text-xs text-[var(--muted)] mb-1">Used this month</p>
          <p className="serif text-3xl mb-2">{fmtNum(tokensUsedMtd)}</p>
          <div
            className="rounded-full h-2 overflow-hidden mb-1"
            style={{ background: "var(--soft)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (tokensUsedMtd / quota) * 100)}%`,
                background:
                  tokensUsedMtd / quota > 0.8
                    ? "#E5544B"
                    : tokensUsedMtd / quota > 0.5
                      ? "#E5A93C"
                      : "#3FB984",
              }}
            />
          </div>
          <p className="text-[11px] text-[var(--muted)]">
            {fmtNum(quota)} quota · {Math.round((tokensUsedMtd / quota) * 100)}%
            used
          </p>
          <div className="pt-3 mt-3 border-t border-[var(--line)]">
            <p className="text-xs text-[var(--muted)]">All-time consumed</p>
            <p className="text-lg font-bold mt-0.5">
              {fmtNum(tokensUsedAllTime)}
            </p>
          </div>
        </div>

        {/* Activity */}
        <div className="card">
          <h2 className="font-bold text-xs uppercase tracking-wide text-[var(--muted)] mb-3">
            Activity
          </h2>
          <dl className="space-y-2 text-sm">
            <Row
              label="Conversations"
              value={String((conversations ?? []).length)}
            />
            <Row
              label="Total messages"
              value={String(
                Object.values(msgCounts).reduce((a, b) => a + b, 0),
              )}
            />
            <Row
              label="Connectors active"
              value={String(
                (connectors ?? []).filter((c) => c.status === "active").length,
              )}
            />
            <Row label="Onboarded" value={ws.onboarded ? "✓ Yes" : "✗ No"} />
          </dl>
        </div>
      </div>

      {/* Admin actions */}
      <div className="card">
        <h2 className="font-bold text-base mb-5">Admin Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Change tier */}
          <div>
            <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide mb-2">
              Change Plan
            </p>
            <form action={adminChangeTier} className="flex gap-2">
              <input type="hidden" name="workspace_id" value={ws.id} />
              <select
                name="tier"
                defaultValue={ws.tier}
                className="input text-sm flex-1"
              >
                {TIERS.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn text-sm whitespace-nowrap">
                Update
              </button>
            </form>
            <p className="text-[11px] text-[var(--muted)] mt-1.5">
              Current: <strong>{ws.tier}</strong> · {fmtNum(quota)} tokens/mo
            </p>
          </div>

          {/* Grant tokens */}
          <div>
            <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide mb-2">
              Grant Tokens
            </p>
            <form action={adminGrantTokens} className="flex gap-2">
              <input type="hidden" name="workspace_id" value={ws.id} />
              <input type="hidden" name="note" value="admin_grant" />
              <input
                type="number"
                name="amount"
                min="1000"
                step="10000"
                defaultValue={100000}
                className="input text-sm flex-1"
              />
              <button
                type="submit"
                className="btn text-sm btn-primary whitespace-nowrap"
              >
                Grant
              </button>
            </form>
            <p className="text-[11px] text-[var(--muted)] mt-1.5">
              Credited to ledger immediately
            </p>
          </div>

          {/* Onboarded toggle */}
          <div>
            <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-wide mb-2">
              Onboarding Flag
            </p>
            <form action={adminSetOnboarded}>
              <input type="hidden" name="workspace_id" value={ws.id} />
              <input
                type="hidden"
                name="onboarded"
                value={ws.onboarded ? "false" : "true"}
              />
              <button
                type="submit"
                className={`btn text-sm w-full ${ws.onboarded ? "" : "btn-primary"}`}
              >
                {ws.onboarded ? "Mark as not onboarded" : "✓ Mark as onboarded"}
              </button>
            </form>
            <p className="text-[11px] text-[var(--muted)] mt-1.5">
              Currently: {ws.onboarded ? "✓ Onboarded" : "✗ Incomplete setup"}
            </p>
          </div>
        </div>
      </div>

      {/* Credit ledger */}
      <div className="card">
        <h2 className="font-bold text-base mb-4">Credit Ledger (last 40)</h2>
        {(ledger ?? []).length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No ledger entries.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  {[
                    { label: "Date", right: false },
                    { label: "Type", right: false },
                    { label: "Delta", right: true },
                    { label: "Balance", right: true },
                  ].map(({ label, right }) => (
                    <th
                      key={label}
                      className={`px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] ${right ? "text-right" : "text-left"}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {(() => {
                  let running = 0;
                  return [...(ledger ?? [])]
                    .reverse()
                    .map((entry, i) => {
                      running += entry.delta_tokens;
                      const pos = entry.delta_tokens > 0;
                      const row = (
                        <tr key={i} className="hover:bg-[var(--soft)]">
                          <td className="px-3 py-2 text-[var(--muted)] whitespace-nowrap text-xs">
                            {new Date(entry.created_at).toLocaleString(
                              "en-MY",
                              {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {fmtReason(entry.reason)}
                            {entry.stripe_invoice_id && (
                              <span className="text-[10px] text-[var(--muted)] ml-1.5">
                                #{entry.stripe_invoice_id.slice(-8)}
                              </span>
                            )}
                          </td>
                          <td
                            className="px-3 py-2 font-bold tabular-nums text-right text-xs"
                            style={{ color: pos ? "#3FB984" : "#E5544B" }}
                          >
                            {pos ? "+" : ""}
                            {fmtNum(entry.delta_tokens)}
                          </td>
                          <td className="px-3 py-2 tabular-nums text-right text-xs text-[var(--muted)]">
                            {fmtNum(running)}
                          </td>
                        </tr>
                      );
                      return row;
                    })
                    .reverse();
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Conversations */}
      <div className="card">
        <h2 className="font-bold text-base mb-4">
          Conversations ({(conversations ?? []).length})
        </h2>
        {(conversations ?? []).length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No conversations yet.</p>
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {(conversations ?? []).map((c) => (
              <div key={c.id} className="py-2.5 flex gap-3 items-center">
                <span
                  className="text-[11px] font-bold uppercase px-2 py-0.5 rounded shrink-0"
                  style={{ background: "var(--soft)", color: "var(--primary)" }}
                >
                  {c.agent_role}
                </span>
                <p className="flex-1 text-sm font-medium truncate">
                  {c.title || "Untitled"}
                </p>
                <span className="text-xs text-[var(--muted)] shrink-0">
                  {msgCounts[c.id] ?? 0} msgs
                </span>
                <span className="text-xs text-[var(--muted)] shrink-0">
                  {new Date(c.updated_at).toLocaleDateString("en-MY", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Last 6 messages */}
      <div className="card">
        <h2 className="font-bold text-base mb-4">Last 6 Messages</h2>
        {messages.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No messages yet.</p>
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {messages.map((m) => (
              <div key={m.id} className="py-3 flex gap-3 items-start">
                <span
                  className="text-[11px] font-bold uppercase px-2 py-0.5 rounded shrink-0 mt-0.5"
                  style={{
                    background:
                      m.role === "user" ? "var(--ink)" : "var(--soft)",
                    color: m.role === "user" ? "#fff" : "var(--primary)",
                  }}
                >
                  {m.role === "user" ? "user" : m.agent_role}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm line-clamp-2">
                    {m.content.slice(0, 240)}
                  </p>
                  <p className="text-[11px] text-[var(--muted)] mt-0.5">
                    {new Date(m.created_at).toLocaleString()}
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--muted)] shrink-0">{label}</dt>
      <dd className="font-medium text-right truncate max-w-[180px]">{value}</dd>
    </div>
  );
}
