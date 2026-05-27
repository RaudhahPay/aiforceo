import { describe, it, expect } from "vitest";

describe("CI smoke", () => {
  it("runs in CI", () => {
    expect(1 + 1).toBe(2);
  });
});
