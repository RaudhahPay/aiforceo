import { describe, it, expect } from "vitest";
import {
  computePnl,
  computeBalanceSheet,
  computeFunnel,
  trafficLight,
  ventureHealth,
  strategyCountStatus,
  isEscalated,
  MIN_ACTIVE_STRATEGIES,
} from "@/lib/ceo-dashboard/formulas";

describe("computePnl", () => {
  const base = {
    sales: 100_000,
    openingStock: 20_000,
    purchases: 35_000,
    closingStock: 25_000,
    opexRental: 8_000,
    opexSalaries: 22_000,
    opexUtilities: 3_000,
    opexMarketing: 5_000,
    opexAdmin: 2_000,
    opexOther: 1_000,
    interest: 1_500,
    depreciation: 2_500,
    tax: 3_000,
  };

  it("computes COGS = opening + purchases − closing", () => {
    expect(computePnl(base).cogs).toBe(30_000);
  });

  it("computes GP and GP%", () => {
    const r = computePnl(base);
    expect(r.grossProfit).toBe(70_000);
    expect(r.gpPct).toBeCloseTo(0.7);
  });

  it("computes EBITDA = GP − total OPEX", () => {
    const r = computePnl(base);
    expect(r.totalOpex).toBe(41_000);
    expect(r.ebitda).toBe(29_000);
  });

  it("management view: EBIT = EBITDA − interest", () => {
    expect(computePnl(base).ebitMgmt).toBe(27_500);
  });

  it("statutory view: EBIT = EBITDA − depreciation, PBT = EBIT − interest, PAT = PBT − tax", () => {
    const r = computePnl(base);
    expect(r.ebitStat).toBe(26_500);
    expect(r.pbt).toBe(25_000);
    expect(r.pat).toBe(22_000);
  });

  it("management and statutory views reconcile: mgmt EBIT − depreciation = PBT", () => {
    const r = computePnl(base);
    expect(r.ebitMgmt - base.depreciation).toBe(r.pbt);
  });

  it("zero sales does not divide by zero", () => {
    const r = computePnl({ ...base, sales: 0 });
    expect(r.gpPct).toBe(0);
    expect(r.grossProfit).toBe(-30_000);
  });

  it("handles a loss-making month", () => {
    const r = computePnl({ ...base, sales: 50_000 });
    expect(r.ebitda).toBe(-21_000);
    expect(r.pat).toBe(-28_000);
  });
});

describe("computeBalanceSheet", () => {
  const balanced = {
    fixedAssets: 500_000,
    cashBank: 150_000,
    accountsReceivable: 80_000,
    stockValue: 40_000,
    depositsPrepayments: 10_000,
    accountsPayable: 90_000,
    bankLoansCurrent: 60_000,
    bankLoansLongterm: 250_000,
    otherDebtsTotal: 30_000,
    paidUpCapital: 200_000,
    retainedEarnings: 100_000,
    currentYearPl: 50_000,
  };

  it("computes totals", () => {
    const r = computeBalanceSheet(balanced);
    expect(r.totalAssets).toBe(780_000);
    expect(r.totalLiabilities).toBe(430_000);
    expect(r.totalEquity).toBe(350_000);
  });

  it("flags a balanced sheet", () => {
    const r = computeBalanceSheet(balanced);
    expect(r.isBalanced).toBe(true);
    expect(r.imbalance).toBe(0);
  });

  it("flags an unbalanced sheet and reports the gap", () => {
    const r = computeBalanceSheet({ ...balanced, cashBank: 150_100 });
    expect(r.isBalanced).toBe(false);
    expect(r.imbalance).toBeCloseTo(100);
  });

  it("tolerates sub-sen rounding noise", () => {
    const r = computeBalanceSheet({ ...balanced, cashBank: 150_000.005 });
    expect(r.isBalanced).toBe(true);
  });
});

describe("computeFunnel", () => {
  const input = {
    totalReach: 100_000,
    cr1: 0.05,
    cr2: 0.2,
    avgSale: 45,
    txnPerCustomer: 2,
    gpPct: 0.65,
    opexRef: 40_000,
  };

  it("chains reach → prospects → customers → sales → GP → EBITDA", () => {
    const r = computeFunnel(input);
    expect(r.prospects).toBe(5_000);
    expect(r.customers).toBe(1_000);
    expect(r.sales).toBe(90_000);
    expect(r.grossProfit).toBeCloseTo(58_500);
    expect(r.ebitda).toBeCloseTo(18_500);
  });

  it("what-if: doubling cr2 doubles sales", () => {
    const base = computeFunnel(input);
    const whatIf = computeFunnel({ ...input, cr2: 0.4 });
    expect(whatIf.sales).toBeCloseTo(base.sales * 2);
  });

  it("zero reach yields zeros and negative EBITDA equal to opex", () => {
    const r = computeFunnel({ ...input, totalReach: 0 });
    expect(r.sales).toBe(0);
    expect(r.ebitda).toBe(-40_000);
  });
});

