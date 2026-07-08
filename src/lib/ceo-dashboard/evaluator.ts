/**
 * CEO Dashboard — KPI evaluator.
 *
 * Reads each active KPI definition for an entity, resolves the actual value
 * from its source (P&L, balance sheet, cashflow, funnel, channels, staff,
 * customer, ops metric, strategy count), scores it with the formula engine,
 * and upserts ceo_kpi_snapshots. Server-side only (admin client) — callers
 * must have already verified entity access.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { trafficLight, ventureHealth, MIN_ACTIVE_STRATEGIES } from "./formulas";
import type { KpiForHealth, TrafficStatus } from "./formulas";
import { periodRange, type Granularity } from "./periods";
import type { KpiDefinitionRow, KpiSnapshotRow } from "./types";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

async function resolveActual(
  admin: Admin,
  def: KpiDefinitionRow,
  entityId: string,
  periodStart: string,
  granularity: Granularity,
): Promise<number | null> {
  const ref = def.source_ref ?? "";

  switch (def.source_kind) {
    case "pnl": {
      const { data } = await admin
        .from("ceo_pnl_entries")
        .select("*")
        .eq("entity_id", entityId)
        .eq("period_start", periodStart)
        .eq("granularity", granularity)
        .maybeSingle();
      if (!data) return null;
      if (ref === "gp_pct") {
        return data.sales > 0 ? (data.gross_profit / data.sales) * 100 : null;
      }
      if (ref === "food_cost_pct" || ref === "cogs_pct") {
        return data.sales > 0 ? (data.cogs / data.sales) * 100 : null;
      }
      const v = (data as Record<string, unknown>)[ref];
      return typeof v === "number" ? v : v != null ? Number(v) : null;
    }

    case "bs": {
      const { data } = await admin
        .from("ceo_balance_sheet_entries")
        .select("*")
        .eq("entity_id", entityId)
        .eq("period_start", periodStart)
        .eq("granularity", granularity)
        .maybeSingle();
      if (!data) return null;
      const v = (data as Record<string, unknown>)[ref];
      return typeof v === "number" ? v : v != null ? Number(v) : null;
    }

    case "cashflow": {
      const { start, end } = periodRange(periodStart, granularity);
      const { data } = await admin
        .from("ceo_cashflow_entries")
        .select("direction, amount")
        .eq("entity_id", entityId)
        .gte("txn_date", start)
        .lt("txn_date", end);
      if (!data || data.length === 0) return null;
      const net = data.reduce(
        (s, r) =>
          s + (r.direction === "in" ? Number(r.amount) : -Number(r.amount)),
        0,
      );
      return net;
    }

    case "funnel": {
      const { data } = await admin
        .from("ceo_funnel_entries")
        .select("*")
        .eq("entity_id", entityId)
        .eq("period_start", periodStart)
        .eq("granularity", granularity)
        .maybeSingle();
      if (!data) return null;
      const v = (data as Record<string, unknown>)[ref];
      return typeof v === "number" ? v : v != null ? Number(v) : null;
    }

    case "channel": {
      // Sum the referenced column across all channels for the period
      const { data } = await admin
        .from("ceo_channel_metrics")
        .select("*")
        .eq("entity_id", entityId)
        .eq("period_start", periodStart)
        .eq("granularity", granularity);
      if (!data || data.length === 0) return null;
      return data.reduce((s, r) => {
        const v = (r as Record<string, unknown>)[ref];
        return s + (v != null ? Number(v) : 0);
      }, 0);
    }

    case "staff": {
      const { data } = await admin
        .from("ceo_staff_happiness")
        .select("*")
        .eq("entity_id", entityId)
        .eq("period_start", periodStart)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return null;
      const v = (data as Record<string, unknown>)[ref];
      return v != null ? Number(v) : null;
    }

    case "customer": {
      const { data } = await admin
        .from("ceo_customer_happiness")
        .select("*")
        .eq("entity_id", entityId)
        .eq("period_start", periodStart)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return null;
      const v = (data as Record<string, unknown>)[ref];
      return v != null ? Number(v) : null;
    }

    case "ops_metric": {
      const { data } = await admin
        .from("ceo_ops_metrics")
        .select("value")
        .eq("entity_id", entityId)
        .eq("metric_code", ref)
        .eq("period_start", periodStart)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ? Number(data.value) : null;
    }

    case "strategy_count": {
      const { count } = await admin
        .from("ceo_marketing_strategies")
        .select("id", { count: "exact", head: true })
        .eq("entity_id", entityId)
        .eq("status", "active");
      return count ?? 0;
    }
  }
}

export type EvaluationResult = {
  snapshots: (KpiSnapshotRow & {
    name: string;
    is_critical: boolean;
    weight: number;
  })[];
  health: { score: number; badge: TrafficStatus; redCount: number };
};

/**
 * Evaluate all active KPIs for one entity/period/granularity and persist
 * the snapshots. KPIs whose source has no data for the period are skipped
 * (no snapshot — absence of data is surfaced by the reporting-compliance
 * sweep, not fake reds).
 */
