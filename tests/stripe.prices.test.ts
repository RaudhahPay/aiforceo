import { describe, it, expect } from "vitest";
import { PRICE_IDS } from "@/lib/stripe";

describe("Stripe price registry", () => {
  it("includes all three plans", () => {
    expect(Object.keys(PRICE_IDS).sort()).toEqual(["growth", "scale", "starter"]);
  });

  it("token quotas escalate with the plan", () => {
    expect(PRICE_IDS.starter.tokens).toBeLessThan(PRICE_IDS.growth.tokens);
    expect(PRICE_IDS.growth.tokens).toBeLessThan(PRICE_IDS.scale.tokens);
  });
});
