"use client";

/**
 * CEO Business Dashboard — Financial tab.
 * P&L (management/statutory), balance sheet, cashflow, capex, AR/AP,
 * other debts, and bank facilities for a single entity + period.
 */

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  SectionCard,
  Table,
  Td,
  Field,
  TextInput,
  NumInput,
  Select,
  FormGrid,
  ActionForm,
  GhostButton,
} from "@/app/ceo/_components/ui";
import { C, Stat } from "@/app/_components/dashboard-primitives";
import { computePnl, computeBalanceSheet } from "@/lib/ceo-dashboard/formulas";
import { periodLabel, type Granularity } from "@/lib/ceo-dashboard/periods";
import { fmtMoney, fmtNum, fmtPct } from "@/lib/ceo-dashboard/types";
import type {
  PnlRow,
  BalanceSheetRow,
  CashflowRow,
  CapexRow,
  InvoiceRow,
  AgingRow,
  OtherDebtRow,
  BankFacilityRow,
} from "@/lib/ceo-dashboard/types";
import {
  upsertPnl,
  upsertBalanceSheet,
  addCashflow,
  deleteCashflow,
  addCapex,
  deleteCapex,
  upsertInvoice,
  deleteInvoice,
  upsertOtherDebt,
  deleteOtherDebt,
  upsertBankFacility,
  deleteBankFacility,
} from "@/server/actions/ceo";

/* ═══════════════════════ Props ═══════════════════════ */

type FinancialTabProps = {
  entityId: string;
  currency: string;
  period: string;
  granularity: Granularity;
  bsPeriod: string;
  bsGranularity: Granularity;
  canWrite: boolean;
  pnl: PnlRow | null;
  pnlHistory: PnlRow[];
  balanceSheet: BalanceSheetRow | null;
  cashflow: CashflowRow[];
  capexInPeriod: CapexRow[];
  capexAll: CapexRow[];
  arInvoices: InvoiceRow[];
  apInvoices: InvoiceRow[];
  arAging: AgingRow | null;
  apAging: AgingRow | null;
  otherDebts: OtherDebtRow[];
  facilities: BankFacilityRow[];
};

/* ═══════════════════════ Small shared bits ═══════════════════════ */

function ReadOnlyNote() {
  return (
    <div style={{ fontSize: 12, color: C.dim, fontStyle: "italic" }}>
      Finance role required to enter data.
    </div>
  );
}

