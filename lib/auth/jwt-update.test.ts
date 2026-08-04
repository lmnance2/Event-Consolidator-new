import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/client", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/password", () => ({
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
  passwordSchema: { safeParse: vi.fn() },
}));

vi.mock("next-auth/providers/google", () => ({
  default: vi.fn(() => ({ id: "google", type: "oauth" })),
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn(() => ({ id: "credentials", type: "credentials" })),
}));

vi.mock("@auth/prisma-adapter", () => ({
  PrismaAdapter: vi.fn(() => ({})),
}));

describe("JWT update trigger — needsZip cleared when zipCode is set", () => {
  beforeEach(() => {
    vi.stubEnv("NEXTAUTH_SECRET", "test-secret-32-bytes-long-enough!!");
    vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");
    vi.stubEnv("RESEND_API_KEY", "test-resend-key");
    vi.stubEnv("OPENCAGE_API_KEY", "test-opencage-key");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    vi.resetModules();
  });

  it("returns needsZip=false when DB user has zipCode set", async () => {
    const { prisma } = await import("@/lib/db/client");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      sessionVersion: 1,
      zipCode: "94102",
    } as never);

    const { authConfig } = await import("./config");
    const jwtCallback = authConfig.callbacks?.jwt;
    if (!jwtCallback) throw new Error("jwt callback not found");

    const token = {
      userId: "user-1",
      sessionVersion: 1,
      needsZip: true,
    };

    const result = await jwtCallback({
      token,
      trigger: "update",
      session: null,
      user: null as never,
      account: null,
      newSession: null,
    } as never);

    expect(result).not.toBeNull();
    expect((result as Record<string, unknown>).needsZip).toBe(false);
  });

  it("returns needsZip=true when DB user has no zipCode", async () => {
    const { prisma } = await import("@/lib/db/client");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-2",
      sessionVersion: 1,
      zipCode: null,
    } as never);

    const { authConfig } = await import("./config");
    const jwtCallback = authConfig.callbacks?.jwt;
    if (!jwtCallback) throw new Error("jwt callback not found");

    const token = {
      userId: "user-2",
      sessionVersion: 1,
      needsZip: false,
    };

    const result = await jwtCallback({
      token,
      trigger: "update",
      session: null,
      user: null as never,
      account: null,
      newSession: null,
    } as never);

    expect(result).not.toBeNull();
    expect((result as Record<string, unknown>).needsZip).toBe(true);
  });

});