describe("trafficLight", () => {
  it("green at or above 100% for higher_better", () => {
    expect(trafficLight(100, 100).status).toBe("green");
    expect(trafficLight(112, 100).status).toBe("green");
  });

  it("yellow between 70% and 100%", () => {
    const r = trafficLight(93, 100);
    expect(r.attainmentPct).toBeCloseTo(93);
    expect(r.status).toBe("yellow");
  });

  it("red below 70%", () => {
    expect(trafficLight(64, 100).status).toBe("red");
  });

  it("inverts for lower_better (food cost 34.2 vs 30 target = red at ~87.7%)", () => {
    const r = trafficLight(34.2, 30, "lower_better", 100, 90);
    expect(r.attainmentPct).toBeCloseTo(87.72, 1);
    expect(r.status).toBe("red");
  });

  it("lower_better beats target = green", () => {
    expect(trafficLight(28, 30, "lower_better").status).toBe("green");
  });

  it("respects custom thresholds", () => {
    expect(trafficLight(93, 100, "higher_better", 95, 85).status).toBe(
      "yellow",
    );
    expect(trafficLight(93, 100, "higher_better", 90, 70).status).toBe("green");
  });

  it("never divides by zero", () => {
    expect(trafficLight(50, 0, "higher_better").status).toBe("green");
    expect(trafficLight(0, 30, "lower_better").status).toBe("green");
    expect(trafficLight(-5, 0, "higher_better").status).toBe("red");
  });
});

describe("ventureHealth", () => {
  const green = {
    attainmentPct: 105,
    weight: 1,
    status: "green" as const,
    isCritical: false,
  };
  const yellow = {
    attainmentPct: 80,
    weight: 1,
    status: "yellow" as const,
    isCritical: false,
  };
  const red = {
    attainmentPct: 50,
    weight: 1,
    status: "red" as const,
    isCritical: false,
  };
  const redCritical = { ...red, isCritical: true };

  it("weighted average drives the score", () => {
    const r = ventureHealth([green, yellow]);
    expect(r.score).toBeCloseTo(92.5);
    expect(r.badge).toBe("green");
  });

  it("weights matter", () => {
    const r = ventureHealth([
      { ...green, weight: 3 },
      { ...red, weight: 1 },
    ]);
    expect(r.score).toBeCloseTo((105 * 3 + 50) / 4);
  });

  it("any red critical KPI forces a red badge even with a green score", () => {
    const r = ventureHealth([green, green, green, redCritical]);
    expect(r.badge).toBe("red");
  });

  it("non-critical reds lower the score but do not force the badge", () => {
    const r = ventureHealth([green, green, green, red]);
    expect(r.badge).not.toBe("red");
    expect(r.redCount).toBe(1);
  });

  it("caps single-KPI attainment at 120 so a blowout cannot mask weakness", () => {
    const blowout = {
      attainmentPct: 500,
      weight: 1,
      status: "green" as const,
      isCritical: false,
    };
    const r = ventureHealth([blowout, red]);
    expect(r.score).toBeCloseTo((120 + 50) / 2);
  });

  it("empty KPI set is a yellow (no data ≠ healthy)", () => {
    expect(ventureHealth([]).badge).toBe("yellow");
  });
});

describe("strategyCountStatus", () => {
  it("red below the minimum of 10", () => {
    expect(MIN_ACTIVE_STRATEGIES).toBe(10);
    expect(strategyCountStatus(7)).toBe("red");
    expect(strategyCountStatus(9)).toBe("red");
  });
  it("green at 10 or more", () => {
    expect(strategyCountStatus(10)).toBe("green");
    expect(strategyCountStatus(14)).toBe("green");
  });
});

describe("isEscalated", () => {
  const opened = new Date("2026-07-06T08:00:00+08:00");

  it("escalates past 48 hours without a status change", () => {
    expect(
      isEscalated(opened, new Date("2026-07-08T08:00:00+08:00"), false),
    ).toBe(true);
    expect(
      isEscalated(opened, new Date("2026-07-08T22:00:00+08:00"), false),
    ).toBe(true);
  });

  it("does not escalate before 48 hours", () => {
    expect(
      isEscalated(opened, new Date("2026-07-08T07:59:00+08:00"), false),
    ).toBe(false);
  });

  it("a status change stops the clock", () => {
    expect(
      isEscalated(opened, new Date("2026-07-09T08:00:00+08:00"), true),
    ).toBe(false);
  });
});
