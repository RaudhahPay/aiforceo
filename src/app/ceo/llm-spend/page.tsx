/**
 * CEO Dashboard — AI spend (LLM Gateway).
 *
 * Group-wide AI cost pulled from the LLM Gateway's /stats endpoint. The gateway
 * routes every venture app's LLM calls to the cheapest capable model and logs
 * the cost, so this page answers two CEO questions: what is AI costing us, and
 * what would it have cost if everything ran on a frontier model.
 *
 * Figures are USD (provider billing) — deliberately not converted to RM.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require";
import { Stat, C } from "@/app/_components/dashboard-primitives";
import { SectionCard } from "@/app/ceo/_components/ui";
import { fetchGatewayStats, usd, gwPct } from "@/lib/llm-gateway";
import { SpendTrend } from "./SpendTrend";

export const dynamic = "force-dynamic";

const cell: React.CSSProperties = {
  padding: "9px 12px",
  borderBottom: `1px solid ${C.line}`,
  fontSize: 13,
};
const head: React.CSSProperties = {
  ...cell,
  color: C.dim,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};
const numCell: React.CSSProperties = {
  ...cell,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

/** Budget pressure — same thresholds the gateway's own dashboard uses. */
function budgetTone(pctUsed: number): { color: string; label: string } {
  if (pctUsed >= 100) return { color: C.red, label: "OVER CAP" };
  if (pctUsed >= 80) return { color: C.amber, label: "NEAR CAP" };
  return { color: C.green, label: "HEALTHY" };
}

export default async function CeoLlmSpendPage() {
  try {
    await requireUser();
  } catch {
    redirect("/login");
  }

  const stats = await fetchGatewayStats();

  if (!stats) {
    return (
      <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ fontSize: 20, marginBottom: 6 }}>AI spend</h1>
        <SectionCard title="Gateway not connected">
          <p style={{ color: C.dim, fontSize: 13, lineHeight: 1.7, margin: 0 }}>
            Set <code>LLM_GATEWAY_URL</code> and <code>LLM_GATEWAY_KEY</code> in
            the environment to show group-wide AI spend here. The key is an app
            key issued by the gateway (<code>scripts/hash-key.mjs aiforceo</code>{" "}
            in the llm-gateway repo). If both are set, the gateway may be
            unreachable — this panel fails soft so it can never break the
            dashboard.
          </p>
        </SectionCard>
      </div>
    );
  }

  const t = stats.totals;
  const totalCalls = t.calls7d + t.errors7d;
  const errRate = totalCalls > 0 ? (t.errors7d / totalCalls) * 100 : 0;
  const avgCost = t.calls7d > 0 ? t.cost7d / t.calls7d : 0;

  // A model that is attempted repeatedly but never succeeds is unreachable,
  // not unused — that distinction is the whole point of surfacing this.
  const failing = stats.modelAttempts.filter(
    (m) => Number(m.attempts) > 0 && Number(m.succeeded) === 0,
  );

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 16,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, margin: 0 }}>AI spend</h1>
          <div style={{ color: C.dim, fontSize: 12, marginTop: 4 }}>
            LLM Gateway · task-tag routing to the cheapest capable model · USD
          </div>
        </div>
        <Link href="/ceo" style={{ color: C.dim, fontSize: 12 }}>
          ← Group overview
        </Link>
      </div>

      {/* Headline numbers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Stat
          label="Spend · last 7d"
          value={usd(t.cost7d)}
          sub={`${t.calls7d.toLocaleString()} calls`}
        />
        <Stat
          label="Saved vs all-Sonnet"
          value={t.baseline7d > 0 ? gwPct(t.savedPct) : "—"}
          sub={`${usd(t.baseline7d)} baseline`}
          tone="good"
        />
        <Stat
          label="Error rate · 7d"
          value={gwPct(errRate)}
          sub={`${t.errors7d.toLocaleString()} failed`}
          tone={errRate > 5 ? "bad" : undefined}
        />
        <Stat
          label="Avg cost / call"
          value={t.calls7d > 0 ? usd(avgCost) : "—"}
          sub="across all apps"
        />
      </div>

      {failing.length > 0 && (
        <SectionCard title="Provider not answering" tone="red">
          <p style={{ color: C.dim, fontSize: 13, margin: 0, lineHeight: 1.7 }}>
            {failing.map((m) => m.model).join(", ")} —{" "}
            {failing.length === 1 ? "was" : "were"} attempted but never
            succeeded in the last 24h. Calls are falling through to the next
            model in the chain, so nothing is broken for users, but the intended
            cost profile is not being met.
          </p>
        </SectionCard>
      )}

      <SectionCard
        title="Spend vs all-Sonnet baseline"
        note="last 7 days · the gap is the saving"
      >
        <SpendTrend daily={stats.daily} />
      </SectionCard>

      <SectionCard title="Budget by app" note="today · UTC">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...head, textAlign: "left" }}>App</th>
                <th style={{ ...head, textAlign: "left" }}>Used</th>
                <th style={{ ...head, textAlign: "right" }}>%</th>
                <th style={{ ...head, textAlign: "right" }}>Spend / cap</th>
                <th style={{ ...head, textAlign: "right" }}>Calls</th>
              </tr>
            </thead>
            <tbody>
              {stats.budgets.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ ...cell, color: C.dim }}>
                    No apps configured.
                  </td>
                </tr>
              )}
              {stats.budgets.map((b) => {
                const tone = budgetTone(Number(b.pct_used));
                return (
                  <tr key={b.app_id}>
                    <td style={{ ...cell, fontWeight: 600 }}>{b.app_id}</td>
                    <td style={{ ...cell, width: "34%", minWidth: 120 }}>
                      <div
                        style={{
                          height: 8,
                          borderRadius: 4,
                          background: C.line,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(0, Number(b.pct_used)))}%`,
                            height: "100%",
                            borderRadius: 4,
                            background: tone.color,
                          }}
                        />
                      </div>
                    </td>
                    <td style={{ ...numCell, color: tone.color, fontWeight: 700 }}>
                      {gwPct(Number(b.pct_used))}
                    </td>
                    <td style={{ ...numCell, color: C.dim }}>
                      {usd(Number(b.spent_today))} / {usd(Number(b.daily_cap))}
                    </td>
                    <td style={numCell}>{b.calls_today}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Provider health" note="last 24h · successful calls">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...head, textAlign: "left" }}>Provider</th>
                <th style={{ ...head, textAlign: "right" }}>Calls</th>
                <th style={{ ...head, textAlign: "right" }}>Avg latency</th>
                <th style={{ ...head, textAlign: "right" }}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {stats.providers.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ ...cell, color: C.dim }}>
                    No successful calls in the last 24h.
                  </td>
                </tr>
              )}
              {stats.providers.map((p) => (
                <tr key={p.provider}>
                  <td style={{ ...cell, fontWeight: 600 }}>{p.provider}</td>
                  <td style={numCell}>{p.calls}</td>
                  <td style={numCell}>
                    {p.avg_ms === null ? "—" : `${p.avg_ms} ms`}
                  </td>
                  <td style={numCell}>{usd(Number(p.total_cost))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
