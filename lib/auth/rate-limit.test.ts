import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("rate-limit factory functions", () => {
  it("createLoginRateLimiter throws when UPSTASH_REDIS_REST_URL is missing", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");

    const { createLoginRateLimiter } = await import("./rate-limit");

    expect(() => createLoginRateLimiter()).toThrow(
      "UPSTASH_REDIS_REST_URL"
    );
  });

  it("createLoginRateLimiter throws when UPSTASH_REDIS_REST_TOKEN is missing", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const { createLoginRateLimiter } = await import("./rate-limit");

    expect(() => createLoginRateLimiter()).toThrow(
      "UPSTASH_REDIS_REST_TOKEN"
    );
  });

  it("createSignupRateLimiter throws when Upstash env missing", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const { createSignupRateLimiter } = await import("./rate-limit");

    expect(() => createSignupRateLimiter()).toThrow();
  });

  it("createForgotPasswordRateLimiter throws when Upstash env missing", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const { createForgotPasswordRateLimiter } = await import("./rate-limit");

    expect(() => createForgotPasswordRateLimiter()).toThrow();
  });

  it("createLoginRateLimiter returns a Ratelimit instance when env is set", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "valid-token");

    const { createLoginRateLimiter } = await import("./rate-limit");
    const limiter = createLoginRateLimiter();

    expect(limiter).toBeDefined();
    expect(typeof limiter.limit).toBe("function");
  });
});