function StatementRow({
  label,
  value,
  indent,
  bold,
  subtle,
  tone,
}: {
  label: string;
  value: string;
  indent?: boolean;
  bold?: boolean;
  subtle?: boolean;
  tone?: "good" | "bad";
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "6px 0",
        paddingLeft: indent ? 18 : 0,
        borderBottom: bold ? `1px solid ${C.line}` : "none",
        fontSize: subtle ? 11 : 13,
      }}
    >
      <span
        style={{
          color: subtle ? C.dim : indent ? C.dim : C.text,
          fontWeight: bold ? 700 : 400,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontVariantNumeric: "tabular-nums",
          fontWeight: bold ? 700 : 500,
          color:
            tone === "good"
              ? C.green
              : tone === "bad"
                ? C.red
                : subtle
                  ? C.dim
                  : C.text,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function toneOf(n: number): "good" | "bad" {
  return n >= 0 ? "good" : "bad";
}

/* ═══════════════════════ 1. P&L statement + form ═══════════════════════ */

type PnlFormState = {
  sales: string;
  opening_stock: string;
  purchases: string;
  closing_stock: string;
  opex_rental: string;
  opex_salaries: string;
  opex_utilities: string;
  opex_marketing: string;
  opex_admin: string;
  opex_other: string;
  interest: string;
  depreciation: string;
  tax: string;
  notes: string;
};

function emptyPnlForm(pnl: PnlRow | null): PnlFormState {
  return {
    sales: pnl ? String(pnl.sales) : "",
    opening_stock: pnl ? String(pnl.opening_stock) : "",
    purchases: pnl ? String(pnl.purchases) : "",
    closing_stock: pnl ? String(pnl.closing_stock) : "",
    opex_rental: pnl ? String(pnl.opex_rental) : "",
    opex_salaries: pnl ? String(pnl.opex_salaries) : "",
    opex_utilities: pnl ? String(pnl.opex_utilities) : "",
    opex_marketing: pnl ? String(pnl.opex_marketing) : "",
    opex_admin: pnl ? String(pnl.opex_admin) : "",
    opex_other: pnl ? String(pnl.opex_other) : "",
    interest: pnl ? String(pnl.interest) : "",
    depreciation: pnl ? String(pnl.depreciation) : "",
    tax: pnl ? String(pnl.tax) : "",
    notes: pnl?.notes ?? "",
  };
}

function n(v: string): number {
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
}

function PnlStatement({
  pnl,
  currency,
  view,
}: {
  pnl: PnlRow;
  currency: string;
  view: "management" | "statutory";
}) {
  const gpPct = pnl.sales !== 0 ? (pnl.gross_profit / pnl.sales) * 100 : 0;
  const totalOpex =
    pnl.opex_rental +
    pnl.opex_salaries +
    pnl.opex_utilities +
    pnl.opex_marketing +
    pnl.opex_admin +
    pnl.opex_other;

  if (view === "management") {
    return (
      <div>
        <StatementRow label="Sales" value={fmtMoney(pnl.sales, currency)} />
        <StatementRow
          label="Opening Stock"
          value={fmtMoney(pnl.opening_stock, currency)}
          indent
          subtle
        />
        <StatementRow
          label="+ Purchases"
          value={fmtMoney(pnl.purchases, currency)}
          indent
          subtle
        />
        <StatementRow
          label="− Closing Stock"
          value={fmtMoney(pnl.closing_stock, currency)}
          indent
          subtle
        />
        <StatementRow
          label="COGS"
          value={fmtMoney(pnl.cogs, currency)}
          indent
        />
        <StatementRow
          label="Gross Profit"
          value={fmtMoney(pnl.gross_profit, currency)}
          bold
          tone={toneOf(pnl.gross_profit)}
        />
        <StatementRow label="GP %" value={fmtPct(gpPct)} subtle />
        <div style={{ height: 10 }} />
        <StatementRow
          label="Rental"
          value={fmtMoney(pnl.opex_rental, currency)}
          indent
          subtle
        />
        <StatementRow
          label="Salaries"
          value={fmtMoney(pnl.opex_salaries, currency)}
          indent
          subtle
        />
        <StatementRow
          label="Utilities"
          value={fmtMoney(pnl.opex_utilities, currency)}
          indent
          subtle
        />
        <StatementRow
          label="Marketing"
          value={fmtMoney(pnl.opex_marketing, currency)}
          indent
          subtle
        />
        <StatementRow
          label="Admin"
          value={fmtMoney(pnl.opex_admin, currency)}
          indent
          subtle
        />
        <StatementRow
          label="Other"
          value={fmtMoney(pnl.opex_other, currency)}
          indent
          subtle
        />
        <StatementRow
          label="Total OPEX"
          value={fmtMoney(totalOpex, currency)}
          indent
        />
        <StatementRow
          label="EBITDA"
          value={fmtMoney(pnl.ebitda, currency)}
          bold
          tone={toneOf(pnl.ebitda)}
        />
        <StatementRow
          label="− Interest"
          value={fmtMoney(pnl.interest, currency)}
          indent
          subtle
        />
        <StatementRow
          label="EBIT"
          value={fmtMoney(pnl.ebit_mgmt, currency)}
          bold
          tone={toneOf(pnl.ebit_mgmt)}
        />
      </div>
    );
  }

  return (
    <div>
      <StatementRow label="Sales" value={fmtMoney(pnl.sales, currency)} />
      <StatementRow
        label="Gross Profit"
        value={fmtMoney(pnl.gross_profit, currency)}
        tone={toneOf(pnl.gross_profit)}
      />
      <StatementRow
        label="EBITDA"
        value={fmtMoney(pnl.ebitda, currency)}
        tone={toneOf(pnl.ebitda)}
      />
      <StatementRow
        label="− Depreciation"
        value={fmtMoney(pnl.depreciation, currency)}
        indent
        subtle
      />
      <StatementRow
        label="EBIT"
        value={fmtMoney(pnl.ebit_stat, currency)}
        tone={toneOf(pnl.ebit_stat)}
      />
      <StatementRow
        label="− Interest"
        value={fmtMoney(pnl.interest, currency)}
        indent
        subtle
      />
      <StatementRow
        label="PBT"
        value={fmtMoney(pnl.pbt, currency)}
        tone={toneOf(pnl.pbt)}
      />
      <StatementRow
        label="− Tax"
        value={fmtMoney(pnl.tax, currency)}
        indent
        subtle
      />
      <StatementRow
        label="PAT"
        value={fmtMoney(pnl.pat, currency)}
        bold
        tone={toneOf(pnl.pat)}
      />
    </div>
  );
}

function PnlSection({
  entityId,
  currency,
  period,
  granularity,
  canWrite,
  pnl,
}: {
  entityId: string;
  currency: string;
  period: string;
  granularity: Granularity;
  canWrite: boolean;
  pnl: PnlRow | null;
}) {
  const router = useRouter();
  const [view, setView] = useState<"management" | "statutory">("management");
  const [form, setForm] = useState<PnlFormState>(() => emptyPnlForm(pnl));

  const preview = useMemo(
    () =>
      computePnl({
        sales: n(form.sales),
        openingStock: n(form.opening_stock),
        purchases: n(form.purchases),
        closingStock: n(form.closing_stock),
        opexRental: n(form.opex_rental),
        opexSalaries: n(form.opex_salaries),
        opexUtilities: n(form.opex_utilities),
        opexMarketing: n(form.opex_marketing),
        opexAdmin: n(form.opex_admin),
        opexOther: n(form.opex_other),
        interest: n(form.interest),
        depreciation: n(form.depreciation),
        tax: n(form.tax),
      }),
    [form],
  );

  function set(key: keyof PnlFormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? C.gold : "transparent",
    color: active ? "#101318" : C.dim,
    border: `1px solid ${active ? C.gold : C.line}`,
    borderRadius: 7,
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  });

  return (
    <SectionCard
      title="Profit & Loss Statement"
      note={periodLabel(period, granularity)}
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button
          type="button"
          style={toggleBtnStyle(view === "management")}
          onClick={() => setView("management")}
        >
          Management
        </button>
        <button
          type="button"
          style={toggleBtnStyle(view === "statutory")}
          onClick={() => setView("statutory")}
        >
          Statutory
        </button>
      </div>

      {pnl ? (
        <PnlStatement pnl={pnl} currency={currency} view={view} />
      ) : (
        <div style={{ fontSize: 12, color: C.dim, fontStyle: "italic" }}>
          No P&L entered for this period yet.
        </div>
      )}

      {canWrite ? (
        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: `1px solid ${C.line}`,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: C.dim,
              marginBottom: 10,
            }}
          >
            ENTER / UPDATE P&amp;L
          </div>
          <ActionForm
            submitLabel="Save P&L"
            onSubmit={() =>
              upsertPnl({
                entity_id: entityId,
                period_start: period,
                granularity,
                sales: n(form.sales),
                opening_stock: n(form.opening_stock),
                purchases: n(form.purchases),
                closing_stock: n(form.closing_stock),
                opex_rental: n(form.opex_rental),
                opex_salaries: n(form.opex_salaries),
                opex_utilities: n(form.opex_utilities),
                opex_marketing: n(form.opex_marketing),
                opex_admin: n(form.opex_admin),
                opex_other: n(form.opex_other),
                interest: n(form.interest),
                depreciation: n(form.depreciation),
                tax: n(form.tax),
                notes: form.notes || null,
              })
            }
            onDone={() => router.refresh()}
          >
            <FormGrid>
              <Field label="Sales">
                <NumInput
                  value={form.sales}
                  onChange={(e) => set("sales", e.target.value)}
                />
              </Field>
              <Field label="Opening Stock">
                <NumInput
                  value={form.opening_stock}
                  onChange={(e) => set("opening_stock", e.target.value)}
                />
              </Field>
              <Field label="Purchases">
                <NumInput
                  value={form.purchases}
                  onChange={(e) => set("purchases", e.target.value)}
                />
              </Field>
              <Field label="Closing Stock">
                <NumInput
                  value={form.closing_stock}
                  onChange={(e) => set("closing_stock", e.target.value)}
                />
              </Field>
            </FormGrid>
            <FormGrid>
              <Field label="Rental">
                <NumInput
                  value={form.opex_rental}
                  onChange={(e) => set("opex_rental", e.target.value)}
                />
              </Field>
              <Field label="Salaries">
                <NumInput
                  value={form.opex_salaries}
                  onChange={(e) => set("opex_salaries", e.target.value)}
                />
              </Field>
              <Field label="Utilities">
                <NumInput
                  value={form.opex_utilities}
                  onChange={(e) => set("opex_utilities", e.target.value)}
                />
              </Field>
              <Field label="Marketing">
                <NumInput
                  value={form.opex_marketing}
                  onChange={(e) => set("opex_marketing", e.target.value)}
                />
              </Field>
              <Field label="Admin">
                <NumInput
                  value={form.opex_admin}
                  onChange={(e) => set("opex_admin", e.target.value)}
                />
              </Field>
              <Field label="Other OPEX">
                <NumInput
                  value={form.opex_other}
                  onChange={(e) => set("opex_other", e.target.value)}
                />
              </Field>
            </FormGrid>
            <FormGrid>
              <Field label="Interest">
                <NumInput
                  value={form.interest}
                  onChange={(e) => set("interest", e.target.value)}
                />
              </Field>
              <Field label="Depreciation">
                <NumInput
                  value={form.depreciation}
                  onChange={(e) => set("depreciation", e.target.value)}
                />
              </Field>
              <Field label="Tax">
                <NumInput
                  value={form.tax}
                  onChange={(e) => set("tax", e.target.value)}
                />
              </Field>
              <Field label="Notes" width="100%">
                <TextInput
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Optional notes"
                />
              </Field>
            </FormGrid>
          </ActionForm>

          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              background: C.panel2,
              borderRadius: 8,
              display: "flex",
              gap: 18,
              flexWrap: "wrap",
              fontSize: 12,
            }}
          >
            <span style={{ color: C.dim }}>Live preview:</span>
            <span>
              GP <b>{fmtMoney(preview.grossProfit, currency)}</b>
            </span>
            <span>
              EBITDA <b>{fmtMoney(preview.ebitda, currency)}</b>
            </span>
            <span>
              EBIT <b>{fmtMoney(preview.ebitMgmt, currency)}</b>
            </span>
            <span>
              PAT <b>{fmtMoney(preview.pat, currency)}</b>
            </span>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          <ReadOnlyNote />
        </div>
      )}
    </SectionCard>
  );
}

