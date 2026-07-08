/**
 * CEO Dashboard — row types matching the ceo_ tables (snake_case, as
 * returned by Supabase). Keep in sync with supabase/migrations/0016-0018.
 */

import type { Granularity } from "./periods";

export type IndustryType =
  | "fnb"
  | "education"
  | "healthcare"
  | "tech_saas"
  | "retail_ecommerce"
  | "other";

export const INDUSTRY_LABELS: Record<IndustryType, string> = {
  fnb: "F&B",
  education: "Education",
  healthcare: "Healthcare",
  tech_saas: "Tech / SaaS",
  retail_ecommerce: "Retail / eCommerce",
  other: "Other",
};

export type CeoRole =
  "group_ceo" | "venture_ceo" | "finance" | "marketing" | "ops" | "admin";

export type MarketingChannel =
  | "facebook"
  | "instagram"
  | "linkedin"
  | "tiktok"
  | "threads"
  | "website"
  | "seo"
  | "email"
  | "whatsapp"
  | "telegram"
  | "referral"
  | "alliances";

export const CHANNEL_LABELS: Record<MarketingChannel, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  threads: "Threads",
  website: "Website",
  seo: "SEO",
  email: "Email",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  referral: "Referral / Affiliate",
  alliances: "Strategic Alliances",
};

export type CeoEntity = {
  id: string;
  org_id: string;
  name: string;
  industry_type: IndustryType;
  currency: string;
  is_active: boolean;
  sort_weight: number;
};

export type PnlRow = {
  id: string;
  entity_id: string;
  period_start: string;
  granularity: Granularity;
  sales: number;
  opening_stock: number;
  purchases: number;
  closing_stock: number;
  opex_rental: number;
  opex_salaries: number;
  opex_utilities: number;
  opex_marketing: number;
  opex_admin: number;
  opex_other: number;
  interest: number;
  depreciation: number;
  tax: number;
  notes: string | null;
  cogs: number;
  gross_profit: number;
  ebitda: number;
  ebit_mgmt: number;
  ebit_stat: number;
  pbt: number;
  pat: number;
};

export type BalanceSheetRow = {
  id: string;
  entity_id: string;
  period_start: string;
  granularity: Granularity;
  fixed_assets: number;
  cash_bank: number;
  accounts_receivable: number;
  stock_value: number;
  deposits_prepayments: number;
  accounts_payable: number;
  bank_loans_current: number;
  bank_loans_longterm: number;
  other_debts_total: number;
  paid_up_capital: number;
  retained_earnings: number;
  current_year_pl: number;
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  is_balanced: boolean;
  override_unbalanced: boolean;
  override_note: string | null;
};

export type CashflowRow = {
  id: string;
  entity_id: string;
  txn_date: string;
  direction: "in" | "out";
  category: "operating" | "investing" | "financing";
  description: string | null;
  amount: number;
};

export type CapexRow = {
  id: string;
  entity_id: string;
  spend_date: string;
  category: string | null;
  description: string | null;
  amount: number;
  budget_line: string | null;
};

export type InvoiceRow = {
  id: string;
  entity_id: string;
  counterparty_name: string;
  invoice_no: string | null;
  invoice_date: string;
  due_date: string;
  amount: number;
  amount_paid: number;
  status: "open" | "partial" | "paid" | "disputed";
};

export type AgingRow = {
  entity_id: string;
  current: number;
  d30: number;
  d60: number;
  d90: number;
  d90_plus: number;
  total_outstanding: number;
};

export type OtherDebtRow = {
  id: string;
  entity_id: string;
  lender: string;
  debt_type:
    "director_loan" | "shareholder_advance" | "hire_purchase" | "other";
  amount_outstanding: number;
  monthly_commitment: number;
  notes: string | null;
};

