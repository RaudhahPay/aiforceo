/**
 * CEO Dashboard — CSV import: parse, validate, commit.
 *
 * Used only by the /api/ceo/import route handler (repo convention:
 * route handlers for imports/exports/cron). Dates are strict YYYY-MM-DD —
 * ambiguous d/m vs m/d formats are rejected rather than guessed, and the
 * error report carries the offending row numbers so finance can fix the
 * sheet, not hunt for it.
 */

import Papa from "papaparse";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const IMPORT_TYPES = ["pnl", "cashflow", "ar", "ap"] as const;
export type ImportType = (typeof IMPORT_TYPES)[number];

/** Documented header rows, surfaced by GET /api/ceo/import as templates. */
export const IMPORT_TEMPLATES: Record<ImportType, string[]> = {
  pnl: [
    "period_start",
    "granularity",
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
    "notes",
  ],
  cashflow: ["txn_date", "direction", "category", "description", "amount"],
  ar: [
    "counterparty_name",
    "invoice_no",
    "invoice_date",
    "due_date",
    "amount",
    "amount_paid",
    "status",
  ],
  ap: [
    "counterparty_name",
    "invoice_no",
    "invoice_date",
    "due_date",
    "amount",
    "amount_paid",
    "status",
  ],
};

/** Columns that must be present — everything else defaults or is optional. */
const IMPORT_REQUIRED: Record<ImportType, string[]> = {
  pnl: ["period_start", "granularity"],
  cashflow: ["txn_date", "direction", "category", "amount"],
  ar: ["counterparty_name", "invoice_date", "due_date", "amount"],
  ap: ["counterparty_name", "invoice_date", "due_date", "amount"],
};

const dateStr = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const money = z.coerce.number().min(0).max(999_999_999_999);

const pnlRow = z.object({
  period_start: dateStr,
  granularity: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]),
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
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

const cashflowRow = z.object({
  txn_date: dateStr,
  direction: z.enum(["in", "out"]),
  category: z.enum(["operating", "investing", "financing"]),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  amount: money,
});

const invoiceRow = z.object({
  counterparty_name: z.string().trim().min(1).max(200),
  invoice_no: z.string().trim().max(60).optional().or(z.literal("")),
  invoice_date: dateStr,
  due_date: dateStr,
  amount: money,
  amount_paid: money.default(0),
  status: z.enum(["open", "partial", "paid", "disputed"]).default("open"),
});

const ROW_SCHEMAS: Record<ImportType, z.ZodTypeAny> = {
  pnl: pnlRow,
  cashflow: cashflowRow,
  ar: invoiceRow,
  ap: invoiceRow,
};

export type RowError = { row: number; error: string };

export type ParseOutcome = {
  rows: Record<string, unknown>[];
  errors: RowError[];
};

/**
 * Parse CSV text and validate every row against the import type's schema.
 * Row numbers in errors are 1-based data rows (header excluded), matching
 * what the user sees in a spreadsheet minus the header line.
 */
export function parseAndValidate(
  importType: ImportType,
  csvText: string,
): ParseOutcome {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });

  const errors: RowError[] = parsed.errors.map((e) => ({
    row: (e.row ?? 0) + 1,
    error: e.message,
  }));

  const got = parsed.meta.fields ?? [];
  const missing = IMPORT_REQUIRED[importType].filter((f) => !got.includes(f));
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [{ row: 0, error: `Missing columns: ${missing.join(", ")}` }],
    };
  }

  const schema = ROW_SCHEMAS[importType];
  const rows: Record<string, unknown>[] = [];
  parsed.data.forEach((raw, i) => {
    const result = schema.safeParse(raw);
    if (result.success) {
      rows.push(result.data as Record<string, unknown>);
    } else {
      errors.push({
        row: i + 1,
        error: result.error.errors
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; "),
      });
    }
  });

  return { rows, errors };
}

/**
 * Commit validated rows. P&L upserts on (entity_id, period_start,
 * granularity) so a re-import of a corrected month replaces the old row;
 * cashflow and invoices append. Callers must have verified the finance
 * role for the entity already.
 */
export async function commitRows(
  entityId: string,
  userId: string,
  importType: ImportType,
  rows: Record<string, unknown>[],
): Promise<number> {
  const admin = createSupabaseAdminClient();
  const stamped = rows.map((r) => ({
    ...r,
    notes: r.notes === "" ? null : r.notes,
    description: r.description === "" ? null : r.description,
    invoice_no: r.invoice_no === "" ? null : r.invoice_no,
    entity_id: entityId,
    created_by: userId,
  }));
  // Strip keys that don't exist on the target table
  for (const row of stamped) {
    if (importType !== "pnl") delete row.notes;
    if (importType !== "cashflow") delete row.description;
    if (importType === "pnl" || importType === "cashflow")
      delete row.invoice_no;
  }

  if (importType === "pnl") {
    const { error } = await admin
      .from("ceo_pnl_entries")
      .upsert(stamped, { onConflict: "entity_id,period_start,granularity" });
    if (error) throw new Error(`P&L import failed: ${error.message}`);
    return stamped.length;
  }

  const table =
    importType === "cashflow"
      ? "ceo_cashflow_entries"
      : importType === "ar"
        ? "ceo_ar_invoices"
        : "ceo_ap_invoices";
  const { error } = await admin.from(table).insert(stamped);
  if (error) throw new Error(`${importType} import failed: ${error.message}`);
  return stamped.length;
}