export async function evaluateEntityKpis(
  entityId: string,
  periodStart: string,
  granularity: Granularity,
): Promise<EvaluationResult> {
  const admin = createSupabaseAdminClient();

  const { data: entity } = await admin
    .from("ceo_entities")
    .select("industry_type")
    .eq("id", entityId)
    .single();

  // Entity-specific definitions plus industry defaults not overridden by name
  const { data: defs } = await admin
    .from("ceo_kpi_definitions")
    .select("*")
    .eq("is_active", true)
    .or(
      `entity_id.eq.${entityId},and(entity_id.is.null,industry_type.eq.${entity?.industry_type ?? "other"})`,
    );

  const entityDefs = (defs ?? []).filter((d) => d.entity_id === entityId);
  const entityNames = new Set(entityDefs.map((d) => d.name));
  const effective = [
    ...entityDefs,
    ...(defs ?? []).filter(
      (d) => d.entity_id === null && !entityNames.has(d.name),
    ),
  ] as KpiDefinitionRow[];

  const results: EvaluationResult["snapshots"] = [];

  for (const def of effective) {
    const actual = await resolveActual(
      admin,
      def,
      entityId,
      periodStart,
      granularity,
    );
    if (actual === null) continue;

    // strategy_count scores against the hard minimum of 10 unless overridden
    const target =
      def.source_kind === "strategy_count"
        ? (def.target ?? MIN_ACTIVE_STRATEGIES)
        : def.target;
    if (target === null || target === undefined) continue;

    const { attainmentPct, status } = trafficLight(
      actual,
      target,
      def.direction,
      def.green_threshold_pct,
      def.yellow_threshold_pct,
    );

    const { data: snap, error } = await admin
      .from("ceo_kpi_snapshots")
      .upsert(
        {
          kpi_id: def.id,
          entity_id: entityId,
          period_start: periodStart,
          granularity,
          actual,
          attainment_pct: attainmentPct,
          status,
          computed_at: new Date().toISOString(),
        },
        { onConflict: "kpi_id,period_start,granularity" },
      )
      .select()
      .single();
    if (error)
      throw new Error(
        `KPI snapshot upsert failed for ${def.name}: ${error.message}`,
      );

    results.push({
      ...(snap as KpiSnapshotRow),
      name: def.name,
      is_critical: def.is_critical,
      weight: def.weight,
    });
  }

  const forHealth: KpiForHealth[] = results.map((r) => ({
    attainmentPct: r.attainment_pct ?? 0,
    weight: r.weight,
    status: r.status,
    isCritical: r.is_critical,
  }));

  return { snapshots: results, health: ventureHealth(forHealth) };
}

/**
 * Escalation sweep: red actions still open past 48 hours are marked
 * escalated (surfaced on the Group CEO view). Returns escalated count.
 */
export async function sweepEscalations(orgId?: string): Promise<number> {
  const admin = createSupabaseAdminClient();
  const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

  const query = admin
    .from("ceo_red_actions")
    .update({ status: "escalated", escalated_at: new Date().toISOString() })
    .eq("status", "open")
    .lt("created_at", cutoff)
    .select("id, entity_id");

  const { data, error } = await query;
  if (error) throw new Error(`Escalation sweep failed: ${error.message}`);

  if (orgId && data && data.length > 0) {
    // orgId filter applied post-hoc only for the return count; the sweep
    // itself is global (cron runs it for all orgs)
    const { data: ents } = await admin
      .from("ceo_entities")
      .select("id")
      .eq("org_id", orgId);
    const ids = new Set((ents ?? []).map((e) => e.id));
    return data.filter((r) => ids.has(r.entity_id)).length;
  }
  return data?.length ?? 0;
}
