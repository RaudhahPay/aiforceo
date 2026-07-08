import { describe, it, expect } from "vitest";
import {
  evaluateGuardrails,
  resolveTier,
  scanDeenRules,
  PHASE2_DEFAULT_STATE,
  type CfGuardrailState,
} from "@/lib/cf-ai/guardrails";
import {
  kiraFindings,
  jualFindings,
  urusFindings,
  sortFindings,
} from "@/lib/cf-ai/analysts";
import { fallbackNarrative } from "@/lib/cf-ai/brief";
import type { GroupBrief } from "@/lib/cf-ai/brief";

const openState: CfGuardrailState = {
  killswitchArmed: false,
  spendCapRm: 10_000,
  autoAllowlist: ["red_action_create", "report_request", "brief_publish"],
  deenRules: [],
  advisorMode: false,
};

describe("CF ai guardrails — tiers", () => {
  it("people domain forces Tier 3 regardless of action type", () => {
    expect(resolveTier("red_action_create", "people")).toBe(3);
    expect(resolveTier("budget_reallocation", "deen")).toBe(3);
  });

  it("Tier 3 never executes, even with everything open", () => {
    const v = evaluateGuardrails(
      {
        actionType: "people_action",
        domain: "people",
        spendRm: 0,
        proposalText: "restructure the team",
      },
      openState,
    );
    expect(v.resolution).toBe("advisory");
    expect(v.allow).toBe(false);
  });

  it("Tier 2 always queues for approval", () => {
    const v = evaluateGuardrails(
      {
        actionType: "capex_recommendation",
        domain: "finance",
        spendRm: 100,
        proposalText: "buy a fryer",
      },
      openState,
    );
    expect(v.resolution).toBe("queue_approval");
    expect(v.allow).toBe(false);
  });
});

describe("CF ai guardrails — gates", () => {
  it("kill-switch halts everything automatable", () => {
    const v = evaluateGuardrails(
      {
        actionType: "brief_publish",
        domain: "strategy",
        spendRm: 0,
        proposalText: "publish brief",
      },
      { ...openState, killswitchArmed: true },
    );
    expect(v.resolution).toBe("queue_approval");
    expect(v.allow).toBe(false);
  });

  it("spend cap escalates", () => {
    const v = evaluateGuardrails(
      {
        actionType: "red_action_create",
        domain: "finance",
        spendRm: 50_000,
        proposalText: "assign action",
      },
      openState,
    );
    expect(v.resolution).toBe("queue_approval");
    expect(v.reasons.join(" ")).toContain("exceeds cap");
  });

  it("allowlist gates auto-exec", () => {
    const v = evaluateGuardrails(
      {
        actionType: "report_request",
        domain: "operations",
        spendRm: 0,
        proposalText: "chase report",
      },
      { ...openState, autoAllowlist: [] },
    );
    expect(v.resolution).toBe("queue_approval");
  });

  it("advisor mode queues even a clean Tier 1", () => {
    const v = evaluateGuardrails(
      {
        actionType: "brief_publish",
        domain: "strategy",
        spendRm: 0,
        proposalText: "publish",
      },
      { ...openState, advisorMode: true },
    );
    expect(v.resolution).toBe("queue_approval");
    expect(v.reasons.join(" ")).toContain("Advisor mode");
  });

  it("clean Tier 1 auto-executes only outside advisor mode", () => {
    const v = evaluateGuardrails(
      {
        actionType: "brief_publish",
        domain: "strategy",
        spendRm: 0,
        proposalText: "publish",
      },
      openState,
    );
    expect(v.resolution).toBe("auto_execute");
    expect(v.allow).toBe(true);
  });

  it("Phase 2 default state can never auto-execute", () => {
    const v = evaluateGuardrails(
      {
        actionType: "brief_publish",
        domain: "strategy",
        spendRm: 0,
        proposalText: "publish",
      },
      PHASE2_DEFAULT_STATE,
    );
    expect(v.allow).toBe(false);
  });
});

