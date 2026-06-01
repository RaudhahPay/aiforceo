// Token / credit accounting helpers.
// All ledger writes go through the service-role admin client so they cannot
// be tampered with from the browser.
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const TIER_MONTHLY_TOKENS: Readonly<Record<string, number>> = {
  trial: 100_000,
  starter: 500_000,
  growth: 2_000_000,
  scale: 8_000_000,
};

/** Maximum token balance a tier can accumulate (carry-over cap). */
export const TIER_MAX_BALANCE: Readonly<Record<string, number>> = {
  trial: 100_000,       // no carry over
  starter: 1_000_000,
  growth: 5_000_000,
  scale: 20_000_000,
};

/** Pure: compute how many tokens remain. Exposed for testing. */
export function remainingFromLedger(
  rows: Array<{ delta_tokens: number }>,
): number {
  return rows.reduce((sum, r) => sum + r.delta_tokens, 0);
}

/**
 * Returns the workspace's remaining tokens for the current calendar month.
 * Auto-grants the monthly quota if no reset has been issued this month yet —
 * so every workspace (including trial) self-resets on the 1st without a cron.
 */
export async function getRemainingTokens(workspaceId: string): Promise<number> {
  const supa = createSupabaseAdminClient();

  // Check if this month's quota has been granted
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: thisMonthGrant } = await supa
    .from("credit_ledger")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("reason", "monthly_reset")
    .gte("created_at", startOfMonth.toISOString())
    .limit(1)
    .maybeSingle();

  if (!thisMonthGrant) {
    // Auto-grant this month's quota based on workspace tier, respecting carry-over cap
    const { data: ws } = await supa
      .from("workspaces")
      .select("tier")
      .eq("id", workspaceId)
      .maybeSingle();

    const tier = ws?.tier ?? "trial";
    const monthlyGrant = TIER_MONTHLY_TOKENS[tier] ?? 100_000;
    const maxBalance = TIER_MAX_BALANCE[tier] ?? 100_000;

    // Check current balance BEFORE granting, so we don't exceed the cap
    const { data: currentLedger } = await supa
      .from("credit_ledger")
      .select("delta_tokens")
      .eq("workspace_id", workspaceId);
    const currentBalance = (currentLedger ?? []).reduce((s, r) => s + r.delta_tokens, 0);

    // Only grant enough to reach the cap (or the full grant if under cap)
    const grantAmount = Math.max(0, Math.min(monthlyGrant, maxBalance - currentBalance));

    if (grantAmount > 0) {
      // Insert — ignore duplicate if two requests race at month boundary
      try {
        await supa
          .from("credit_ledger")
          .insert({
            workspace_id: workspaceId,
            delta_tokens: grantAmount,
            reason: "monthly_reset",
          })
          .throwOnError();
      } catch {
        /* concurrent insert — safe to ignore */
      }
    }
  }

  const { data, error } = await supa.rpc("tokens_remaining", {
    p_workspace_id: workspaceId,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

/** Records consumption against the ledger as a negative delta. */
export async function recordUsage(opts: {
  workspaceId: string;
  inputTokens: number;
  outputTokens: number;
  messageId?: string;
}): Promise<void> {
  const total = opts.inputTokens + opts.outputTokens;
  if (total <= 0) return;
  const supa = createSupabaseAdminClient();
  const { error } = await supa.from("credit_ledger").insert({
    workspace_id: opts.workspaceId,
    delta_tokens: -total,
    reason: "chat",
    message_id: opts.messageId ?? null,
  });
  if (error) throw error;
}

/** Grant the monthly quota for the given tier (called on Stripe renewal).
 *  Pass stripeInvoiceId to make the grant idempotent: duplicate Stripe event
 *  deliveries with the same invoice ID are silently skipped. */
export async function grantMonthlyQuota(
  workspaceId: string,
  tier: string,
  stripeInvoiceId?: string,
): Promise<void> {
  const monthlyGrant = TIER_MONTHLY_TOKENS[tier] ?? 0;
  if (monthlyGrant <= 0) return;
  const supa = createSupabaseAdminClient();

  // Idempotency: skip if this invoice has already been credited.
  if (stripeInvoiceId) {
    const { data: existing } = await supa
      .from("credit_ledger")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("stripe_invoice_id", stripeInvoiceId)
      .maybeSingle();
    if (existing) return;
  }

  // Respect carry-over cap — only grant enough to reach the tier max
  const maxBalance = TIER_MAX_BALANCE[tier] ?? 100_000;
  const { data: currentLedger } = await supa
    .from("credit_ledger")
    .select("delta_tokens")
    .eq("workspace_id", workspaceId);
  const currentBalance = (currentLedger ?? []).reduce((s, r) => s + r.delta_tokens, 0);
  const grantAmount = Math.max(0, Math.min(monthlyGrant, maxBalance - currentBalance));

  if (grantAmount <= 0) return; // Already at or above cap

  const { error } = await supa.from("credit_ledger").insert({
    workspace_id: workspaceId,
    delta_tokens: grantAmount,
    reason: "monthly_reset",
    stripe_invoice_id: stripeInvoiceId ?? null,
  });
  if (error) throw error;
}

/** Record a one-time top-up purchase. */
export async function grantTopup(
  workspaceId: string,
  tokens: number,
  stripeInvoiceId?: string,
): Promise<void> {
  if (tokens <= 0) return;
  const supa = createSupabaseAdminClient();
  const { error } = await supa.from("credit_ledger").insert({
    workspace_id: workspaceId,
    delta_tokens: tokens,
    reason: "topup",
    stripe_invoice_id: stripeInvoiceId ?? null,
  });
  if (error) throw error;
}
