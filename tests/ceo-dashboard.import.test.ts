import { describe, it, expect } from "vitest";
import { parseAndValidate } from "@/lib/ceo-dashboard/import";

describe("CSV import — parseAndValidate", () => {
  it("parses a valid P&L CSV", () => {
    const csv = [
      "period_start,granularity,sales,opening_stock,purchases,closing_stock,opex_rental,opex_salaries,opex_utilities,opex_marketing,opex_admin,opex_other,interest,depreciation,tax,notes",
      "2026-06-01,monthly,120000,20000,45000,18000,8000,32000,3000,5000,2000,1000,2500,4000,0,June",
    ].join("\n");
    const { rows, errors } = parseAndValidate("pnl", csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      period_start: "2026-06-01",
      granularity: "monthly",
      sales: 120000,
      opening_stock: 20000,
    });
  });

  it("rejects ambiguous non-ISO dates with the row number", () => {
    const csv = [
      "txn_date,direction,category,description,amount",
      "2026-06-15,in,operating,sales,5000",
      "15/06/2026,out,operating,rent,8000",
    ].join("\n");
    const { rows, errors } = parseAndValidate("cashflow", csv);
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.row).toBe(2);
    expect(errors[0]?.error).toContain("YYYY-MM-DD");
  });

  it("fails fast on missing required columns", () => {
    const csv = ["period_start,sales", "2026-06-01,1000"].join("\n");
    const { rows, errors } = parseAndValidate("pnl", csv);
    expect(rows).toHaveLength(0);
    expect(errors[0]?.row).toBe(0);
    expect(errors[0]?.error).toContain("Missing columns");
    expect(errors[0]?.error).toContain("granularity");
  });

  it("normalises headers with spaces and capitals", () => {
    const csv = [
      "Counterparty Name,Invoice No,Invoice Date,Due Date,Amount,Amount Paid,Status",
      "Syarikat Ayam Segar,INV-001,2026-05-01,2026-05-31,15000,5000,partial",
    ].join("\n");
    const { rows, errors } = parseAndValidate("ap", csv);
    expect(errors).toHaveLength(0);
    expect(rows[0]).toMatchObject({
      counterparty_name: "Syarikat Ayam Segar",
      status: "partial",
      amount: 15000,
      amount_paid: 5000,
    });
  });

  it("rejects negative amounts and bad enums", () => {
    const csv = [
      "txn_date,direction,category,description,amount",
      "2026-06-15,sideways,operating,weird,5000",
      "2026-06-16,in,operating,negative,-50",
    ].join("\n");
    const { rows, errors } = parseAndValidate("cashflow", csv);
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(2);
  });

  it("defaults optional invoice fields", () => {
    const csv = [
      "counterparty_name,invoice_date,due_date,amount",
      "Tenaga Nasional,2026-06-01,2026-06-30,900",
    ].join("\n");
    const { rows, errors } = parseAndValidate("ar", csv);
    expect(errors).toHaveLength(0);
    expect(rows[0]).toMatchObject({
      amount_paid: 0,
      status: "open",
    });
  });
});
