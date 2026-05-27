import { describe, it, expect } from "vitest";
import { buildSystemPrompt, AGENTS } from "@/lib/prompts";

describe("prompts", () => {
  it("registers all 6 agents with distinct gradients", () => {
    const roles = Object.keys(AGENTS);
    expect(roles.sort()).toEqual(["aria", "ceo", "cfo", "cmo", "coo", "cto"]);
    const gradients = new Set(
      Object.values(AGENTS).map((a) => a.gradient.join("|")),
    );
    expect(gradients.size).toBe(6);
  });

  it("hydrates business profile + brand voice into the system prompt", () => {
    const out = buildSystemPrompt("cmo", {
      businessName: "DRE Coffee",
      industry: "F&B — Café / Restaurant",
      challenges: ["Marketing & lead-gen", "Cash flow visibility"],
      goals90d: "Open second outlet",
      brandVoiceSummary: "Warm, cheeky, anti-corporate.",
      toneAttributes: ["warm", "cheeky"],
      wordsToUse: ["pour-over", "neighborhood"],
      wordsToAvoid: ["synergy"],
    });
    expect(out).toContain("DRE Coffee");
    expect(out).toContain("F&B");
    expect(out).toContain("Marketing & lead-gen, Cash flow visibility");
    expect(out).toContain("Open second outlet");
    expect(out).toContain("Warm, cheeky, anti-corporate.");
    expect(out).toContain("pour-over, neighborhood");
    expect(out).toContain("synergy");
    // Persona section
    expect(out).toContain("Maya");
    expect(out).toContain("Chief Marketing Officer");
  });

  it("falls back gracefully when no voice has been captured", () => {
    const out = buildSystemPrompt("cfo", { businessName: "Acme" });
    expect(out).toContain("Acme");
    expect(out).toContain("no brand voice captured yet");
    // Should not throw, should not include 'undefined'
    expect(out).not.toContain("undefined");
  });

  it("selects the right persona per role", () => {
    expect(buildSystemPrompt("coo", {})).toContain("Owen");
    expect(buildSystemPrompt("ceo", {})).toContain("Eden");
  });
});
