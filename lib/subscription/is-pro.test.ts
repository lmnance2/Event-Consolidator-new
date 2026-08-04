import { describe, it, expect } from "vitest";
import { isPro } from "./is-pro";
import { SubscriptionStatus } from "@prisma/client";

describe("isPro", () => {
  it("returns true for ACTIVE subscription", () => {
    expect(isPro({ status: SubscriptionStatus.ACTIVE })).toBe(true);
  });

  it("returns false for FREE subscription", () => {
    expect(isPro({ status: SubscriptionStatus.FREE })).toBe(false);
  });

  it("returns false for PAST_DUE subscription (billing failed)", () => {
    expect(isPro({ status: SubscriptionStatus.PAST_DUE })).toBe(false);
  });

  it("returns false for CANCELED subscription", () => {
    expect(isPro({ status: SubscriptionStatus.CANCELED })).toBe(false);
  });

  it("returns false for null (no subscription row)", () => {
    expect(isPro(null)).toBe(false);
  });
});