/* ═══════════════════════ 2. P&L history ═══════════════════════ */

function PnlHistorySection({
  pnlHistory,
  currency,
  granularity,
}: {
  pnlHistory: PnlRow[];
  currency: string;
  granularity: Granularity;
}) {
  return (
    <SectionCard title="P&L History">
      {pnlHistory.length === 0 ? (
        <div style={{ fontSize: 12, color: C.dim, fontStyle: "italic" }}>
          No history yet.
        </div>
      ) : (
        <Table head={["Period", "Sales", "Gross Profit", "EBITDA", "PAT"]}>
          {pnlHistory.map((row) => (
            <tr key={row.id}>
              <Td>{periodLabel(row.period_start, granularity)}</Td>
              <Td right>{fmtMoney(row.sales, currency)}</Td>
              <Td
                right
                color={toneOf(row.gross_profit) === "good" ? C.green : C.red}
              >
                {fmtMoney(row.gross_profit, currency)}
              </Td>
              <Td right color={toneOf(row.ebitda) === "good" ? C.green : C.red}>
                {fmtMoney(row.ebitda, currency)}
              </Td>
              <Td right color={toneOf(row.pat) === "good" ? C.green : C.red}>
                {fmtMoney(row.pat, currency)}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </SectionCard>
  );
}

/* ═══════════════════════ 3. Balance sheet ═══════════════════════ */

type BsFormState = {
  fixed_assets: string;
  cash_bank: string;
  accounts_receivable: string;
  stock_value: string;
  deposits_prepayments: string;
  accounts_payable: string;
  bank_loans_current: string;
  bank_loans_longterm: string;
  other_debts_total: string;
  paid_up_capital: string;
  retained_earnings: string;
  current_year_pl: string;
};

function emptyBsForm(bs: BalanceSheetRow | null): BsFormState {
  return {
    fixed_assets: bs ? String(bs.fixed_assets) : "",
    cash_bank: bs ? String(bs.cash_bank) : "",
    accounts_receivable: bs ? String(bs.accounts_receivable) : "",
    stock_value: bs ? String(bs.stock_value) : "",
    deposits_prepayments: bs ? String(bs.deposits_prepayments) : "",
    accounts_payable: bs ? String(bs.accounts_payable) : "",
    bank_loans_current: bs ? String(bs.bank_loans_current) : "",
    bank_loans_longterm: bs ? String(bs.bank_loans_longterm) : "",
    other_debts_total: bs ? String(bs.other_debts_total) : "",
    paid_up_capital: bs ? String(bs.paid_up_capital) : "",
    retained_earnings: bs ? String(bs.retained_earnings) : "",
    current_year_pl: bs ? String(bs.current_year_pl) : "",
  };
}

function BalanceSheetSection({
  entityId,
  currency,
  bsPeriod,
  bsGranularity,
  canWrite,
  balanceSheet,
}: {
  entityId: string;
  currency: string;
  bsPeriod: string;
  bsGranularity: Granularity;
  canWrite: boolean;
  balanceSheet: BalanceSheetRow | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<BsFormState>(() =>
    emptyBsForm(balanceSheet),
  );
  const [overrideUnbalanced, setOverrideUnbalanced] = useState(false);
  const [overrideNote, setOverrideNote] = useState("");

  function set(key: keyof BsFormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const liveResult = useMemo(
    () =>
      computeBalanceSheet({
        fixedAssets: n(form.fixed_assets),
        cashBank: n(form.cash_bank),
        accountsReceivable: n(form.accounts_receivable),
        stockValue: n(form.stock_value),
        depositsPrepayments: n(form.deposits_prepayments),
        accountsPayable: n(form.accounts_payable),
        bankLoansCurrent: n(form.bank_loans_current),
        bankLoansLongterm: n(form.bank_loans_longterm),
        otherDebtsTotal: n(form.other_debts_total),
        paidUpCapital: n(form.paid_up_capital),
        retainedEarnings: n(form.retained_earnings),
        currentYearPl: n(form.current_year_pl),
      }),
    [form],
  );

  const displayResult = balanceSheet
    ? computeBalanceSheet({
        fixedAssets: balanceSheet.fixed_assets,
        cashBank: balanceSheet.cash_bank,
        accountsReceivable: balanceSheet.accounts_receivable,
        stockValue: balanceSheet.stock_value,
        depositsPrepayments: balanceSheet.deposits_prepayments,
        accountsPayable: balanceSheet.accounts_payable,
        bankLoansCurrent: balanceSheet.bank_loans_current,
        bankLoansLongterm: balanceSheet.bank_loans_longterm,
        otherDebtsTotal: balanceSheet.other_debts_total,
        paidUpCapital: balanceSheet.paid_up_capital,
        retainedEarnings: balanceSheet.retained_earnings,
        currentYearPl: balanceSheet.current_year_pl,
      })
    : null;

  return (
    <SectionCard
      title="Balance Sheet"
      note={`${periodLabel(bsPeriod, bsGranularity)} (daily/weekly views roll up to the month)`}
    >
      {balanceSheet ? (
        <>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 260px" }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.dim,
                  marginBottom: 6,
                }}
              >
                ASSETS
              </div>
              <StatementRow
                label="Fixed Assets"
                value={fmtMoney(balanceSheet.fixed_assets, currency)}
              />
              <StatementRow
                label="Cash & Bank"
                value={fmtMoney(balanceSheet.cash_bank, currency)}
              />
              <StatementRow
                label="Accounts Receivable"
                value={fmtMoney(balanceSheet.accounts_receivable, currency)}
              />
              <StatementRow
                label="Stock Value"
                value={fmtMoney(balanceSheet.stock_value, currency)}
              />
              <StatementRow
                label="Deposits & Prepayments"
                value={fmtMoney(balanceSheet.deposits_prepayments, currency)}
              />
              <StatementRow
                label="Total Assets"
                value={fmtMoney(balanceSheet.total_assets, currency)}
                bold
              />
            </div>
            <div style={{ flex: "1 1 260px" }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.dim,
                  marginBottom: 6,
                }}
              >
                EQUITY + LIABILITIES
              </div>
              <StatementRow
                label="Paid-up Capital"
                value={fmtMoney(balanceSheet.paid_up_capital, currency)}
              />
              <StatementRow
                label="Retained Earnings"
                value={fmtMoney(balanceSheet.retained_earnings, currency)}
              />
              <StatementRow
                label="Current Year P/L"
                value={fmtMoney(balanceSheet.current_year_pl, currency)}
              />
              <StatementRow
                label="Total Equity"
                value={fmtMoney(balanceSheet.total_equity, currency)}
                bold
              />
              <div style={{ height: 10 }} />
              <StatementRow
                label="Accounts Payable"
                value={fmtMoney(balanceSheet.accounts_payable, currency)}
              />
              <StatementRow
                label="Bank Loans (Current)"
                value={fmtMoney(balanceSheet.bank_loans_current, currency)}
              />
              <StatementRow
                label="Bank Loans (Long-term)"
                value={fmtMoney(balanceSheet.bank_loans_longterm, currency)}
              />
              <StatementRow
                label="Other Debts"
                value={fmtMoney(balanceSheet.other_debts_total, currency)}
              />
              <StatementRow
                label="Total Liabilities"
                value={fmtMoney(balanceSheet.total_liabilities, currency)}
                bold
              />
            </div>
          </div>
          {displayResult ? (
            <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700 }}>
              {displayResult.isBalanced ? (
                <span style={{ color: C.green }}>Balanced ✓</span>
              ) : (
                <span style={{ color: C.red }}>
                  Out by {fmtMoney(Math.abs(displayResult.imbalance), currency)}
                </span>
              )}
            </div>
          ) : null}
        </>
      ) : (
        <div style={{ fontSize: 12, color: C.dim, fontStyle: "italic" }}>
          No balance sheet entered for this period yet.
        </div>
      )}

      {canWrite ? (
        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: `1px solid ${C.line}`,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: C.dim,
              marginBottom: 10,
            }}
          >
            ENTER / UPDATE BALANCE SHEET
          </div>
          <ActionForm
            submitLabel="Save Balance Sheet"
            onSubmit={() =>
              upsertBalanceSheet({
                entity_id: entityId,
                period_start: bsPeriod,
                granularity: bsGranularity,
                fixed_assets: n(form.fixed_assets),
                cash_bank: n(form.cash_bank),
                accounts_receivable: n(form.accounts_receivable),
                stock_value: n(form.stock_value),
                deposits_prepayments: n(form.deposits_prepayments),
                accounts_payable: n(form.accounts_payable),
                bank_loans_current: n(form.bank_loans_current),
                bank_loans_longterm: n(form.bank_loans_longterm),
                other_debts_total: n(form.other_debts_total),
                paid_up_capital: n(form.paid_up_capital),
                retained_earnings: n(form.retained_earnings),
                current_year_pl: n(form.current_year_pl),
                override_unbalanced: overrideUnbalanced,
                override_note: overrideNote || null,
              })
            }
            onDone={() => router.refresh()}
          >
            <FormGrid>
              <Field label="Fixed Assets">
                <NumInput
                  value={form.fixed_assets}
                  onChange={(e) => set("fixed_assets", e.target.value)}
                />
              </Field>
              <Field label="Cash & Bank">
                <NumInput
                  value={form.cash_bank}
                  onChange={(e) => set("cash_bank", e.target.value)}
                />
              </Field>
              <Field label="Accounts Receivable">
                <NumInput
                  value={form.accounts_receivable}
                  onChange={(e) => set("accounts_receivable", e.target.value)}
                />
              </Field>
              <Field label="Stock Value">
                <NumInput
                  value={form.stock_value}
                  onChange={(e) => set("stock_value", e.target.value)}
                />
              </Field>
              <Field label="Deposits & Prepayments">
                <NumInput
                  value={form.deposits_prepayments}
                  onChange={(e) => set("deposits_prepayments", e.target.value)}
                />
              </Field>
            </FormGrid>
            <FormGrid>
              <Field label="Accounts Payable">
                <NumInput
                  value={form.accounts_payable}
                  onChange={(e) => set("accounts_payable", e.target.value)}
                />
              </Field>
              <Field label="Bank Loans (Current)">
                <NumInput
                  value={form.bank_loans_current}
                  onChange={(e) => set("bank_loans_current", e.target.value)}
                />
              </Field>
              <Field label="Bank Loans (Long-term)">
                <NumInput
                  value={form.bank_loans_longterm}
                  onChange={(e) => set("bank_loans_longterm", e.target.value)}
                />
              </Field>
              <Field label="Other Debts">
                <NumInput
                  value={form.other_debts_total}
                  onChange={(e) => set("other_debts_total", e.target.value)}
                />
              </Field>
            </FormGrid>
            <FormGrid>
              <Field label="Paid-up Capital">
                <NumInput
                  value={form.paid_up_capital}
                  onChange={(e) => set("paid_up_capital", e.target.value)}
                />
              </Field>
              <Field label="Retained Earnings">
                <NumInput
                  value={form.retained_earnings}
                  onChange={(e) => set("retained_earnings", e.target.value)}
                />
              </Field>
              <Field label="Current Year P/L">
                <NumInput
                  value={form.current_year_pl}
                  onChange={(e) => set("current_year_pl", e.target.value)}
                />
              </Field>
            </FormGrid>

            <div
              style={{
                padding: "10px 12px",
                background: C.panel2,
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {liveResult.isBalanced ? (
                <span style={{ color: C.green }}>Balanced ✓</span>
              ) : (
                <span style={{ color: C.red }}>
                  Out by {fmtMoney(Math.abs(liveResult.imbalance), currency)}
                </span>
              )}
            </div>

            {!liveResult.isBalanced ? (
              <div style={{ display: "grid", gap: 8 }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12,
                    color: C.dim,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={overrideUnbalanced}
                    onChange={(e) => setOverrideUnbalanced(e.target.checked)}
                  />
                  Save anyway (needs a note)
                </label>
                {overrideUnbalanced ? (
                  <Field label="Override note" width="100%">
                    <TextInput
                      value={overrideNote}
                      onChange={(e) => setOverrideNote(e.target.value)}
                      placeholder="Why is this unbalanced?"
                    />
                  </Field>
                ) : null}
              </div>
            ) : null}
          </ActionForm>
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          <ReadOnlyNote />
        </div>
      )}
    </SectionCard>
  );
}

/* ═══════════════════════ 4. Cash flow ═══════════════════════ */

function CashflowSection({
  entityId,
  currency,
  period,
  canWrite,
  cashflow,
}: {
  entityId: string;
  currency: string;
  period: string;
  canWrite: boolean;
  cashflow: CashflowRow[];
}) {
  const router = useRouter();
  const [txnDate, setTxnDate] = useState(period);
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [category, setCategory] = useState<
    "operating" | "investing" | "financing"
  >("operating");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  const moneyIn = cashflow
    .filter((c) => c.direction === "in")
    .reduce((s, c) => s + c.amount, 0);
  const moneyOut = cashflow
    .filter((c) => c.direction === "out")
    .reduce((s, c) => s + c.amount, 0);
  const net = moneyIn - moneyOut;

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this cashflow entry?")) return;
    await deleteCashflow(id);
    router.refresh();
  }

  return (
    <SectionCard title="Cash Flow">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <Stat
          label="Money In"
          value={fmtMoney(moneyIn, currency)}
          tone="good"
        />
        <Stat
          label="Money Out"
          value={fmtMoney(moneyOut, currency)}
          tone="bad"
        />
        <Stat
          label="Net"
          value={fmtMoney(net, currency)}
          tone={net >= 0 ? "good" : "bad"}
        />
      </div>

      {cashflow.length === 0 ? (
        <div style={{ fontSize: 12, color: C.dim, fontStyle: "italic" }}>
          No cashflow entries for this period.
        </div>
      ) : (
        <Table
          head={["Date", "In/Out", "Category", "Description", "Amount", ""]}
        >
          {cashflow.map((row) => (
            <tr key={row.id}>
              <Td>{row.txn_date}</Td>
              <Td color={row.direction === "in" ? C.green : C.red}>
                {row.direction === "in" ? "In" : "Out"}
              </Td>
              <Td>{row.category}</Td>
              <Td>{row.description ?? "—"}</Td>
              <Td right>{fmtMoney(row.amount, currency)}</Td>
              <Td right>
                {canWrite ? (
                  <GhostButton danger onClick={() => handleDelete(row.id)}>
                    Delete
                  </GhostButton>
                ) : null}
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {canWrite ? (
        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: `1px solid ${C.line}`,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: C.dim,
              marginBottom: 10,
            }}
          >
            ADD CASH FLOW ENTRY
          </div>
          <ActionForm
            submitLabel="Add Entry"
            onSubmit={() =>
              addCashflow({
                entity_id: entityId,
                txn_date: txnDate,
                direction,
                category,
                description: description || null,
                amount: n(amount),
              })
            }
            onDone={() => {
              setDescription("");
              setAmount("");
              router.refresh();
            }}
          >
            <FormGrid>
              <Field label="Date">
                <TextInput
                  type="date"
                  value={txnDate}
                  onChange={(e) => setTxnDate(e.target.value)}
                />
              </Field>
              <Field label="Direction">
                <Select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as "in" | "out")}
                >
                  <option value="in">In</option>
                  <option value="out">Out</option>
                </Select>
              </Field>
              <Field label="Category">
                <Select
                  value={category}
                  onChange={(e) =>
                    setCategory(
                      e.target.value as "operating" | "investing" | "financing",
                    )
                  }
                >
                  <option value="operating">Operating</option>
                  <option value="investing">Investing</option>
                  <option value="financing">Financing</option>
                </Select>
              </Field>
              <Field label="Description" width="100%">
                <TextInput
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </Field>
              <Field label="Amount">
                <NumInput
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
            </FormGrid>
          </ActionForm>
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          <ReadOnlyNote />
        </div>
      )}
    </SectionCard>
  );
}

/* ═══════════════════════ 5. Capex ═══════════════════════ */

function CapexSection({
  entityId,
  currency,
  period,
  canWrite,
  capexInPeriod,
  capexAll,
}: {
  entityId: string;
  currency: string;
  period: string;
  canWrite: boolean;
  capexInPeriod: CapexRow[];
  capexAll: CapexRow[];
}) {
  const router = useRouter();
  const [spendDate, setSpendDate] = useState(period);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [budgetLine, setBudgetLine] = useState("");
  const [amount, setAmount] = useState("");

  const spentThisPeriod = capexInPeriod.reduce((s, c) => s + c.amount, 0);
  const totalRecorded = capexAll.reduce((s, c) => s + c.amount, 0);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this capex item?")) return;
    await deleteCapex(id);
    router.refresh();
  }

  return (
    <SectionCard title="Capex">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <Stat
          label="Spent This Period"
          value={fmtMoney(spentThisPeriod, currency)}
        />
        <Stat
          label="Total Recorded"
          value={fmtMoney(totalRecorded, currency)}
        />
      </div>

      {capexAll.length === 0 ? (
        <div style={{ fontSize: 12, color: C.dim, fontStyle: "italic" }}>
          No capex items recorded.
        </div>
      ) : (
        <Table
          head={[
            "Date",
            "Category",
            "Description",
            "Budget Line",
            "Amount",
            "",
          ]}
        >
          {capexAll.map((row) => (
            <tr key={row.id}>
              <Td>{row.spend_date}</Td>
              <Td>{row.category ?? "—"}</Td>
              <Td>{row.description ?? "—"}</Td>
              <Td>{row.budget_line ?? "—"}</Td>
              <Td right>{fmtMoney(row.amount, currency)}</Td>
              <Td right>
                {canWrite ? (
                  <GhostButton danger onClick={() => handleDelete(row.id)}>
                    Delete
                  </GhostButton>
                ) : null}
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {canWrite ? (
        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: `1px solid ${C.line}`,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: C.dim,
              marginBottom: 10,
            }}
          >
            ADD CAPEX ITEM
          </div>
          <ActionForm
            submitLabel="Add Capex"
            onSubmit={() =>
              addCapex({
                entity_id: entityId,
                spend_date: spendDate,
                category: category || null,
                description: description || null,
                budget_line: budgetLine || null,
                amount: n(amount),
              })
            }
            onDone={() => {
              setCategory("");
              setDescription("");
              setBudgetLine("");
              setAmount("");
              router.refresh();
            }}
          >
            <FormGrid>
              <Field label="Date">
                <TextInput
                  type="date"
                  value={spendDate}
                  onChange={(e) => setSpendDate(e.target.value)}
                />
              </Field>
              <Field label="Category">
                <TextInput
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Equipment"
                />
              </Field>
              <Field label="Budget Line">
                <TextInput
                  value={budgetLine}
                  onChange={(e) => setBudgetLine(e.target.value)}
                  placeholder="Optional"
                />
              </Field>
              <Field label="Amount">
                <NumInput
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
              <Field label="Description" width="100%">
                <TextInput
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </Field>
            </FormGrid>
          </ActionForm>
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          <ReadOnlyNote />
        </div>
      )}
    </SectionCard>
  );
}

/* ═══════════════════════ 6/7. AR / AP (shared shape) ═══════════════════════ */

type InvoiceFormState = {
  counterparty_name: string;
  invoice_no: string;
  invoice_date: string;
  due_date: string;
  amount: string;
  amount_paid: string;
  status: "open" | "partial" | "paid" | "disputed";
};

function emptyInvoiceForm(period: string): InvoiceFormState {
  return {
    counterparty_name: "",
    invoice_no: "",
    invoice_date: period,
    due_date: period,
    amount: "",
    amount_paid: "0",
    status: "open",
  };
}

function statusColor(status: InvoiceRow["status"]): string {
  switch (status) {
    case "paid":
      return C.green;
    case "partial":
      return C.amber;
    case "disputed":
      return C.red;
    default:
      return C.dim;
  }
}

function AgingStrip({
  aging,
  currency,
}: {
  aging: AgingRow | null;
  currency: string;
}) {
  const boxes: { label: string; value: number }[] = [
    { label: "Current", value: aging?.current ?? 0 },
    { label: "1-30d", value: aging?.d30 ?? 0 },
    { label: "31-60d", value: aging?.d60 ?? 0 },
    { label: "61-90d", value: aging?.d90 ?? 0 },
    { label: "90d+", value: aging?.d90_plus ?? 0 },
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        gap: 8,
        marginBottom: 14,
      }}
    >
      {boxes.map((b) => (
        <div
          key={b.label}
          style={{
            background: C.panel2,
            border: `1px solid ${C.line}`,
            borderRadius: 10,
            padding: "10px 12px",
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: C.dim,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: 600,
            }}
          >
            {b.label}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>
            {fmtMoney(b.value, currency)}
          </div>
        </div>
      ))}
      <div
        style={{
          background: C.panel2,
          border: `1px solid ${C.gold}`,
          borderRadius: 10,
          padding: "10px 12px",
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: C.dim,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontWeight: 600,
          }}
        >
          Total Outstanding
        </div>
        <div
          style={{ fontSize: 15, fontWeight: 700, marginTop: 4, color: C.gold }}
        >
          {fmtMoney(aging?.total_outstanding ?? 0, currency)}
        </div>
      </div>
    </div>
  );
}

function InvoiceSection({
  entityId,
  currency,
  period,
  canWrite,
  kind,
  invoices,
  aging,
}: {
  entityId: string;
  currency: string;
  period: string;
  canWrite: boolean;
  kind: "ar" | "ap";
  invoices: InvoiceRow[];
  aging: AgingRow | null;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<InvoiceFormState>(() =>
    emptyInvoiceForm(period),
  );
  const counterpartyLabel = kind === "ar" ? "Customer" : "Supplier";

  function set<K extends keyof InvoiceFormState>(
    key: K,
    value: InvoiceFormState[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function startEdit(row: InvoiceRow) {
    setEditingId(row.id);
    setForm({
      counterparty_name: row.counterparty_name,
      invoice_no: row.invoice_no ?? "",
      invoice_date: row.invoice_date,
      due_date: row.due_date,
      amount: String(row.amount),
      amount_paid: String(row.amount_paid),
      status: row.status,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyInvoiceForm(period));
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this invoice?")) return;
    await deleteInvoice(kind, id);
    router.refresh();
  }

  return (
    <SectionCard
      title={kind === "ar" ? "Accounts Receivable" : "Accounts Payable"}
    >
      <AgingStrip aging={aging} currency={currency} />

      {invoices.length === 0 ? (
        <div style={{ fontSize: 12, color: C.dim, fontStyle: "italic" }}>
          No invoices recorded.
        </div>
      ) : (
        <Table
          head={[
            counterpartyLabel,
            "Invoice No",
            "Invoice Date",
            "Due Date",
            "Amount",
            "Paid",
            "Outstanding",
            "Status",
            "",
          ]}
        >
          {invoices.map((row) => (
            <tr key={row.id}>
              <Td>{row.counterparty_name}</Td>
              <Td>{row.invoice_no ?? "—"}</Td>
              <Td>{row.invoice_date}</Td>
              <Td>{row.due_date}</Td>
              <Td right>{fmtMoney(row.amount, currency)}</Td>
              <Td right>{fmtMoney(row.amount_paid, currency)}</Td>
              <Td right>{fmtMoney(row.amount - row.amount_paid, currency)}</Td>
              <Td color={statusColor(row.status)}>{row.status}</Td>
              <Td right>
                {canWrite ? (
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      justifyContent: "flex-end",
                    }}
                  >
                    <GhostButton onClick={() => startEdit(row)}>
                      Edit
                    </GhostButton>
                    <GhostButton danger onClick={() => handleDelete(row.id)}>
                      Delete
                    </GhostButton>
                  </div>
                ) : null}
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {canWrite ? (
        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: `1px solid ${C.line}`,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: C.dim }}>
              {editingId ? "EDIT INVOICE" : "ADD INVOICE"}
            </div>
            {editingId ? (
              <GhostButton onClick={cancelEdit}>Cancel edit</GhostButton>
            ) : null}
          </div>
          <ActionForm
            submitLabel={editingId ? "Save Changes" : "Add Invoice"}
            onSubmit={() =>
              upsertInvoice(kind, {
                id: editingId ?? undefined,
                entity_id: entityId,
                counterparty_name: form.counterparty_name,
                invoice_no: form.invoice_no || null,
                invoice_date: form.invoice_date,
                due_date: form.due_date,
                amount: n(form.amount),
                amount_paid: n(form.amount_paid),
                status: form.status,
              })
            }
            onDone={() => {
              cancelEdit();
              router.refresh();
            }}
          >
            <FormGrid>
              <Field label={counterpartyLabel}>
                <TextInput
                  value={form.counterparty_name}
                  onChange={(e) => set("counterparty_name", e.target.value)}
                />
              </Field>
              <Field label="Invoice No">
                <TextInput
                  value={form.invoice_no}
                  onChange={(e) => set("invoice_no", e.target.value)}
                />
              </Field>
              <Field label="Invoice Date">
                <TextInput
                  type="date"
                  value={form.invoice_date}
                  onChange={(e) => set("invoice_date", e.target.value)}
                />
              </Field>
              <Field label="Due Date">
                <TextInput
                  type="date"
                  value={form.due_date}
                  onChange={(e) => set("due_date", e.target.value)}
                />
              </Field>
            </FormGrid>
            <FormGrid>
              <Field label="Amount">
                <NumInput
                  value={form.amount}
                  onChange={(e) => set("amount", e.target.value)}
                />
              </Field>
              <Field label="Amount Paid">
                <NumInput
                  value={form.amount_paid}
                  onChange={(e) => set("amount_paid", e.target.value)}
                />
              </Field>
              <Field label="Status">
                <Select
                  value={form.status}
                  onChange={(e) =>
                    set("status", e.target.value as InvoiceFormState["status"])
                  }
                >
                  <option value="open">Open</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                  <option value="disputed">Disputed</option>
                </Select>
              </Field>
            </FormGrid>
          </ActionForm>
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          <ReadOnlyNote />
        </div>
      )}
    </SectionCard>
  );
}

/* ═══════════════════════ 8. Other debts ═══════════════════════ */

const DEBT_TYPE_LABELS: Record<OtherDebtRow["debt_type"], string> = {
  director_loan: "Director loan",
  shareholder_advance: "Shareholder advance",
  hire_purchase: "Hire purchase",
  other: "Other",
};

type DebtFormState = {
  lender: string;
  debt_type: OtherDebtRow["debt_type"];
  amount_outstanding: string;
  monthly_commitment: string;
  notes: string;
};

function emptyDebtForm(): DebtFormState {
  return {
    lender: "",
    debt_type: "director_loan",
    amount_outstanding: "",
    monthly_commitment: "",
    notes: "",
  };
}

function OtherDebtsSection({
  entityId,
  currency,
  canWrite,
  otherDebts,
}: {
  entityId: string;
  currency: string;
  canWrite: boolean;
  otherDebts: OtherDebtRow[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DebtFormState>(emptyDebtForm());

  function set<K extends keyof DebtFormState>(key: K, value: DebtFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function startEdit(row: OtherDebtRow) {
    setEditingId(row.id);
    setForm({
      lender: row.lender,
      debt_type: row.debt_type,
      amount_outstanding: String(row.amount_outstanding),
      monthly_commitment: String(row.monthly_commitment),
      notes: row.notes ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyDebtForm());
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this debt record?")) return;
    await deleteOtherDebt(id);
    router.refresh();
  }

  const totalOutstanding = otherDebts.reduce(
    (s, d) => s + d.amount_outstanding,
    0,
  );
  const totalMonthly = otherDebts.reduce((s, d) => s + d.monthly_commitment, 0);

  return (
    <SectionCard title="Other Debts">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <Stat
          label="Total Outstanding"
          value={fmtMoney(totalOutstanding, currency)}
        />
        <Stat
          label="Total Monthly Commitment"
          value={fmtMoney(totalMonthly, currency)}
        />
      </div>

      {otherDebts.length === 0 ? (
        <div style={{ fontSize: 12, color: C.dim, fontStyle: "italic" }}>
          No other debts recorded.
        </div>
      ) : (
        <Table
          head={[
            "Lender",
            "Type",
            "Outstanding",
            "Monthly Commitment",
            "Notes",
            "",
          ]}
        >
          {otherDebts.map((row) => (
            <tr key={row.id}>
              <Td>{row.lender}</Td>
              <Td>{DEBT_TYPE_LABELS[row.debt_type]}</Td>
              <Td right>{fmtMoney(row.amount_outstanding, currency)}</Td>
              <Td right>{fmtMoney(row.monthly_commitment, currency)}</Td>
              <Td>{row.notes ?? "—"}</Td>
              <Td right>
                {canWrite ? (
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      justifyContent: "flex-end",
                    }}
                  >
                    <GhostButton onClick={() => startEdit(row)}>
                      Edit
                    </GhostButton>
                    <GhostButton danger onClick={() => handleDelete(row.id)}>
                      Delete
                    </GhostButton>
                  </div>
                ) : null}
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {canWrite ? (
        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: `1px solid ${C.line}`,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: C.dim }}>
              {editingId ? "EDIT DEBT" : "ADD DEBT"}
            </div>
            {editingId ? (
              <GhostButton onClick={cancelEdit}>Cancel edit</GhostButton>
            ) : null}
          </div>
          <ActionForm
            submitLabel={editingId ? "Save Changes" : "Add Debt"}
            onSubmit={() =>
              upsertOtherDebt({
                id: editingId ?? undefined,
                entity_id: entityId,
                lender: form.lender,
                debt_type: form.debt_type,
                amount_outstanding: n(form.amount_outstanding),
                monthly_commitment: n(form.monthly_commitment),
                notes: form.notes || null,
              })
            }
            onDone={() => {
              cancelEdit();
              router.refresh();
            }}
          >
            <FormGrid>
              <Field label="Lender">
                <TextInput
                  value={form.lender}
                  onChange={(e) => set("lender", e.target.value)}
                />
              </Field>
              <Field label="Type">
                <Select
                  value={form.debt_type}
                  onChange={(e) =>
                    set(
                      "debt_type",
                      e.target.value as DebtFormState["debt_type"],
                    )
                  }
                >
                  <option value="director_loan">Director loan</option>
                  <option value="shareholder_advance">
                    Shareholder advance
                  </option>
                  <option value="hire_purchase">Hire purchase</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
              <Field label="Outstanding">
                <NumInput
                  value={form.amount_outstanding}
                  onChange={(e) => set("amount_outstanding", e.target.value)}
                />
              </Field>
              <Field label="Monthly Commitment">
                <NumInput
                  value={form.monthly_commitment}
                  onChange={(e) => set("monthly_commitment", e.target.value)}
                />
              </Field>
              <Field label="Notes" width="100%">
                <TextInput
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Optional notes"
                />
              </Field>
            </FormGrid>
          </ActionForm>
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          <ReadOnlyNote />
        </div>
      )}
    </SectionCard>
  );
}

/* ═══════════════════════ 9. Bank repayment table ═══════════════════════ */

type FacilityFormState = {
  bank: string;
  facility_type: string;
  original_amount: string;
  interest_rate: string;
  monthly_instalment: string;
  start_date: string;
  tenure_months: string;
  instalments_paid: string;
  outstanding_balance: string;
  next_payment_date: string;
  maturity_date: string;
};

function emptyFacilityForm(): FacilityFormState {
  return {
    bank: "",
    facility_type: "",
    original_amount: "",
    interest_rate: "",
    monthly_instalment: "",
    start_date: "",
    tenure_months: "",
    instalments_paid: "0",
    outstanding_balance: "",
    next_payment_date: "",
    maturity_date: "",
  };
}

function BankFacilitiesSection({
  entityId,
  currency,
  canWrite,
  facilities,
  otherDebtsMonthly,
}: {
  entityId: string;
  currency: string;
  canWrite: boolean;
  facilities: BankFacilityRow[];
  otherDebtsMonthly: number;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FacilityFormState>(emptyFacilityForm());

  function set<K extends keyof FacilityFormState>(
    key: K,
    value: FacilityFormState[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function startEdit(row: BankFacilityRow) {
    setEditingId(row.id);
    setForm({
      bank: row.bank,
      facility_type: row.facility_type ?? "",
      original_amount: String(row.original_amount),
      interest_rate:
        row.interest_rate !== null ? String(row.interest_rate) : "",
      monthly_instalment: String(row.monthly_instalment),
      start_date: row.start_date ?? "",
      tenure_months:
        row.tenure_months !== null ? String(row.tenure_months) : "",
      instalments_paid: String(row.instalments_paid),
      outstanding_balance: String(row.outstanding_balance),
      next_payment_date: row.next_payment_date ?? "",
      maturity_date: row.maturity_date ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyFacilityForm());
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this bank facility?")) return;
    await deleteBankFacility(id);
    router.refresh();
  }

  const totalMonthlyRepayment = facilities.reduce(
    (s, f) => s + f.monthly_instalment,
    0,
  );
  const totalDebtService = totalMonthlyRepayment + otherDebtsMonthly;

  return (
    <SectionCard title="Bank Repayment Table">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <Stat
          label="Total Monthly Repayment"
          value={fmtMoney(totalMonthlyRepayment, currency)}
        />
        <Stat
          label="Total Debt Service"
          value={fmtMoney(totalDebtService, currency)}
          sub={`${fmtMoney(totalDebtService, currency)}/month`}
        />
      </div>

      {facilities.length === 0 ? (
        <div style={{ fontSize: 12, color: C.dim, fontStyle: "italic" }}>
          No bank facilities recorded.
        </div>
      ) : (
        <Table
          head={[
            "Bank",
            "Facility",
            "Original Amount",
            "Rate %",
            "Monthly Instalment",
            "Progress",
            "Outstanding",
            "Next Payment",
            "Maturity",
            "",
          ]}
        >
          {facilities.map((row) => (
            <tr key={row.id}>
              <Td>{row.bank}</Td>
              <Td>{row.facility_type ?? "—"}</Td>
              <Td right>{fmtMoney(row.original_amount, currency)}</Td>
              <Td right>
                {row.interest_rate !== null ? fmtPct(row.interest_rate) : "—"}
              </Td>
              <Td right>{fmtMoney(row.monthly_instalment, currency)}</Td>
              <Td>
                {row.tenure_months
                  ? `${fmtNum(row.instalments_paid)} of ${fmtNum(row.tenure_months)} paid`
                  : "—"}
              </Td>
              <Td right>{fmtMoney(row.outstanding_balance, currency)}</Td>
              <Td>{row.next_payment_date ?? "—"}</Td>
              <Td>{row.maturity_date ?? "—"}</Td>
              <Td right>
                {canWrite ? (
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      justifyContent: "flex-end",
                    }}
                  >
                    <GhostButton onClick={() => startEdit(row)}>
                      Edit
                    </GhostButton>
                    <GhostButton danger onClick={() => handleDelete(row.id)}>
                      Delete
                    </GhostButton>
                  </div>
                ) : null}
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {canWrite ? (
        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: `1px solid ${C.line}`,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: C.dim }}>
              {editingId ? "EDIT FACILITY" : "ADD FACILITY"}
            </div>
            {editingId ? (
              <GhostButton onClick={cancelEdit}>Cancel edit</GhostButton>
            ) : null}
          </div>
          <ActionForm
            submitLabel={editingId ? "Save Changes" : "Add Facility"}
            onSubmit={() =>
              upsertBankFacility({
                id: editingId ?? undefined,
                entity_id: entityId,
                bank: form.bank,
                facility_type: form.facility_type || null,
                original_amount: n(form.original_amount),
                interest_rate: form.interest_rate
                  ? n(form.interest_rate)
                  : null,
                monthly_instalment: n(form.monthly_instalment),
                start_date: form.start_date || null,
                tenure_months: form.tenure_months
                  ? n(form.tenure_months)
                  : null,
                instalments_paid: n(form.instalments_paid),
                outstanding_balance: n(form.outstanding_balance),
                next_payment_date: form.next_payment_date || null,
                maturity_date: form.maturity_date || null,
              })
            }
            onDone={() => {
              cancelEdit();
              router.refresh();
            }}
          >
            <FormGrid>
              <Field label="Bank">
                <TextInput
                  value={form.bank}
                  onChange={(e) => set("bank", e.target.value)}
                />
              </Field>
              <Field label="Facility Type">
                <TextInput
                  value={form.facility_type}
                  onChange={(e) => set("facility_type", e.target.value)}
                  placeholder="e.g. Term Loan"
                />
              </Field>
              <Field label="Original Amount">
                <NumInput
                  value={form.original_amount}
                  onChange={(e) => set("original_amount", e.target.value)}
                />
              </Field>
              <Field label="Interest Rate %">
                <NumInput
                  value={form.interest_rate}
                  onChange={(e) => set("interest_rate", e.target.value)}
                />
              </Field>
              <Field label="Monthly Instalment">
                <NumInput
                  value={form.monthly_instalment}
                  onChange={(e) => set("monthly_instalment", e.target.value)}
                />
              </Field>
            </FormGrid>
            <FormGrid>
              <Field label="Start Date">
                <TextInput
                  type="date"
                  value={form.start_date}
                  onChange={(e) => set("start_date", e.target.value)}
                />
              </Field>
              <Field label="Tenure (months)">
                <NumInput
                  value={form.tenure_months}
                  onChange={(e) => set("tenure_months", e.target.value)}
                />
              </Field>
              <Field label="Instalments Paid">
                <NumInput
                  value={form.instalments_paid}
                  onChange={(e) => set("instalments_paid", e.target.value)}
                />
              </Field>
              <Field label="Outstanding Balance">
                <NumInput
                  value={form.outstanding_balance}
                  onChange={(e) => set("outstanding_balance", e.target.value)}
                />
              </Field>
            </FormGrid>
            <FormGrid>
              <Field label="Next Payment Date">
                <TextInput
                  type="date"
                  value={form.next_payment_date}
                  onChange={(e) => set("next_payment_date", e.target.value)}
                />
              </Field>
              <Field label="Maturity Date">
                <TextInput
                  type="date"
                  value={form.maturity_date}
                  onChange={(e) => set("maturity_date", e.target.value)}
                />
              </Field>
            </FormGrid>
          </ActionForm>
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          <ReadOnlyNote />
        </div>
      )}
    </SectionCard>
  );
}

/* ═══════════════════════ Main export ═══════════════════════ */

export function FinancialTab({
  entityId,
  currency,
  period,
  granularity,
  bsPeriod,
  bsGranularity,
  canWrite,
  pnl,
  pnlHistory,
  balanceSheet,
  cashflow,
  capexInPeriod,
  capexAll,
  arInvoices,
  apInvoices,
  arAging,
  apAging,
  otherDebts,
  facilities,
}: FinancialTabProps): ReactNode {
  const otherDebtsMonthly = otherDebts.reduce(
    (s, d) => s + d.monthly_commitment,
    0,
  );

  return (
    <div>
      <PnlSection
        entityId={entityId}
        currency={currency}
        period={period}
        granularity={granularity}
        canWrite={canWrite}
        pnl={pnl}
      />

      <PnlHistorySection
        pnlHistory={pnlHistory}
        currency={currency}
        granularity={granularity}
      />

      <BalanceSheetSection
        entityId={entityId}
        currency={currency}
        bsPeriod={bsPeriod}
        bsGranularity={bsGranularity}
        canWrite={canWrite}
        balanceSheet={balanceSheet}
      />

      <CashflowSection
        entityId={entityId}
        currency={currency}
        period={period}
        canWrite={canWrite}
        cashflow={cashflow}
      />

      <CapexSection
        entityId={entityId}
        currency={currency}
        period={period}
        canWrite={canWrite}
        capexInPeriod={capexInPeriod}
        capexAll={capexAll}
      />

      <InvoiceSection
        entityId={entityId}
        currency={currency}
        period={period}
        canWrite={canWrite}
        kind="ar"
        invoices={arInvoices}
        aging={arAging}
      />

      <InvoiceSection
        entityId={entityId}
        currency={currency}
        period={period}
        canWrite={canWrite}
        kind="ap"
        invoices={apInvoices}
        aging={apAging}
      />

      <OtherDebtsSection
        entityId={entityId}
        currency={currency}
        canWrite={canWrite}
        otherDebts={otherDebts}
      />

      <BankFacilitiesSection
        entityId={entityId}
        currency={currency}
        canWrite={canWrite}
        facilities={facilities}
        otherDebtsMonthly={otherDebtsMonthly}
      />
    </div>
  );
}
