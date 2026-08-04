import { describe, it, expect, vi, beforeAll } from "vitest";

vi.mock("@/lib/db/client", () => ({
  prisma: {},
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

vi.mock("@/lib/auth/password", () => ({
  verifyPassword: vi.fn(),
  passwordSchema: { safeParse: vi.fn() },
}));

vi.stubEnv("NEXTAUTH_SECRET", "test-secret-32-bytes-long-enough!!");
vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");
vi.stubEnv("RESEND_API_KEY", "test-resend-key");
vi.stubEnv("OPENCAGE_API_KEY", "test-opencage-key");
vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");

let mapGoogleProfile: typeof import("./config").mapGoogleProfile;

beforeAll(async () => {
  const mod = await import("./config");
  mapGoogleProfile = mod.mapGoogleProfile;
});

describe("Google profile() mapping", () => {
  it("sets emailVerified to a Date when email_verified is true", () => {
    const result = mapGoogleProfile({
      sub: "google-uid-123",
      name: "Test User",
      email: "test@example.com",
      picture: "https://example.com/photo.jpg",
      email_verified: true,
    });

    expect(result.emailVerified).toBeInstanceOf(Date);
    expect(result.id).toBe("google-uid-123");
    expect(result.email).toBe("test@example.com");
  });

  it("sets emailVerified to null when email_verified is false", () => {
    const result = mapGoogleProfile({
      sub: "google-uid-456",
      name: "Unverified User",
      email: "unverified@example.com",
      picture: "https://example.com/photo2.jpg",
      email_verified: false,
    });

    expect(result.emailVerified).toBeNull();
  });

  it("maps all fields correctly", () => {
    const result = mapGoogleProfile({
      sub: "google-uid-789",
      name: "Full User",
      email: "full@example.com",
      picture: "https://example.com/photo3.jpg",
      email_verified: true,
    });

    expect(result.id).toBe("google-uid-789");
    expect(result.name).toBe("Full User");
    expect(result.image).toBe("https://example.com/photo3.jpg");
  });
});