export type BankFacilityRow = {
  id: string;
  entity_id: string;
  bank: string;
  facility_type: string | null;
  original_amount: number;
  interest_rate: number | null;
  monthly_instalment: number;
  start_date: string | null;
  tenure_months: number | null;
  instalments_paid: number;
  outstanding_balance: number;
  next_payment_date: string | null;
  maturity_date: string | null;
};

export type FunnelRow = {
  id: string;
  entity_id: string;
  period_start: string;
  granularity: Granularity;
  total_reach: number;
  cr1: number;
  cr2: number;
  avg_sale: number;
  txn_per_customer: number;
  gp_pct: number;
  opex_ref: number;
  prospects: number;
  customers: number;
  sales: number;
  gross_profit: number;
  ebitda: number;
};

export type StrategyRow = {
  id: string;
  entity_id: string;
  name: string;
  channel: string | null;
  owner_id: string | null;
  budget: number;
  start_date: string | null;
  end_date: string | null;
  target_leads: number;
  target_sales: number;
  actual_leads: number;
  actual_sales: number;
  cost_spent: number;
  status: "planned" | "active" | "paused" | "completed" | "killed";
  cpa: number | null;
  roi: number | null;
};

export type ChannelMetricRow = {
  id: string;
  entity_id: string;
  channel: MarketingChannel;
  period_start: string;
  granularity: Granularity;
  reach: number;
  followers: number;
  engagement_rate: number | null;
  clicks: number;
  leads: number;
  cost: number;
  customers: number;
  revenue: number;
  extras: Record<string, unknown>;
  cpl: number | null;
  roi: number | null;
};

export type StaffHappinessRow = {
  id: string;
  entity_id: string;
  location: string | null;
  period_start: string;
  enps: number | null;
  pulse_score: number | null;
  turnover_rate: number | null;
  absenteeism_rate: number | null;
  training_hours: number | null;
};

export type CustomerHappinessRow = {
  id: string;
  entity_id: string;
  location: string | null;
  period_start: string;
  nps: number | null;
  csat: number | null;
  google_rating: number | null;
  google_review_count: number | null;
  complaints_count: number | null;
  avg_resolution_hours: number | null;
  unresolved_48h_count: number | null;
  repeat_rate: number | null;
};

export type MetricDefinitionRow = {
  code: string;
  name: string;
  industry_type: IndustryType;
  unit: string;
  direction: "higher_better" | "lower_better";
  default_target: number | null;
};

export type OpsMetricRow = {
  id: string;
  entity_id: string;
  metric_code: string;
  location: string | null;
  period_start: string;
  value: number;
};

export type KpiDefinitionRow = {
  id: string;
  entity_id: string | null;
  industry_type: IndustryType | null;
  name: string;
  source_kind:
    | "pnl"
    | "bs"
    | "cashflow"
    | "funnel"
    | "channel"
    | "staff"
    | "customer"
    | "ops_metric"
    | "strategy_count";
  source_ref: string | null;
  target: number | null;
  direction: "higher_better" | "lower_better";
  green_threshold_pct: number;
  yellow_threshold_pct: number;
  weight: number;
  is_critical: boolean;
  is_active: boolean;
};

export type KpiSnapshotRow = {
  id: string;
  kpi_id: string;
  entity_id: string;
  period_start: string;
  granularity: Granularity;
  actual: number | null;
  attainment_pct: number | null;
  status: "green" | "yellow" | "red";
  computed_at: string;
};

export type RedActionRow = {
  id: string;
  kpi_snapshot_id: string;
  entity_id: string;
  owner_id: string | null;
  action_note: string;
  deadline: string | null;
  status: "open" | "in_progress" | "done" | "escalated";
  escalated_at: string | null;
  created_at: string;
};

/** RM 1,234,567.89 → "RM 1.23M"-style compact display */
export function fmtMoney(
  n: number | null | undefined,
  currency = "MYR",
): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const prefix = currency === "MYR" ? "RM " : `${currency} `;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${prefix}${(n / 1_000).toFixed(0)}K`;
  return `${prefix}${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-MY", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
}
