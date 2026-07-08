/**
 * CEO Dashboard — venture data feed ingestion.
 *
 * Server-to-server pipe: external venture systems (AHMAD AI CEO first,
 * EzPOS later) push daily numbers here instead of humans typing them.
 * The route handler verifies an HMAC signature over the raw body with
 * CEO_FEED_SECRET before calling ingestFeed. Service-role writes with
 * explicit entity checks; every push lands in ceo_audit_log.
 *
 * Daily P&L pushes also maintain the month-to-date monthly row so the
 * group overview (which reads monthly granularity) stays live:
 *   opening_stock = earliest day's opening, closing_stock = latest day's
 *   closing, everything else sums.
 */

import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { periodStartFor, parseDateString } from "./periods";

const money = z.coerce.number().min(0).max(999_999_999_999);

const feedSchema = z.object({
  entity_id: z.string().uuid(),
  source: z.string().min(1).max(60),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  pnl: z
    .object({
      sales: money.optional(),
      opening_stock: money.optional(),
      purchases: money.optional(),
      closing_stock: money.optional(),
      opex_rental: money.optional(),
      opex_salaries: money.optional(),
      opex_utilities: money.optional(),
      opex_marketing: money.optional(),
      opex_admin: money.optional(),
      opex_other: money.optional(),
      interest: money.optional(),
      depreciation: money.optional(),
      tax: money.optional(),
    })
    .optional(),
  ops_metrics: z
    .array(
      z.object({
        metric_code: z.string().min(1).max(80),
        value: z.coerce.number(),
        location: z.string().max(120).nullish(),
      }),
    )
    .max(200)
    .optional(),
});

export type FeedPayload = z.infer<typeof feedSchema>;

export async function verifyFeedSignature(
  rawBody: string,
  signatureHex: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHex) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const expected = [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // constant-time compare
  if (expected.length !== signatureHex.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signatureHex.charCodeAt(i);
  }
  return diff === 0;
}

export type FeedResult = {
  entity: string;
  date: string;
  pnl_daily_updated: boolean;
  pnl_monthly_rolled_up: boolean;
  ops_metrics_written: number;
};

export async function ingestFeed(input: unknown): Promise<FeedResult> {
  const data = feedSchema.parse(input);
  const admin = createSupabaseAdminClient();

  const { data: entity } = await admin
    .from("ceo_entities")
    .select("id, name, is_active")
    .eq("id", data.entity_id)
    .single();
  if (!entity || !entity.is_active) {
    throw new Error("Unknown or inactive venture for this feed");
  }

  let pnlDailyUpdated = false;
  let monthlyRolledUp = false;

  if (data.pnl && Object.keys(data.pnl).length > 0) {
    // Partial merge: only overwrite fields the feed actually sent
    const { data: existing } = await admin
      .from("ceo_pnl_entries")
      .select("*")
      .eq("entity_id", data.entity_id)
      .eq("period_start", data.date)
      .eq("granularity", "daily")
      .maybeSingle();

    const base = existing
      ? Object.fromEntries(
          Object.entries(existing).filter(([k]) =>
            [
              "sales",
              "opening_stock",
              "purchases",
              "closing_stock",
              "opex_rental",
              "opex_salaries",
              "opex_utilities",
              "opex_marketing",
              "opex_admin",
              "opex_other",
              "interest",
              "depreciation",
              "tax",
            ].includes(k),
          ),
        )
      : {};

    const { error } = await admin.from("ceo_pnl_entries").upsert(
      {
        ...base,
        ...data.pnl,
        entity_id: data.entity_id,
        period_start: data.date,
        granularity: "daily",
        notes: `feed:${data.source}`,
      },
      { onConflict: "entity_id,period_start,granularity" },
    );
    if (error) throw new Error(`Daily P&L upsert failed: ${error.message}`);
    pnlDailyUpdated = true;

    // Month-to-date rollup into the monthly row
    const monthStart = periodStartFor(parseDateString(data.date), "monthly");
    const { data: dailies } = await admin
      .from("ceo_pnl_entries")
      .select("*")
      .eq("entity_id", data.entity_id)
      .eq("granularity", "daily")
      .gte("period_start", monthStart)
      .lte("period_start", data.date.slice(0, 8) + "31")
      .order("period_start");

    if (dailies && dailies.length > 0) {
      const sum = (k: string) =>
        dailies.reduce(
          (s, r) => s + Number((r as Record<string, unknown>)[k] ?? 0),
          0,
        );
      const first = dailies[0] as Record<string, unknown>;
      const last = dailies[dailies.length - 1] as Record<string, unknown>;
      const { error: mErr } = await admin.from("ceo_pnl_entries").upsert(
        {
          entity_id: data.entity_id,
          period_start: monthStart,
          granularity: "monthly",
          sales: sum("sales"),
          opening_stock: Number(first.opening_stock ?? 0),
          purchases: sum("purchases"),
          closing_stock: Number(last.closing_stock ?? 0),
          opex_rental: sum("opex_rental"),
          opex_salaries: sum("opex_salaries"),
          opex_utilities: sum("opex_utilities"),
          opex_marketing: sum("opex_marketing"),
          opex_admin: sum("opex_admin"),
          opex_other: sum("opex_other"),
          interest: sum("interest"),
          depreciation: sum("depreciation"),
          tax: sum("tax"),
          notes: `feed:${data.source} rollup of ${dailies.length} day(s)`,
        },
        { onConflict: "entity_id,period_start,granularity" },
      );
      if (mErr) throw new Error(`Monthly rollup failed: ${mErr.message}`);
      monthlyRolledUp = true;
    }
  }

  let opsWritten = 0;
  if (data.ops_metrics && data.ops_metrics.length > 0) {
    const monthStart = periodStartFor(parseDateString(data.date), "monthly");
    for (const m of data.ops_metrics) {
      // daily point + latest-wins monthly bucket (what the KPI board reads)
      for (const period of [data.date, monthStart]) {
        const { error } = await admin.from("ceo_ops_metrics").upsert(
          {
            entity_id: data.entity_id,
            metric_code: m.metric_code,
            location: m.location ?? null,
            period_start: period,
            value: m.value,
          },
          { onConflict: "entity_id,metric_code,location,period_start" },
        );
        if (error) {
          throw new Error(
            `Ops metric ${m.metric_code} failed: ${error.message} (is the metric code in ceo_metric_definitions?)`,
          );
        }
      }
      opsWritten++;
    }
  }

  await admin.from("ceo_audit_log").insert({
    user_id: null,
    entity_id: data.entity_id,
    table_name: "ceo_feed",
    record_id: null,
    action: "import",
    diff: {
      source: data.source,
      date: data.date,
      pnl_fields: Object.keys(data.pnl ?? {}),
      ops_metrics: data.ops_metrics?.length ?? 0,
    },
  });

  return {
    entity: entity.name,
    date: data.date,
    pnl_daily_updated: pnlDailyUpdated,
    pnl_monthly_rolled_up: monthlyRolledUp,
    ops_metrics_written: opsWritten,
  };
}
