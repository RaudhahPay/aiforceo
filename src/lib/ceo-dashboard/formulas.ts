/**
 * CEO Business Dashboard — formula engine.
 *
 * Every P&L, balance-sheet, funnel, traffic-light, and health-score rule
 * lives here as a pure function. The DB generated columns in
 * supabase/migrations/0017/0018_ceo_*.sql mirror these exactly — a change
 * here without a matching migration + test change is a release blocker.
 *
 * Spec: docs/ceo-dashboard/TECHNICAL-ARCHITECTURE.md (Layer 4, Business Logic Rules)
 */

export type Direction = "higher_better" | "lower_better";
export type TrafficStatus = "green" | "yellow" | "red";

/* ═══════════════ P&L ═══════════════ */

export type PnlInput = {
  sales: number;
  openingStock: number;
  purchases: number;
  closingStock: number;
  opexRental: number;
  opexSalaries: number;
  opexUtilities: number;
  opexMarketing: number;
  opexAdmin: number;
  opexOther: number;
  interest: number;
  depreciation: number;
  tax: number;
};

export type PnlResult = {
  cogs: number;
  grossProfit: number;
  gpPct: number; // 0 when sales is 0
  totalOpex: number;
  ebitda: number;
  /** Management view: EBITDA − interest */
  ebitMgmt: number;
  /** Statutory view: EBITDA − depreciation */
  ebitStat: number;
  /** Statutory view: EBIT − interest */
  pbt: number;
  /** Statutory view: PBT − tax */
  pat: number;
};

export function computePnl(input: PnlInput): PnlResult {
  const cogs = input.openingStock + input.purchases - input.closingStock;
  const grossProfit = input.sales - cogs;
  const totalOpex =
    input.opexRental +
    input.opexSalaries +
    input.opexUtilities +
    input.opexMarketing +
    input.opexAdmin +
    input.opexOther;
  const ebitda = grossProfit - totalOpex;
  const ebitMgmt = ebitda - input.interest;
  const ebitStat = ebitda - input.depreciation;
  const pbt = ebitStat - input.interest;
  const pat = pbt - input.tax;
  return {
    cogs,
    grossProfit,
    gpPct: input.sales !== 0 ? grossProfit / input.sales : 0,
    totalOpex,
    ebitda,
    ebitMgmt,
    ebitStat,
    pbt,
    pat,
  };
}

/* ═══════════════ Balance sheet ═══════════════ */

export type BalanceSheetInput = {
  fixedAssets: number;
  cashBank: number;
  accountsReceivable: number;
  stockValue: number;
  depositsPrepayments: number;
  accountsPayable: number;
  bankLoansCurrent: number;
  bankLoansLongterm: number;
  otherDebtsTotal: number;
  paidUpCapital: number;
  retainedEarnings: number;
  currentYearPl: number;
};

export type BalanceSheetResult = {
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  /** assets = liabilities + equity within 1 sen */
  isBalanced: boolean;
  imbalance: number;
};

const BALANCE_TOLERANCE = 0.01;

export function computeBalanceSheet(
  input: BalanceSheetInput,
): BalanceSheetResult {
  const totalAssets =
    input.fixedAssets +
    input.cashBank +
    input.accountsReceivable +
    input.stockValue +
    input.depositsPrepayments;
  const totalLiabilities =
    input.accountsPayable +
    input.bankLoansCurrent +
    input.bankLoansLongterm +
    input.otherDebtsTotal;
  const totalEquity =
    input.paidUpCapital + input.retainedEarnings + input.currentYearPl;
  const imbalance = totalAssets - (totalLiabilities + totalEquity);
  return {
    totalAssets,
    totalLiabilities,
    totalEquity,
    isBalanced: Math.abs(imbalance) < BALANCE_TOLERANCE,
    imbalance,
  };
}

/* ═══════════════ Funnel (incl. what-if) ═══════════════ */

export type FunnelInput = {
  totalReach: number;
  /** reach → prospect conversion, 0..1 */
  cr1: number;
  /** prospect → customer conversion, 0..1 */
  cr2: number;
  avgSale: number;
  txnPerCustomer: number;
  /** gross-profit share of sales, 0..1 */
  gpPct: number;
  opexRef: number;
};

