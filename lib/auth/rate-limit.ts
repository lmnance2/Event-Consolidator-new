import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Check your .env.local file.`
    );
  }
  return value;
}

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: requireEnv("UPSTASH_REDIS_REST_URL"),
      token: requireEnv("UPSTASH_REDIS_REST_TOKEN"),
    });
  }
  return _redis;
}

export function createLoginRateLimiter(): Ratelimit {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(5, "1 m"),
    prefix: "rl:login",
    analytics: false,
  });
}

export function createSignupRateLimiter(): Ratelimit {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(3, "1 m"),
    prefix: "rl:signup",
    analytics: false,
  });
}

export function createSignupIpRateLimiter(): Ratelimit {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "rl:signup:ip",
    analytics: false,
  });
}

export function createForgotPasswordRateLimiter(): Ratelimit {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(3, "1 h"),
    prefix: "rl:forgot",
    analytics: false,
  });
}
