"use server";

/**
 * CEO Business Dashboard — server actions.
 *
 * Every write: requireUser() → assertEntityRole() (re-derived server-side)
 * → admin client write → ceo_audit_log for financial mutations →
 * revalidatePath. Role matrix per docs/ceo-dashboard/CLAUDE.md; the
 * workspace owner implicitly holds all roles.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser, AuthError } from "@/lib/auth/require";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspace } from "@/lib/workspace";
import {
  assertEntityRole,
  assertOrgAdmin,
  resolveGroupHq,
} from "@/lib/ceo-dashboard/access";
import {
  evaluateEntityKpis,
  sweepEscalations,
} from "@/lib/ceo-dashboard/evaluator";
import type { CeoRole } from "@/lib/ceo-dashboard/types";

const FINANCE: CeoRole[] = ["finance"];
const MARKETING: CeoRole[] = ["marketing"];
const OPS: CeoRole[] = ["ops"];
const EXEC: CeoRole[] = ["group_ceo", "venture_ceo"];
const KPI_ADMIN: CeoRole[] = ["group_ceo", "admin"];
const ANY_ROLE: CeoRole[] = [
  "group_ceo",
  "venture_ceo",
  "finance",
  "marketing",
  "ops",
  "admin",
];

type ActionResult = { ok: true } | { ok: false; error: string };

function fail(e: unknown): ActionResult {
  if (e instanceof AuthError) return { ok: false, error: e.message };
  if (e instanceof z.ZodError) {
    return {
      ok: false,
      error: e.errors
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    };
  }
  return {
    ok: false,
    error: e instanceof Error ? e.message : "Something went wrong",
  };
}

async function auditFinancial(
  userId: string,
  entityId: string,
  table: string,
  recordId: string | null,
  action: "insert" | "update" | "delete",
  diff: Record<string, unknown>,
) {
  const admin = createSupabaseAdminClient();
  await admin.from("ceo_audit_log").insert({
    user_id: userId,
    entity_id: entityId,
    table_name: table,
    record_id: recordId,
    action,
    diff,
  });
}

function revalidate(entityId?: string) {
  revalidatePath("/ceo");
  if (entityId) revalidatePath(`/ceo/${entityId}`);
}

const uuid = z.string().uuid();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const granularity = z.enum([
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
]);
const money = z.coerce.number().min(0).max(999_999_999_999);
const signedMoney = z.coerce
  .number()
  .min(-999_999_999_999)
  .max(999_999_999_999);
const ratio = z.coerce.number().min(0).max(1);

/* ═══════════════ Entities & roles ═══════════════ */

const entitySchema = z.object({
  name: z.string().trim().min(2).max(120),
  industry_type: z.enum([
    "fnb",
    "education",
    "healthcare",
    "tech_saas",
    "retail_ecommerce",
    "other",
  ]),
  currency: z.string().trim().length(3).default("MYR"),
  sort_weight: z.coerce.number().min(0).max(100).default(0),
});

