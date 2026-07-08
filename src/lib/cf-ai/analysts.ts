/**
 * CF ai — the cabinet analysts (deterministic core).
 *
 * KIRA (finance), JUAL (sales & marketing), URUS (operations) read an
 * entity's dashboard snapshot and emit findings. Pure functions over
 * loaded data — no I/O, no LLM — so every rule is unit-testable and the
 * cabinet runs identically with or without an API key (AHMAD's fallback
 * philosophy). The LLM, when present, only narrates on top.
 *
 * Missing data is itself a finding: a venture that stops reporting is a
 * governance problem, not a blank space.
 */

export type Analyst = "KIRA" | "JUAL" | "URUS";
export type Severity = "red" | "yellow" | "info";

export type Finding = {
  analyst: Analyst;
  severity: Severity;
  area: string;
  message: string;
};

const SEVERITY_ORDER: Record<Severity, number> = { red: 0, yellow: 1, info: 2 };

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
}

/* ═══════════════ KIRA — finance ═══════════════ */

export type FinanceSnapshot = {
  /** Latest monthly P&L, if reported. */
  pnl: {
    sales: number;
    gross_profit: number;
    ebitda: number;
    interest: number;
  } | null;
  /** Latest balance sheet, if reported. */
  bs: {
    cash_bank: number;
    is_balanced: boolean;
    override_unbalanced: boolean;
  } | null;
  /** Net operating cash movement over the trailing 30 days, null = no rows. */
  cashNet30d: number | null;
  arAging: { d90_plus: number; total_outstanding: number } | null;
  /** Total monthly debt commitment (facilities + other debts). */
  debtMonthly: number;
};

export function kiraFindings(s: FinanceSnapshot): Finding[] {
  const f: Finding[] = [];
  const add = (severity: Severity, area: string, message: string) =>
    f.push({ analyst: "KIRA", severity, area, message });

  if (!s.pnl) {
    add("info", "reporting", "No P&L reported for the latest month");
  } else {
    if (s.pnl.gross_profit < 0) {
      add(
        "red",
        "pnl",
        `Gross profit is negative (RM${s.pnl.gross_profit.toLocaleString()}) — selling below cost`,
      );
    }
    if (s.pnl.ebitda < 0) {
      add(
        "red",
        "pnl",
        `EBITDA is negative (RM${s.pnl.ebitda.toLocaleString()}) — operations are burning cash`,
      );
    } else if (s.pnl.sales > 0 && s.pnl.ebitda < 0.1 * s.pnl.sales) {
      add(
        "yellow",
        "pnl",
        `EBITDA margin is thin (${((s.pnl.ebitda / s.pnl.sales) * 100).toFixed(1)}% of sales)`,
      );
    }
    if (s.pnl.ebitda > 0 && s.debtMonthly > s.pnl.ebitda) {
      add(
        "red",
        "debt",
        `Monthly debt service RM${s.debtMonthly.toLocaleString()} exceeds EBITDA — debt is eating the business`,
      );
    }
  }

  if (s.bs) {
    if (s.bs.override_unbalanced) {
      add(
        "yellow",
        "balance-sheet",
        "Balance sheet saved with an unbalanced override — needs reconciliation",
      );
    }
    if (s.cashNet30d !== null && s.cashNet30d < 0 && s.bs.cash_bank > 0) {
      const runwayMonths = s.bs.cash_bank / Math.abs(s.cashNet30d);
      if (runwayMonths < 3) {
        add(
          "red",
          "cash",
          `Cash runway ~${runwayMonths.toFixed(1)} months at the current burn`,
        );
      } else if (runwayMonths < 6) {
        add(
          "yellow",
          "cash",
          `Cash runway ~${runwayMonths.toFixed(1)} months — below the 6-month floor`,
        );
      }
    }
  }

  if (s.arAging && s.arAging.total_outstanding > 0) {
    const overduePct = s.arAging.d90_plus / s.arAging.total_outstanding;
    if (overduePct > 0.4) {
      add(
        "red",
        "receivables",
        `${(overduePct * 100).toFixed(0)}% of receivables are 90+ days overdue`,
      );
    } else if (overduePct > 0.2) {
      add(
        "yellow",
        "receivables",
        `${(overduePct * 100).toFixed(0)}% of receivables are 90+ days overdue`,
      );
    }
  }

  return f;
}

/* ═══════════════ JUAL — sales & marketing ═══════════════ */

export type GrowthSnapshot = {
  funnel: {
    total_reach: number;
    cr1: number;
    cr2: number;
    sales: number;
  } | null;
  activeStrategies: number;
  /** Channels with spend this period but zero leads. */
  channelsBurning: string[];
};

export function jualFindings(s: GrowthSnapshot): Finding[] {
  const f: Finding[] = [];
  const add = (severity: Severity, area: string, message: string) =>
    f.push({ analyst: "JUAL", severity, area, message });

  if (s.activeStrategies < 10) {
    add(
      "red",
      "10x10",
      `Only ${s.activeStrategies} active marketing strategies — the minimum is 10`,
    );
  }

  if (!s.funnel) {
    add("info", "reporting", "No funnel reported for the latest period");
  } else if (s.funnel.total_reach > 0) {
    if (s.funnel.cr1 === 0) {
      add(
        "yellow",
        "funnel",
        "Reach exists but prospect conversion (CR1) is zero — top of funnel is leaking",
      );
    } else if (s.funnel.cr2 === 0) {
      add(
        "yellow",
        "funnel",
        "Prospects exist but customer conversion (CR2) is zero — closing is broken",
      );
    }
  }

  for (const channel of s.channelsBurning) {
    add(
      "yellow",
      "channels",
      `${channel} has spend this period but zero leads`,
    );
  }

  return f;
}

/* ═══════════════ URUS — operations ═══════════════ */

export type OpsSnapshot = {
  enps: number | null;
  nps: number | null;
  unresolved48h: number;
  openRedActions: number;
  escalatedRedActions: number;
};

export function urusFindings(s: OpsSnapshot): Finding[] {
  const f: Finding[] = [];
  const add = (severity: Severity, area: string, message: string) =>
    f.push({ analyst: "URUS", severity, area, message });

  if (s.enps === null) {
    add("info", "reporting", "No staff happiness reported this period");
  } else if (s.enps < 0) {
    add("red", "staff", `Staff eNPS is ${s.enps} — the team is unhappy`);
  } else if (s.enps < 30) {
    add("yellow", "staff", `Staff eNPS is ${s.enps} — below the 30 target`);
  }

  if (s.nps === null) {
    add("info", "reporting", "No customer happiness reported this period");
  } else if (s.nps < 0) {
    add(
      "red",
      "customer",
      `Customer NPS is ${s.nps} — customers are detractors`,
    );
  } else if (s.nps < 50) {
    add("yellow", "customer", `Customer NPS is ${s.nps} — below the 50 target`);
  }

  if (s.unresolved48h > 0) {
    add(
      "yellow",
      "customer",
      `${s.unresolved48h} complaint(s) unresolved past 48 hours`,
    );
  }

  if (s.escalatedRedActions > 0) {
    add(
      "red",
      "accountability",
      `${s.escalatedRedActions} red action(s) escalated — untouched for 48+ hours`,
    );
  } else if (s.openRedActions > 0) {
    add(
      "info",
      "accountability",
      `${s.openRedActions} red action(s) open and within their deadline`,
    );
  }

  return f;
}
