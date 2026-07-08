// Cron route for the CEO Dashboard KPI evaluator.
// Called hourly by the Cloudflare cron Worker (wrangler-cron.jsonc).
// Protected by CRON_SECRET — never exposed to users.
//
// POST /api/cron/ceo-evaluate — evaluate KPIs for every active entity
//   across the current day/week/month/quarter/year, then run the 48h
//   red-action escalation sweep. KPIs whose source has no data for a
//   period are skipped by the evaluator, so this is cheap to run often.
// GET  /api/cron/ceo-evaluate — dry run: list the entities that would run.
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  evaluateEntityKpis,
  sweepEscalations,
} from "@/lib/ceo-dashboard/evaluator";
import { GRANULARITIES, periodStartFor } from "@/lib/ceo-dashboard/periods";

function authOk(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!authOk(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: entities, error } = await admin
    .from("ceo_entities")
    .select("id, org_id, name")
    .eq("is_active", true);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = new Date();
  const results = [];

  for (const entity of entities ?? []) {
    let snapshots = 0;
    let reds = 0;
    try {
      for (const g of GRANULARITIES) {
        const { snapshots: snaps, health } = await evaluateEntityKpis(
          entity.id,
          periodStartFor(now, g),
          g,
        );
        snapshots += snaps.length;
        reds += health.redCount;
      }
      results.push({ entityId: entity.id, name: entity.name, snapshots, reds });
    } catch (e) {
      results.push({
        entityId: entity.id,
        name: entity.name,
        error: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  let escalated = 0;
  try {
    escalated = await sweepEscalations();
  } catch (e) {
    return NextResponse.json(
      {
        processed: results.length,
        results,
        escalationError: e instanceof Error ? e.message : "unknown",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ processed: results.length, escalated, results });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!authOk(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: entities } = await admin
    .from("ceo_entities")
    .select("id, org_id, name, industry_type")
    .eq("is_active", true);

  return NextResponse.json({ eligible: entities ?? [] });
}
