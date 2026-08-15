import { describe, expect, it } from "vitest";
import { getPlanEntitlements, hasEntitlement } from "./billing.js";

describe("billing entitlements", () => {
  it("returns server-defined limits for each plan", () => {
    expect(getPlanEntitlements("FREE")).toContainEqual({ key: "ai.tasks.monthly", limit: 25 });
    expect(getPlanEntitlements("PRO")).toContainEqual({ key: "ai.tasks.monthly", limit: 2000 });
  });

  it("denies unknown entitlements", () => {
    expect(hasEntitlement("PRO", "billing.unknown")).toBe(false);
  });

  it("enforces usage limits server-side", () => {
    expect(hasEntitlement("FREE", "ai.tasks.monthly", 24)).toBe(true);
    expect(hasEntitlement("FREE", "ai.tasks.monthly", 25)).toBe(false);
  });
});