describe("CF ai guardrails — deen scan", () => {
  const rules = [
    {
      rule: "no-riba",
      active: true,
      flags: ["riba", "interest-based lending"],
    },
  ];

  it("blocks on a whole-word match", () => {
    const v = evaluateGuardrails(
      {
        actionType: "budget_reallocation",
        domain: "finance",
        spendRm: 0,
        proposalText: "fund it through riba financing",
      },
      { ...openState, deenRules: rules },
    );
    expect(v.resolution).toBe("blocked");
    expect(v.flaggedRules).toContain("no-riba");
  });

  it("does not false-positive on Malay substrings", () => {
    expect(
      scanDeenRules("kes itu dilaporkan semalam", [
        { rule: "no-pork", active: true, flags: ["pork"] },
      ]),
    ).toHaveLength(0);
    expect(scanDeenRules("mereka beribadah setiap hari", rules)).toHaveLength(
      0,
    );
  });
});

describe("CF ai analysts", () => {
  it("KIRA flags negative EBITDA and thin runway", () => {
    const f = kiraFindings({
      pnl: {
        sales: 100_000,
        gross_profit: 40_000,
        ebitda: -5_000,
        interest: 2_000,
      },
      bs: { cash_bank: 20_000, is_balanced: true, override_unbalanced: false },
      cashNet30d: -10_000,
      arAging: null,
      debtMonthly: 0,
    });
    const areas = f.map((x) => `${x.severity}:${x.area}`);
    expect(areas).toContain("red:pnl");
    expect(areas).toContain("red:cash"); // 2 months runway
  });

  it("KIRA flags debt service exceeding EBITDA", () => {
    const f = kiraFindings({
      pnl: {
        sales: 100_000,
        gross_profit: 60_000,
        ebitda: 15_000,
        interest: 0,
      },
      bs: null,
      cashNet30d: null,
      arAging: null,
      debtMonthly: 20_000,
    });
    expect(f.some((x) => x.severity === "red" && x.area === "debt")).toBe(true);
  });

  it("KIRA reports missing P&L as a reporting finding, not a red", () => {
    const f = kiraFindings({
      pnl: null,
      bs: null,
      cashNet30d: null,
      arAging: null,
      debtMonthly: 0,
    });
    expect(f).toHaveLength(1);
    expect(f[0]?.severity).toBe("info");
    expect(f[0]?.area).toBe("reporting");
  });

  it("JUAL enforces the minimum-10 strategy rule as red", () => {
    const f = jualFindings({
      funnel: { total_reach: 1000, cr1: 0.1, cr2: 0.2, sales: 5000 },
      activeStrategies: 4,
      channelsBurning: ["tiktok"],
    });
    expect(f.some((x) => x.severity === "red" && x.area === "10x10")).toBe(
      true,
    );
    expect(f.some((x) => x.area === "channels")).toBe(true);
  });

  it("URUS flags escalated red actions as red", () => {
    const f = urusFindings({
      enps: 40,
      nps: 60,
      unresolved48h: 0,
      openRedActions: 2,
      escalatedRedActions: 1,
    });
    expect(
      f.some((x) => x.severity === "red" && x.area === "accountability"),
    ).toBe(true);
  });

  it("sortFindings puts reds first", () => {
    const sorted = sortFindings([
      { analyst: "URUS", severity: "info", area: "a", message: "m" },
      { analyst: "KIRA", severity: "red", area: "b", message: "m" },
      { analyst: "JUAL", severity: "yellow", area: "c", message: "m" },
    ]);
    expect(sorted.map((f) => f.severity)).toEqual(["red", "yellow", "info"]);
  });
});

describe("CF ai brief narrative fallback", () => {
  it("summarises pulse, cash, and priorities without an LLM", () => {
    const brief: GroupBrief = {
      generatedAt: "2026-07-08T00:00:00.000Z",
      orgId: "org",
      ventures: [],
      groupPulse: { score: 84.5, badge: "yellow" },
      cashPositionRm: 123_456,
      topPriorities: ["Ahmads HotChicken: EBITDA is negative"],
      narrative: null,
    };
    const text = fallbackNarrative(brief);
    expect(text).toContain("YELLOW");
    expect(text).toContain("84.5");
    expect(text).toContain("123,456");
    expect(text).toContain("EBITDA is negative");
  });
});
