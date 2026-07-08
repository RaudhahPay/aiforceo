/**
 * CF ai — the Daily Group Brief.
 *
 * Loads every active venture's dashboard state, refreshes its KPI
 * snapshots, runs the KIRA/JUAL/URUS cabinet, and composes the group
 * view Coach reads first thing: group pulse, cash position, every red
 * with its owner status, top priorities in impact order.
 *
 * Deterministic first: the brief is complete and correct with no API
 * key. When ANTHROPIC_API_KEY is set, narrateBrief() adds a short
 * CEO-voice narrative on top — it never adds facts, only prose.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAnthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { evaluateEntityKpis } from "@/lib/ceo-dashboard/evaluator";
import { periodStartFor, toDateString } from "@/lib/ceo-dashboard/periods";
import type { TrafficStatus } from "@/lib/ceo-dashboard/formulas";
import {
  kiraFindings,
  jualFindings,
  urusFindings,
  sortFindings,
  type Finding,
} from "./analysts";

export type VentureBrief = {
  entityId: string;
  name: string;
  industryType: string;
  sortWeight: number;
  health: { score: number; badge: TrafficStatus; redCount: number };
  findings: Finding[];
  cashBankRm: number | null;
};

export type GroupBrief = {
  generatedAt: string;
  orgId: string;
  ventures: VentureBrief[];
  groupPulse: { score: number; badge: TrafficStatus };
  cashPositionRm: number;
  topPriorities: string[];
  narrative: string | null;
};

async function loadVentureBrief(
  entity: {
    id: string;
    name: string;
    industry_type: string;
    sort_weight: number;
  },
  now: Date,
): Promise<VentureBrief> {
  const admin = createSupabaseAdminClient();
  const monthStart = periodStartFor(now, "monthly");

  const { health } = await evaluateEntityKpis(entity.id, monthStart, "monthly");

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    { data: pnl },
    { data: bs },
    { data: cashRows },
    { data: arAging },
    { data: debtService },
    { data: funnel },
    { count: activeStrategies },
    { data: channels },
    { data: staff },
    { data: customer },
    { data: redActions },
  ] = await Promise.all([
    admin
      .from("ceo_pnl_entries")
      .select("sales, gross_profit, ebitda, interest")
      .eq("entity_id", entity.id)
      .eq("granularity", "monthly")
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("ceo_balance_sheet_entries")
      .select("cash_bank, is_balanced, override_unbalanced")
      .eq("entity_id", entity.id)
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("ceo_cashflow_entries")
      .select("direction, amount")
      .eq("entity_id", entity.id)
      .gte("txn_date", toDateString(thirtyDaysAgo)),
    admin
      .from("ceo_ar_aging")
      .select("d90_plus, total_outstanding")
      .eq("entity_id", entity.id)
      .maybeSingle(),
    admin
      .from("ceo_group_debt_service")
      .select("total_monthly_commitment")
      .eq("entity_id", entity.id)
      .maybeSingle(),
    admin
      .from("ceo_funnel_entries")
      .select("total_reach, cr1, cr2, sales")
      .eq("entity_id", entity.id)
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("ceo_marketing_strategies")
      .select("id", { count: "exact", head: true })
      .eq("entity_id", entity.id)
      .eq("status", "active"),
    admin
      .from("ceo_channel_metrics")
      .select("channel, cost, leads")
      .eq("entity_id", entity.id)
      .eq("period_start", monthStart)
      .eq("granularity", "monthly"),
    admin
      .from("ceo_staff_happiness")
      .select("enps")
      .eq("entity_id", entity.id)
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("ceo_customer_happiness")
      .select("nps, unresolved_48h_count")
      .eq("entity_id", entity.id)
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("ceo_red_actions")
      .select("status")
      .eq("entity_id", entity.id)
      .in("status", ["open", "escalated"]),
  ]);

  const cashNet30d =
    cashRows && cashRows.length > 0
      ? cashRows.reduce(
          (s, r) =>
            s + (r.direction === "in" ? Number(r.amount) : -Number(r.amount)),
          0,
        )
      : null;

  const findings = sortFindings([
    ...kiraFindings({
      pnl: pnl
        ? {
            sales: Number(pnl.sales),
            gross_profit: Number(pnl.gross_profit),
            ebitda: Number(pnl.ebitda),
            interest: Number(pnl.interest),
          }
        : null,
      bs: bs
        ? {
            cash_bank: Number(bs.cash_bank),
            is_balanced: Boolean(bs.is_balanced),
            override_unbalanced: Boolean(bs.override_unbalanced),
          }
        : null,
      cashNet30d,
      arAging: arAging
        ? {
            d90_plus: Number(arAging.d90_plus),
            total_outstanding: Number(arAging.total_outstanding),
          }
        : null,
      debtMonthly: Number(debtService?.total_monthly_commitment ?? 0),
    }),
    ...jualFindings({
      funnel: funnel
        ? {
            total_reach: Number(funnel.total_reach),
            cr1: Number(funnel.cr1),
            cr2: Number(funnel.cr2),
            sales: Number(funnel.sales),
          }
        : null,
      activeStrategies: activeStrategies ?? 0,
      channelsBurning: (channels ?? [])
        .filter((c) => Number(c.cost) > 0 && Number(c.leads) === 0)
        .map((c) => String(c.channel)),
    }),
    ...urusFindings({
      enps: staff?.enps ?? null,
      nps: customer?.nps ?? null,
      unresolved48h: Number(customer?.unresolved_48h_count ?? 0),
      openRedActions: (redActions ?? []).filter((r) => r.status === "open")
        .length,
      escalatedRedActions: (redActions ?? []).filter(
        (r) => r.status === "escalated",
      ).length,
    }),
  ]);

  return {
    entityId: entity.id,
    name: entity.name,
    industryType: entity.industry_type,
    sortWeight: Number(entity.sort_weight),
    health,
    findings,
    cashBankRm: bs ? Number(bs.cash_bank) : null,
  };
}

/** Compose the full group brief for an org. Deterministic — no LLM. */
export async function composeGroupBrief(orgId: string): Promise<GroupBrief> {
  const admin = createSupabaseAdminClient();
  const now = new Date();

  const { data: entities, error } = await admin
    .from("ceo_entities")
    .select("id, name, industry_type, sort_weight")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("sort_weight", { ascending: false });
  if (error) throw new Error(`Brief load failed: ${error.message}`);

  const ventures: VentureBrief[] = [];
  for (const e of entities ?? []) {
    ventures.push(await loadVentureBrief(e, now));
  }

  // Group pulse: venture health weighted by revenue share (sort_weight),
  // equal weights when none are set. Badge = worst of (weighted band, any
  // venture with a red critical already reflected in its own badge).
  const totalWeight = ventures.reduce(
    (s, v) => s + (v.sortWeight > 0 ? v.sortWeight : 1),
    0,
  );
  const score =
    ventures.length > 0
      ? ventures.reduce(
          (s, v) => s + v.health.score * (v.sortWeight > 0 ? v.sortWeight : 1),
          0,
        ) / totalWeight
      : 0;
  const anyRedBadge = ventures.some((v) => v.health.badge === "red");
  const badge: TrafficStatus = anyRedBadge
    ? "red"
    : score >= 100
      ? "green"
      : score >= 70
        ? "yellow"
        : ventures.length === 0
          ? "yellow"
          : "red";

  const reds = ventures.flatMap((v) =>
    v.findings
      .filter((f) => f.severity === "red")
      .map((f) => `${v.name}: ${f.message}`),
  );

  return {
    generatedAt: now.toISOString(),
    orgId,
    ventures,
    groupPulse: { score: Math.round(score * 10) / 10, badge },
    cashPositionRm: ventures.reduce((s, v) => s + (v.cashBankRm ?? 0), 0),
    topPriorities: reds.slice(0, 3),
    narrative: null,
  };
}

