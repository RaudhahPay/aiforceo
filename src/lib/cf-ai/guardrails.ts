/**
 * CF ai — decision tiers + guardrail service (ported from AHMAD, adapted
 * to group level; see docs/ceo-dashboard/CF-AI-GROUP-PLAN.md).
 *
 * The constitutional core: the LLM proposes, this module — not the model —
 * decides the tier and the resolution. Pure functions, no I/O, fully
 * tested. Phase 2 runs CF ai in advisor mode permanently; the machinery
 * exists so Phases 3-4 inherit a proven gate instead of a rewrite.
 *
 * Golden rules kept from AHMAD:
 * 1. Human accountability always — Tier 2 needs approval, Tier 3 is
 *    human-only and NEVER executes.
 * 2. People and deen are Tier 3 regardless of proposed action type.
 * 3. Kill-switch halts ALL auto-execution.
 * 4. Advisor mode queues even clean Tier-1 actions for human approval.
 */

export type Tier = 1 | 2 | 3;

export type GroupDomain =
  | "finance"
  | "marketing"
  | "operations"
  | "strategy"
  | "people"
  | "deen";

/** Every action CF ai's cabinet is allowed to propose at group level. */
export type GroupActionType =
  // Tier 1 — routine, automatable once out of advisor mode
  | "red_action_create" // assign an owner + deadline to a red KPI
  | "report_request" // chase a venture for missing data
  | "brief_publish" // publish the daily/weekly brief
  // Tier 2 — needs Coach/board approval
  | "budget_reallocation"
  | "strategy_change"
  | "capex_recommendation"
  | "intercompany_transfer"
  // Tier 3 — human-only, advisory at most
  | "people_action"
  | "leadership_change"
  | "religious_matter"
  | "crisis_response";

const ACTION_TIER: Record<GroupActionType, Tier> = {
  red_action_create: 1,
  report_request: 1,
  brief_publish: 1,
  budget_reallocation: 2,
  strategy_change: 2,
  capex_recommendation: 2,
  intercompany_transfer: 2,
  people_action: 3,
  leadership_change: 3,
  religious_matter: 3,
  crisis_response: 3,
};

/** Domains that force Tier 3 regardless of action type. */
export const HUMAN_ONLY_DOMAINS: GroupDomain[] = ["people", "deen"];

export function resolveTier(
  actionType: GroupActionType,
  domain: GroupDomain,
): Tier {
  if (HUMAN_ONLY_DOMAINS.includes(domain)) return 3;
  return ACTION_TIER[actionType];
}

export type DeenRule = {
  rule: string;
  active: boolean;
  /** Lowercase keywords/phrases that flag a possible breach. */
  flags: string[];
};

export type CfGuardrailState = {
  killswitchArmed: boolean;
  /** Max spend a single decision may commit, in RM (ceo_ tables are RM). */
  spendCapRm: number;
  autoAllowlist: GroupActionType[];
  deenRules: DeenRule[];
  /** Advisor mode: auto-execution globally OFF. Phase 2 default: true. */
  advisorMode: boolean;
};

export type CfProposal = {
  actionType: GroupActionType;
  domain: GroupDomain;
  spendRm: number;
  /** Rationale + payload text, scanned against deen rules. */
  proposalText: string;
};

export type Resolution =
  | "auto_execute"
  | "queue_approval"
  | "advisory"
  | "blocked";

export type CfVerdict = {
  tier: Tier;
  resolution: Resolution;
  allow: boolean;
  reasons: string[];
  flaggedRules: string[];
};

/**
 * The single decision point. Check order matters: deen scan first (it can
 * block anything), then tier, then kill-switch, then money/category gates,
 * then advisor mode.
 */
export function evaluateGuardrails(
  input: CfProposal,
  state: CfGuardrailState,
): CfVerdict {
  const reasons: string[] = [];
  const tier = resolveTier(input.actionType, input.domain);

  const flaggedRules = scanDeenRules(input.proposalText, state.deenRules);
  if (flaggedRules.length > 0) {
    reasons.push(
      `Deen rule(s) flagged: ${flaggedRules.join(", ")} — blocked pending review`,
    );
    return { tier, resolution: "blocked", allow: false, reasons, flaggedRules };
  }

  if (tier === 3) {
    reasons.push("Tier 3 (human-only): advisory note only, never executes");
    return {
      tier,
      resolution: "advisory",
      allow: false,
      reasons,
      flaggedRules,
    };
  }

  if (state.killswitchArmed) {
    reasons.push("Kill-switch armed: all auto-execution halted");
    return {
      tier,
      resolution: "queue_approval",
      allow: false,
      reasons,
      flaggedRules,
    };
  }

  if (tier === 2) {
    reasons.push("Tier 2: requires human approval");
    return {
      tier,
      resolution: "queue_approval",
      allow: false,
      reasons,
      flaggedRules,
    };
  }

  if (input.spendRm > state.spendCapRm) {
    reasons.push(
      `Spend RM${input.spendRm} exceeds cap RM${state.spendCapRm} — escalated`,
    );
    return {
      tier,
      resolution: "queue_approval",
      allow: false,
      reasons,
      flaggedRules,
    };
  }

  if (!state.autoAllowlist.includes(input.actionType)) {
    reasons.push(
      `Action "${input.actionType}" not in auto-execute allowlist — queued`,
    );
    return {
      tier,
      resolution: "queue_approval",
      allow: false,
      reasons,
      flaggedRules,
    };
  }

  if (state.advisorMode) {
    reasons.push(
      "Advisor mode: guardrails pass but auto-execution is OFF — queued",
    );
    return {
      tier,
      resolution: "queue_approval",
      allow: false,
      reasons,
      flaggedRules,
    };
  }

  reasons.push("Tier 1: all guardrails passed — auto-execute");
  return {
    tier,
    resolution: "auto_execute",
    allow: true,
    reasons,
    flaggedRules,
  };
}

/**
 * Word-boundary keyword scan (AHMAD's Malay-safe matcher: "dilaporkan"
 * must not match "pork", "beribadah" must not match "riba").
 */
export function scanDeenRules(text: string, rules: DeenRule[]): string[] {
  const hits: string[] = [];
  for (const rule of rules) {
    if (!rule.active) continue;
    if (rule.flags.some((flag) => flag.length > 0 && flagMatches(text, flag))) {
      hits.push(rule.rule);
    }
  }
  return hits;
}

function flagMatches(text: string, flag: string): boolean {
  const escaped = flag.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escaped) return false;
  const re = new RegExp(
    `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
    "iu",
  );
  return re.test(text);
}

/** Phase 2 launch posture: advisor mode ON, empty allowlist, kill-switch off. */
export const PHASE2_DEFAULT_STATE: CfGuardrailState = {
  killswitchArmed: false,
  spendCapRm: 0,
  autoAllowlist: [],
  deenRules: [],
  advisorMode: true,
};
