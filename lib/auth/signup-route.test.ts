import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  prismaFindUnique: vi.fn(),
  prismaTransaction: vi.fn(),
  hashPassword: vi.fn(),
  geocodeZip: vi.fn(),
  emailIpLimit: vi.fn(),
  ipLimit: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    user: {
      findUnique: mocks.prismaFindUnique,
      create: vi.fn(),
    },
    userPreferences: { create: vi.fn() },
    subscription: { create: vi.fn() },
    $transaction: mocks.prismaTransaction,
  },
}));

vi.mock("@/lib/auth/password", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/auth/password")>();
  return {
    ...actual,
    hashPassword: mocks.hashPassword,
  };
});

vi.mock("@/lib/geo/geocode", () => ({
  geocodeZip: mocks.geocodeZip,
}));

vi.mock("@/lib/auth/rate-limit", () => ({
  createSignupRateLimiter: () => ({ limit: mocks.emailIpLimit }),
  createSignupIpRateLimiter: () => ({ limit: mocks.ipLimit }),
}));

import { POST } from "@/app/api/auth/signup/route";

const VALID_BODY = {
  name: "Test User",
  email: "user@example.com",
  password: "Password1",
  zipCode: "90210",
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.emailIpLimit.mockResolvedValue({ success: true });
  mocks.ipLimit.mockResolvedValue({ success: true });
  mocks.hashPassword.mockResolvedValue("$2b$12$hashedvalue");
  mocks.geocodeZip.mockResolvedValue({ lat: 34.09, lng: -118.41 });
  mocks.prismaFindUnique.mockResolvedValue(null);
  mocks.prismaTransaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        user: { create: vi.fn().mockResolvedValue({ id: "new-user-id" }) },
        userPreferences: { create: vi.fn().mockResolvedValue({}) },
        subscription: { create: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    }
  );
});

describe("POST /api/auth/signup — enumeration invariant", () => {
  it("new user with a valid ZIP returns 200 ok:true", async () => {
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean };
    expect(json).toEqual({ ok: true });
  });

  it("existing user with a valid ZIP returns 200 ok:true (same body as success)", async () => {
    mocks.prismaFindUnique.mockResolvedValue({ id: "existing-id" });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean };
    expect(json).toEqual({ ok: true });
  });

  it("existing user path calls hashPassword for timing parity", async () => {
    mocks.prismaFindUnique.mockResolvedValue({ id: "existing-id" });

    await POST(makeRequest(VALID_BODY));

    expect(mocks.hashPassword).toHaveBeenCalledWith("throwaway-timing-mask");
  });

  it("new user with a bad ZIP returns 400 before the email uniqueness check", async () => {
    mocks.geocodeZip.mockResolvedValue(null);

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toMatch(/couldn't find that ZIP/i);

    expect(mocks.prismaFindUnique).not.toHaveBeenCalled();
  });

  it("attacker supplying existing email + bad ZIP gets 400 — same as new email + bad ZIP", async () => {
    mocks.geocodeZip.mockResolvedValue(null);
    mocks.prismaFindUnique.mockResolvedValue({ id: "existing-id" });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toMatch(/couldn't find that ZIP/i);

    expect(mocks.prismaFindUnique).not.toHaveBeenCalled();
  });

  it("geocodeZip is called before the email uniqueness check", async () => {
    const callOrder: string[] = [];

    mocks.geocodeZip.mockImplementation(async () => {
      callOrder.push("geocode");
      return { lat: 34.09, lng: -118.41 };
    });
    mocks.prismaFindUnique.mockImplementation(async () => {
      callOrder.push("findUnique");
      return null;
    });

    await POST(makeRequest(VALID_BODY));

    expect(callOrder[0]).toBe("geocode");
    expect(callOrder[1]).toBe("findUnique");
  });
});
