import { describe, it, expect } from "vitest";
import { remainingFromLedger, TIER_MONTHLY_TOKENS } from "@/lib/credits";

describe("credits", () => {
  it("returns 0 for an empty ledger", () => {
    expect(remainingFromLedger([])).toBe(0);
  });

  it("sums grants and consumption correctly", () => {
    const rows = [
      { delta_tokens: 100_000 },   // monthly grant
      { delta_tokens: -8_000 },    // chat
      { delta_tokens: -4_200 },    // chat
      { delta_tokens: 200_000 }    // top-up
    ];
    expect(remainingFromLedger(rows)).toBe(287_800);
  });

  it("can go negative if writes raced past the cap (audit trail)", () => {
    expect(remainingFromLedger([{ delta_tokens: 5_000 }, { delta_tokens: -10_000 }])).toBe(-5_000);
  });

  it("has tier quotas in ascending order", () => {
    expect(TIER_MONTHLY_TOKENS.trial).toBeLessThan(TIER_MONTHLY_TOKENS.starter!);
    expect(TIER_MONTHLY_TOKENS.starter).toBeLessThan(TIER_MONTHLY_TOKENS.growth!);
    expect(TIER_MONTHLY_TOKENS.growth).toBeLessThan(TIER_MONTHLY_TOKENS.scale!);
  });
});
