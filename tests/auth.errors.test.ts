import { describe, it, expect } from "vitest";
import { AuthError } from "@/lib/auth/require";

describe("AuthError", () => {
  it("carries a typed error code", () => {
    const e1 = new AuthError("UNAUTHENTICATED", "Sign in required");
    const e2 = new AuthError("FORBIDDEN", "Not your workspace");
    const e3 = new AuthError("NOT_FOUND", "No workspace");

    expect(e1.code).toBe("UNAUTHENTICATED");
    expect(e2.code).toBe("FORBIDDEN");
    expect(e3.code).toBe("NOT_FOUND");

    expect(e1).toBeInstanceOf(Error);
    expect(e1.name).toBe("AuthError");
    expect(e1.message).toBe("Sign in required");
  });
});