export async function createEntity(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const ctx = await getCurrentWorkspace();
    if (!ctx) throw new AuthError("NOT_FOUND", "No workspace");
    const hq = await resolveGroupHq(user.id, {
      id: ctx.workspace.id,
      name: ctx.workspace.name,
    });
    await assertOrgAdmin(user.id, hq.id);
    const data = entitySchema.parse(input);
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("ceo_entities").insert({
      ...data,
      currency: data.currency.toUpperCase(),
      org_id: hq.id,
      created_by: user.id,
    });
    if (error) throw new Error(error.message);
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateEntity(
  entityId: unknown,
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = uuid.parse(entityId);
    const access = await assertEntityRole(user.id, id, ["admin"]);
    const data = entitySchema
      .partial()
      .extend({ is_active: z.boolean().optional() })
      .parse(input);
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("ceo_entities")
      .update(data)
      .eq("id", id)
      .eq("org_id", access.entity.org_id);
    if (error) throw new Error(error.message);
    revalidate(id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const roleSchema = z.object({
  email: z.string().email(),
  role: z.enum([
    "group_ceo",
    "venture_ceo",
    "finance",
    "marketing",
    "ops",
    "admin",
  ]),
  entity_id: uuid.nullable(),
});

export async function assignRole(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const ctx = await getCurrentWorkspace();
    if (!ctx) throw new AuthError("NOT_FOUND", "No workspace");
    const hq = await resolveGroupHq(user.id, {
      id: ctx.workspace.id,
      name: ctx.workspace.name,
    });
    await assertOrgAdmin(user.id, hq.id);
    const data = roleSchema.parse(input);

    const orgWide = data.role === "group_ceo" || data.role === "admin";
    if (orgWide !== (data.entity_id === null)) {
      throw new Error(
        orgWide
          ? `${data.role} is org-wide — no venture selection`
          : `${data.role} must be scoped to a venture`,
      );
    }

    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", data.email.trim())
      .maybeSingle();
    if (!profile)
      throw new Error(
        `No aiforceo user with email ${data.email} — they must sign up first`,
      );

    const { error } = await admin.from("ceo_entity_roles").upsert(
      {
        user_id: profile.id,
        org_id: hq.id,
        entity_id: data.entity_id,
        role: data.role,
        created_by: user.id,
      },
      { onConflict: "user_id,org_id,entity_id,role", ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function removeRole(roleId: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = uuid.parse(roleId);
    const admin = createSupabaseAdminClient();
    const { data: row } = await admin
      .from("ceo_entity_roles")
      .select("org_id")
      .eq("id", id)
      .single();
    if (!row) throw new AuthError("NOT_FOUND", "Role not found");
    await assertOrgAdmin(user.id, row.org_id);
    const { error } = await admin
      .from("ceo_entity_roles")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
    revalidate();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ═══════════════ Financial — P&L ═══════════════ */

const pnlSchema = z.object({
  entity_id: uuid,
  period_start: dateStr,
  granularity,
  sales: money.default(0),
  opening_stock: money.default(0),
  purchases: money.default(0),
  closing_stock: money.default(0),
  opex_rental: money.default(0),
  opex_salaries: money.default(0),
  opex_utilities: money.default(0),
  opex_marketing: money.default(0),
  opex_admin: money.default(0),
  opex_other: money.default(0),
  interest: money.default(0),
  depreciation: money.default(0),
  tax: money.default(0),
  notes: z.string().max(2000).nullish(),
});

export async function upsertPnl(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = pnlSchema.parse(input);
    await assertEntityRole(user.id, data.entity_id, FINANCE);
    const admin = createSupabaseAdminClient();
    const { data: row, error } = await admin
      .from("ceo_pnl_entries")
      .upsert(
        { ...data, created_by: user.id },
        { onConflict: "entity_id,period_start,granularity" },
      )
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await auditFinancial(
      user.id,
      data.entity_id,
      "ceo_pnl_entries",
      row?.id ?? null,
      "update",
      data,
    );
    revalidate(data.entity_id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ═══════════════ Financial — Balance sheet ═══════════════ */

const bsSchema = z.object({
  entity_id: uuid,
  period_start: dateStr,
  granularity: z.enum(["monthly", "quarterly", "yearly"]),
  fixed_assets: money.default(0),
  cash_bank: signedMoney.default(0),
  accounts_receivable: money.default(0),
  stock_value: money.default(0),
  deposits_prepayments: money.default(0),
  accounts_payable: money.default(0),
  bank_loans_current: money.default(0),
  bank_loans_longterm: money.default(0),
  other_debts_total: money.default(0),
  paid_up_capital: money.default(0),
  retained_earnings: signedMoney.default(0),
  current_year_pl: signedMoney.default(0),
  override_unbalanced: z.boolean().default(false),
  override_note: z.string().max(1000).nullish(),
});

export async function upsertBalanceSheet(
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = bsSchema.parse(input);
    await assertEntityRole(user.id, data.entity_id, FINANCE);
    if (data.override_unbalanced && !data.override_note?.trim()) {
      throw new Error("An unbalanced save needs a note explaining why");
    }
    const admin = createSupabaseAdminClient();
    const { data: row, error } = await admin
      .from("ceo_balance_sheet_entries")
      .upsert(
        { ...data, created_by: user.id },
        { onConflict: "entity_id,period_start,granularity" },
      )
      .select("id")
      .single();
    if (error) {
      if (error.message.includes("does not balance")) {
        throw new Error(
          "Assets ≠ Equity + Liabilities. Fix the figures or tick override with a note.",
        );
      }
      throw new Error(error.message);
    }
    await auditFinancial(
      user.id,
      data.entity_id,
      "ceo_balance_sheet_entries",
      row?.id ?? null,
      "update",
      data,
    );
    revalidate(data.entity_id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ═══════════════ Financial — cashflow / capex ═══════════════ */

const cashflowSchema = z.object({
  entity_id: uuid,
  txn_date: dateStr,
  direction: z.enum(["in", "out"]),
  category: z.enum(["operating", "investing", "financing"]),
  description: z.string().max(500).nullish(),
  amount: money,
});

export async function addCashflow(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = cashflowSchema.parse(input);
    await assertEntityRole(user.id, data.entity_id, FINANCE);
    const admin = createSupabaseAdminClient();
    const { data: row, error } = await admin
      .from("ceo_cashflow_entries")
      .insert({ ...data, created_by: user.id })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await auditFinancial(
      user.id,
      data.entity_id,
      "ceo_cashflow_entries",
      row?.id ?? null,
      "insert",
      data,
    );
    revalidate(data.entity_id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const capexSchema = z.object({
  entity_id: uuid,
  spend_date: dateStr,
  category: z.string().max(120).nullish(),
  description: z.string().max(500).nullish(),
  amount: money,
  budget_line: z.string().max(120).nullish(),
});

export async function addCapex(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = capexSchema.parse(input);
    await assertEntityRole(user.id, data.entity_id, FINANCE);
    const admin = createSupabaseAdminClient();
    const { data: row, error } = await admin
      .from("ceo_capex_items")
      .insert({ ...data, created_by: user.id })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await auditFinancial(
      user.id,
      data.entity_id,
      "ceo_capex_items",
      row?.id ?? null,
      "insert",
      data,
    );
    revalidate(data.entity_id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

async function deleteFinancialRow(
  table: string,
  rowId: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = uuid.parse(rowId);
    const admin = createSupabaseAdminClient();
    const { data: row } = await admin
      .from(table)
      .select("id, entity_id")
      .eq("id", id)
      .single();
    if (!row) throw new AuthError("NOT_FOUND", "Record not found");
    await assertEntityRole(user.id, row.entity_id, FINANCE);
    const { error } = await admin.from(table).delete().eq("id", id);
    if (error) throw new Error(error.message);
    await auditFinancial(user.id, row.entity_id, table, id, "delete", {});
    revalidate(row.entity_id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCashflow(rowId: unknown): Promise<ActionResult> {
  return deleteFinancialRow("ceo_cashflow_entries", rowId);
}
export async function deleteCapex(rowId: unknown): Promise<ActionResult> {
  return deleteFinancialRow("ceo_capex_items", rowId);
}
export async function deleteInvoice(
  kind: "ar" | "ap",
  rowId: unknown,
): Promise<ActionResult> {
  return deleteFinancialRow(
    kind === "ar" ? "ceo_ar_invoices" : "ceo_ap_invoices",
    rowId,
  );
}
export async function deleteOtherDebt(rowId: unknown): Promise<ActionResult> {
  return deleteFinancialRow("ceo_other_debts", rowId);
}
export async function deleteBankFacility(
  rowId: unknown,
): Promise<ActionResult> {
  return deleteFinancialRow("ceo_bank_facilities", rowId);
}

/* ═══════════════ Financial — AR / AP ═══════════════ */

const invoiceSchema = z.object({
  id: uuid.optional(),
  entity_id: uuid,
  counterparty_name: z.string().trim().min(1).max(200),
  invoice_no: z.string().max(60).nullish(),
  invoice_date: dateStr,
  due_date: dateStr,
  amount: money,
  amount_paid: money.default(0),
  status: z.enum(["open", "partial", "paid", "disputed"]).default("open"),
});

export async function upsertInvoice(
  kind: "ar" | "ap",
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = invoiceSchema.parse(input);
    await assertEntityRole(user.id, data.entity_id, FINANCE);
    const table = kind === "ar" ? "ceo_ar_invoices" : "ceo_ap_invoices";
    const admin = createSupabaseAdminClient();
    const { id, ...rest } = data;
    const query = id
      ? admin
          .from(table)
          .update(rest)
          .eq("id", id)
          .eq("entity_id", data.entity_id)
          .select("id")
          .single()
      : admin
          .from(table)
          .insert({ ...rest, created_by: user.id })
          .select("id")
          .single();
    const { data: row, error } = await query;
    if (error) throw new Error(error.message);
    await auditFinancial(
      user.id,
      data.entity_id,
      table,
      row?.id ?? null,
      id ? "update" : "insert",
      rest,
    );
    revalidate(data.entity_id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ═══════════════ Financial — debts & bank facilities ═══════════════ */

const otherDebtSchema = z.object({
  id: uuid.optional(),
  entity_id: uuid,
  lender: z.string().trim().min(1).max(200),
  debt_type: z.enum([
    "director_loan",
    "shareholder_advance",
    "hire_purchase",
    "other",
  ]),
  amount_outstanding: money.default(0),
  monthly_commitment: money.default(0),
  notes: z.string().max(1000).nullish(),
});

export async function upsertOtherDebt(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = otherDebtSchema.parse(input);
    await assertEntityRole(user.id, data.entity_id, FINANCE);
    const admin = createSupabaseAdminClient();
    const { id, ...rest } = data;
    const query = id
      ? admin
          .from("ceo_other_debts")
          .update(rest)
          .eq("id", id)
          .eq("entity_id", data.entity_id)
          .select("id")
          .single()
      : admin
          .from("ceo_other_debts")
          .insert({ ...rest, created_by: user.id })
          .select("id")
          .single();
    const { data: row, error } = await query;
    if (error) throw new Error(error.message);
    await auditFinancial(
      user.id,
      data.entity_id,
      "ceo_other_debts",
      row?.id ?? null,
      id ? "update" : "insert",
      rest,
    );
    revalidate(data.entity_id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const facilitySchema = z.object({
  id: uuid.optional(),
  entity_id: uuid,
  bank: z.string().trim().min(1).max(200),
  facility_type: z.string().max(120).nullish(),
  original_amount: money.default(0),
  interest_rate: z.coerce.number().min(0).max(100).nullish(),
  monthly_instalment: money.default(0),
  start_date: dateStr.nullish(),
  tenure_months: z.coerce.number().int().min(0).max(600).nullish(),
  instalments_paid: z.coerce.number().int().min(0).max(600).default(0),
  outstanding_balance: money.default(0),
  next_payment_date: dateStr.nullish(),
  maturity_date: dateStr.nullish(),
});

export async function upsertBankFacility(
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = facilitySchema.parse(input);
    await assertEntityRole(user.id, data.entity_id, FINANCE);
    const admin = createSupabaseAdminClient();
    const { id, ...rest } = data;
    const query = id
      ? admin
          .from("ceo_bank_facilities")
          .update(rest)
          .eq("id", id)
          .eq("entity_id", data.entity_id)
          .select("id")
          .single()
      : admin
          .from("ceo_bank_facilities")
          .insert({ ...rest, created_by: user.id })
          .select("id")
          .single();
    const { data: row, error } = await query;
    if (error) throw new Error(error.message);
    await auditFinancial(
      user.id,
      data.entity_id,
      "ceo_bank_facilities",
      row?.id ?? null,
      id ? "update" : "insert",
      rest,
    );
    revalidate(data.entity_id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ═══════════════ Marketing — funnel / strategies / channels ═══════════════ */

const funnelSchema = z.object({
  entity_id: uuid,
  period_start: dateStr,
  granularity,
  total_reach: z.coerce.number().min(0),
  cr1: ratio,
  cr2: ratio,
  avg_sale: money,
  txn_per_customer: z.coerce.number().min(0).max(1000).default(1),
  gp_pct: ratio,
  opex_ref: money.default(0),
});

export async function upsertFunnel(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = funnelSchema.parse(input);
    await assertEntityRole(user.id, data.entity_id, MARKETING);
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("ceo_funnel_entries")
      .upsert(
        { ...data, created_by: user.id },
        { onConflict: "entity_id,period_start,granularity" },
      );
    if (error) throw new Error(error.message);
    revalidate(data.entity_id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const strategySchema = z.object({
  id: uuid.optional(),
  entity_id: uuid,
  name: z.string().trim().min(2).max(200),
  channel: z.string().max(60).nullish(),
  budget: money.default(0),
  start_date: dateStr.nullish(),
  end_date: dateStr.nullish(),
  target_leads: z.coerce.number().min(0).default(0),
  target_sales: money.default(0),
  actual_leads: z.coerce.number().min(0).default(0),
  actual_sales: money.default(0),
  cost_spent: money.default(0),
  status: z
    .enum(["planned", "active", "paused", "completed", "killed"])
    .default("planned"),
});

export async function upsertStrategy(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = strategySchema.parse(input);
    await assertEntityRole(user.id, data.entity_id, [
      ...MARKETING,
      "venture_ceo",
    ]);
    const admin = createSupabaseAdminClient();
    const { id, ...rest } = data;
    const query = id
      ? admin
          .from("ceo_marketing_strategies")
          .update(rest)
          .eq("id", id)
          .eq("entity_id", data.entity_id)
      : admin
          .from("ceo_marketing_strategies")
          .insert({ ...rest, created_by: user.id });
    const { error } = await query;
    if (error) throw new Error(error.message);
    revalidate(data.entity_id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteStrategy(rowId: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = uuid.parse(rowId);
    const admin = createSupabaseAdminClient();
    const { data: row } = await admin
      .from("ceo_marketing_strategies")
      .select("id, entity_id")
      .eq("id", id)
      .single();
    if (!row) throw new AuthError("NOT_FOUND", "Strategy not found");
    await assertEntityRole(user.id, row.entity_id, [
      ...MARKETING,
      "venture_ceo",
    ]);
    const { error } = await admin
      .from("ceo_marketing_strategies")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
    revalidate(row.entity_id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const channelSchema = z.object({
  entity_id: uuid,
  channel: z.enum([
    "facebook",
    "instagram",
    "linkedin",
    "tiktok",
    "threads",
    "website",
    "seo",
    "email",
    "whatsapp",
    "telegram",
    "referral",
    "alliances",
  ]),
  period_start: dateStr,
  granularity,
  reach: z.coerce.number().min(0).default(0),
  followers: z.coerce.number().min(0).default(0),
  engagement_rate: z.coerce.number().min(0).max(100).nullish(),
  clicks: z.coerce.number().min(0).default(0),
  leads: z.coerce.number().min(0).default(0),
  cost: money.default(0),
  customers: z.coerce.number().min(0).default(0),
  revenue: money.default(0),
  extras: z.record(z.unknown()).default({}),
});

export async function upsertChannelMetric(
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = channelSchema.parse(input);
    await assertEntityRole(user.id, data.entity_id, MARKETING);
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("ceo_channel_metrics")
      .upsert(
        { ...data, created_by: user.id },
        { onConflict: "entity_id,channel,period_start,granularity" },
      );
    if (error) throw new Error(error.message);
    revalidate(data.entity_id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ═══════════════ Operations ═══════════════ */

const staffSchema = z.object({
  entity_id: uuid,
  location: z.string().max(120).nullish(),
  period_start: dateStr,
  enps: z.coerce.number().int().min(-100).max(100).nullish(),
  pulse_score: z.coerce.number().min(0).max(10).nullish(),
  turnover_rate: z.coerce.number().min(0).max(100).nullish(),
  absenteeism_rate: z.coerce.number().min(0).max(100).nullish(),
  training_hours: z.coerce.number().min(0).nullish(),
});

export async function addStaffHappiness(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = staffSchema.parse(input);
    await assertEntityRole(user.id, data.entity_id, OPS);
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("ceo_staff_happiness")
      .insert({ ...data, created_by: user.id });
    if (error) throw new Error(error.message);
    revalidate(data.entity_id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const customerSchema = z.object({
  entity_id: uuid,
  location: z.string().max(120).nullish(),
  period_start: dateStr,
  nps: z.coerce.number().int().min(-100).max(100).nullish(),
  csat: z.coerce.number().min(0).max(100).nullish(),
  google_rating: z.coerce.number().min(0).max(5).nullish(),
  google_review_count: z.coerce.number().int().min(0).nullish(),
  complaints_count: z.coerce.number().int().min(0).nullish(),
  avg_resolution_hours: z.coerce.number().min(0).nullish(),
  unresolved_48h_count: z.coerce.number().int().min(0).nullish(),
  repeat_rate: z.coerce.number().min(0).max(100).nullish(),
});

export async function addCustomerHappiness(
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = customerSchema.parse(input);
    await assertEntityRole(user.id, data.entity_id, OPS);
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("ceo_customer_happiness")
      .insert({ ...data, created_by: user.id });
    if (error) throw new Error(error.message);
    revalidate(data.entity_id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const opsMetricSchema = z.object({
  entity_id: uuid,
  metric_code: z.string().min(1).max(80),
  location: z.string().max(120).nullish(),
  period_start: dateStr,
  value: z.coerce.number(),
});

export async function upsertOpsMetric(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = opsMetricSchema.parse(input);
    await assertEntityRole(user.id, data.entity_id, OPS);
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("ceo_ops_metrics")
      .upsert(
        { ...data, location: data.location ?? null, created_by: user.id },
        { onConflict: "entity_id,metric_code,location,period_start" },
      );
    if (error) throw new Error(error.message);
    revalidate(data.entity_id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ═══════════════ KPI definitions, evaluation, red actions ═══════════════ */

const kpiDefSchema = z.object({
  id: uuid.optional(),
  entity_id: uuid,
  name: z.string().trim().min(2).max(160),
  source_kind: z.enum([
    "pnl",
    "bs",
    "cashflow",
    "funnel",
    "channel",
    "staff",
    "customer",
    "ops_metric",
    "strategy_count",
  ]),
  source_ref: z.string().max(80).nullish(),
  target: z.coerce.number().nullish(),
  direction: z.enum(["higher_better", "lower_better"]).default("higher_better"),
  green_threshold_pct: z.coerce.number().min(1).max(500).default(100),
  yellow_threshold_pct: z.coerce.number().min(1).max(500).default(70),
  weight: z.coerce.number().min(0).max(100).default(1),
  is_critical: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export async function upsertKpiDefinition(
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = kpiDefSchema.parse(input);
    await assertEntityRole(user.id, data.entity_id, KPI_ADMIN);
    const admin = createSupabaseAdminClient();
    const { id, ...rest } = data;
    const query = id
      ? admin
          .from("ceo_kpi_definitions")
          .update(rest)
          .eq("id", id)
          .eq("entity_id", data.entity_id)
      : admin
          .from("ceo_kpi_definitions")
          .insert({ ...rest, created_by: user.id });
    const { error } = await query;
    if (error) throw new Error(error.message);
    revalidate(data.entity_id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteKpiDefinition(
  rowId: unknown,
): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const id = uuid.parse(rowId);
    const admin = createSupabaseAdminClient();
    const { data: row } = await admin
      .from("ceo_kpi_definitions")
      .select("id, entity_id")
      .eq("id", id)
      .single();
    if (!row || !row.entity_id)
      throw new AuthError(
        "NOT_FOUND",
        "KPI not found (industry defaults are read-only)",
      );
    await assertEntityRole(user.id, row.entity_id, KPI_ADMIN);
    const { error } = await admin
      .from("ceo_kpi_definitions")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
    revalidate(row.entity_id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const evalSchema = z.object({
  entity_id: uuid,
  period_start: dateStr,
  granularity,
});

export async function runKpiEvaluation(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = evalSchema.parse(input);
    await assertEntityRole(user.id, data.entity_id, ANY_ROLE);
    await evaluateEntityKpis(
      data.entity_id,
      data.period_start,
      data.granularity,
    );
    await sweepEscalations();
    revalidate(data.entity_id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const redActionSchema = z.object({
  kpi_snapshot_id: uuid,
  entity_id: uuid,
  owner_email: z.string().email().nullish(),
  action_note: z.string().trim().min(3).max(1000),
  deadline: dateStr.nullish(),
});

export async function addRedAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = redActionSchema.parse(input);
    await assertEntityRole(user.id, data.entity_id, EXEC);
    const admin = createSupabaseAdminClient();

    let ownerId: string | null = user.id;
    if (data.owner_email) {
      const { data: profile } = await admin
        .from("profiles")
        .select("id")
        .ilike("email", data.owner_email.trim())
        .maybeSingle();
      if (!profile) throw new Error(`No user with email ${data.owner_email}`);
      ownerId = profile.id;
    }

    const { error } = await admin.from("ceo_red_actions").insert({
      kpi_snapshot_id: data.kpi_snapshot_id,
      entity_id: data.entity_id,
      owner_id: ownerId,
      action_note: data.action_note,
      deadline: data.deadline ?? null,
      created_by: user.id,
    });
    if (error) throw new Error(error.message);
    revalidate(data.entity_id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const redActionUpdateSchema = z.object({
  id: uuid,
  status: z.enum(["open", "in_progress", "done"]),
});

export async function updateRedAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const data = redActionUpdateSchema.parse(input);
    const admin = createSupabaseAdminClient();
    const { data: row } = await admin
      .from("ceo_red_actions")
      .select("id, entity_id, owner_id")
      .eq("id", data.id)
      .single();
    if (!row) throw new AuthError("NOT_FOUND", "Action not found");
    if (row.owner_id !== user.id) {
      await assertEntityRole(user.id, row.entity_id, EXEC);
    }
    const { error } = await admin
      .from("ceo_red_actions")
      .update({ status: data.status, escalated_at: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    revalidate(row.entity_id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