/** Deterministic fallback narrative — used when no API key is set. */
export function fallbackNarrative(brief: GroupBrief): string {
  const lines: string[] = [];
  lines.push(
    `Group pulse ${brief.groupPulse.badge.toUpperCase()} at ${brief.groupPulse.score}% weighted attainment across ${brief.ventures.length} venture(s). Cash position RM${brief.cashPositionRm.toLocaleString()}.`,
  );
  if (brief.topPriorities.length > 0) {
    lines.push(`Top priorities: ${brief.topPriorities.join(" | ")}`);
  } else {
    lines.push(
      "No red findings today. Hold the line and keep reporting current.",
    );
  }
  return lines.join("\n");
}

/**
 * Add a short CEO-voice narrative. Facts come only from the brief object;
 * on any API failure the deterministic fallback is used instead.
 */
export async function narrateBrief(brief: GroupBrief): Promise<GroupBrief> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ...brief, narrative: fallbackNarrative(brief) };
  }
  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `You are CF ai, the AI group CEO. Write a 3-5 sentence morning brief for the founder in plain, direct language. Cash-first, red-first. Do not invent numbers — use only this data:\n\n${JSON.stringify(
            {
              groupPulse: brief.groupPulse,
              cashPositionRm: brief.cashPositionRm,
              topPriorities: brief.topPriorities,
              ventures: brief.ventures.map((v) => ({
                name: v.name,
                badge: v.health.badge,
                redFindings: v.findings
                  .filter((f) => f.severity === "red")
                  .map((f) => f.message),
              })),
            },
            null,
            2,
          )}`,
        },
      ],
    });
    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();
    return { ...brief, narrative: text || fallbackNarrative(brief) };
  } catch {
    return { ...brief, narrative: fallbackNarrative(brief) };
  }
}