export type FunnelResult = {
  prospects: number;
  customers: number;
  sales: number;
  grossProfit: number;
  ebitda: number;
};

export function computeFunnel(input: FunnelInput): FunnelResult {
  const prospects = input.totalReach * input.cr1;
  const customers = prospects * input.cr2;
  const sales = customers * input.avgSale * input.txnPerCustomer;
  const grossProfit = sales * input.gpPct;
  return {
    prospects,
    customers,
    sales,
    grossProfit,
    ebitda: grossProfit - input.opexRef,
  };
}

/* ═══════════════ Traffic light ═══════════════ */

export type TrafficLightResult = {
  /** percentage, e.g. 93 for 93% */
  attainmentPct: number;
  status: TrafficStatus;
};

/**
 * attainment = actual/target (higher_better) or target/actual (lower_better).
 * Green ≥ greenThresholdPct (default 100), Yellow ≥ yellowThresholdPct
 * (default 70), else Red. Degenerate targets/actuals never crash the board:
 * a zero denominator counts as full attainment when the numerator is also
 * favourable, else zero.
 */
export function trafficLight(
  actual: number,
  target: number,
  direction: Direction = "higher_better",
  greenThresholdPct = 100,
  yellowThresholdPct = 70,
): TrafficLightResult {
  let ratio: number;
  if (direction === "higher_better") {
    ratio = target === 0 ? (actual >= 0 ? 1 : 0) : actual / target;
  } else {
    ratio = actual === 0 ? 1 : target / actual;
  }
  const attainmentPct = ratio * 100;
  const status: TrafficStatus =
    attainmentPct >= greenThresholdPct
      ? "green"
      : attainmentPct >= yellowThresholdPct
        ? "yellow"
        : "red";
  return { attainmentPct, status };
}

/* ═══════════════ Venture health ═══════════════ */

export type KpiForHealth = {
  attainmentPct: number;
  weight: number;
  status: TrafficStatus;
  isCritical: boolean;
};

export type VentureHealth = {
  /** weighted average attainment, capped per-KPI at 120 so one blowout metric cannot mask reds */
  score: number;
  /** badge = worst of (score band, any red critical KPI) */
  badge: TrafficStatus;
  redCount: number;
};

const SCORE_GREEN_FLOOR = 90;
const SCORE_YELLOW_FLOOR = 70;
const ATTAINMENT_CAP = 120;

export function ventureHealth(kpis: KpiForHealth[]): VentureHealth {
  if (kpis.length === 0) return { score: 0, badge: "yellow", redCount: 0 };
  const totalWeight = kpis.reduce((s, k) => s + k.weight, 0);
  const score =
    totalWeight === 0
      ? 0
      : kpis.reduce(
          (s, k) => s + Math.min(k.attainmentPct, ATTAINMENT_CAP) * k.weight,
          0,
        ) / totalWeight;
  const band: TrafficStatus =
    score >= SCORE_GREEN_FLOOR
      ? "green"
      : score >= SCORE_YELLOW_FLOOR
        ? "yellow"
        : "red";
  const hasRedCritical = kpis.some((k) => k.status === "red" && k.isCritical);
  const badge: TrafficStatus = hasRedCritical ? "red" : band;
  return {
    score,
    badge,
    redCount: kpis.filter((k) => k.status === "red").length,
  };
}

/* ═══════════════ Strategy rule ═══════════════ */

export const MIN_ACTIVE_STRATEGIES = 10;

/** Fewer than 10 active strategies raises an automatic red marketing KPI. */
export function strategyCountStatus(activeCount: number): TrafficStatus {
  return activeCount >= MIN_ACTIVE_STRATEGIES ? "green" : "red";
}

/* ═══════════════ Escalation rule ═══════════════ */

export const ESCALATION_HOURS = 48;

/** Red actions untouched past 48 hours are escalated to the group view. */
export function isEscalated(
  openedAt: Date,
  now: Date,
  statusChanged: boolean,
): boolean {
  if (statusChanged) return false;
  const hoursOpen = (now.getTime() - openedAt.getTime()) / 3_600_000;
  return hoursOpen >= ESCALATION_HOURS;
}
