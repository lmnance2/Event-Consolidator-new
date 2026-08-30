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

/**
 * Per email:senderId tuple — 5 requests per hour.
 * Prevents a single sender from flooding a specific target address.
 */
export function createFriendRequestTupleRateLimiter(): Ratelimit {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(5, "1 h"),
    prefix: "rl:friend-req:tuple",
    analytics: false,
  });
}

/**
 * Per senderId fallback — 30 requests per hour.
 * Prevents a single sender from rotating target emails to bypass the tuple limit.
 */
export function createFriendRequestSenderRateLimiter(): Ratelimit {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(30, "1 h"),
    prefix: "rl:friend-req:sender",
    analytics: false,
  });
}

/**
 * Per sender — 10 event invites per hour.
 */
export function createEventInviteRateLimiter(): Ratelimit {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, "1 h"),
    prefix: "rl:event-invite",
    analytics: false,
  });
}
