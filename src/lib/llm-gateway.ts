/**
 * LLM Gateway (AiOS Cost Router) — read-only client.
 *
 * The gateway is the single choke point every portfolio app calls instead of
 * talking to DeepSeek / Gemini / Anthropic directly. It routes each task tag to
 * the cheapest capable model, enforces per-app daily budgets, and logs the cost
 * of every call. This module pulls its /stats aggregates so the CEO dashboard
 * can show group-wide AI spend alongside the other numbers.
 *
 * SERVER ONLY — LLM_GATEWAY_KEY must never reach the browser. Import this from
 * server components / route handlers only.
 *
 * Config (both required, else the panel renders an "unconfigured" state):
 *   LLM_GATEWAY_URL  e.g. https://llm-gateway.<subdomain>.workers.dev
 *   LLM_GATEWAY_KEY  the aiforceo app key issued by the gateway
 */

export type GatewayBudget = {
  app_id: string;
  daily_cap: number;
  spent_today: number;
  remaining: number;
  pct_used: number;
  calls_today: number;
  errors_today: number;
  is_active: boolean;
};

export type GatewayModelAttempt = {
  model: string;
  attempts: number;
  succeeded: number;
  success_pct: number | null;
};

export type GatewayProvider = {
  provider: string;
  calls: number;
  avg_ms: number | null;
  total_cost: number;
  last_seen: string;
};

export type GatewayDaily = {
  day: string;
  calls: number;
  errors: number;
  total_cost: number;
  baseline_sonnet_cost: number;
};

export type GatewayStats = {
  budgets: GatewayBudget[];
  modelAttempts: GatewayModelAttempt[];
  providers: GatewayProvider[];
  daily: GatewayDaily[];
  totals: {
    calls7d: number;
    errors7d: number;
    cost7d: number;
    baseline7d: number;
    savedPct: number;
  };
};

/**
 * Fetch gateway aggregates. Returns null when the gateway is not configured or
 * unreachable — AI spend is supplementary, so it must never break the dashboard.
 */
export async function fetchGatewayStats(): Promise<GatewayStats | null> {
  const base = process.env.LLM_GATEWAY_URL;
  const key = process.env.LLM_GATEWAY_KEY;
  if (!base || !key) return null;

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/llm/stats`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as GatewayStats;
  } catch {
    return null;
  }
}

/* ─── FORMAT HELPERS ─────────────────────────────────────────── */
/**
 * Gateway costs are USD (provider billing), deliberately NOT rm()/fmtMoney —
 * the rest of this dashboard is RM and conflating the two would misreport spend.
 * Individual calls cost fractions of a cent, so precision scales with magnitude.
 */
export const usd = (n: number): string => {
  const v = Number(n) || 0;
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v >= 0.01) return `$${v.toFixed(4)}`;
  if (v === 0) return "$0";
  return `$${v.toFixed(6)}`;
};

export const gwPct = (n: number): string => `${(Number(n) || 0).toFixed(1)}%`;
