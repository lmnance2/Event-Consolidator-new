import { describe, it, expect } from "vitest";
import { computeReminderSendAt } from "@/lib/events/reminder";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const NOW = new Date("2026-08-04T12:00:00.000Z");

describe("computeReminderSendAt", () => {
  it("returns a Date when startTime is well in the future", () => {
    const startTime = new Date(NOW.getTime() + 7 * DAY);
    const result = computeReminderSendAt(startTime, NOW);
    expect(result).toBeInstanceOf(Date);
    expect(result).not.toBeNull();
  });

  it("returns a Date exactly 24h before startTime", () => {
    const startTime = new Date(NOW.getTime() + 7 * DAY);
    const result = computeReminderSendAt(startTime, NOW);
    expect(result!.getTime()).toBe(startTime.getTime() - DAY);
  });

  it("returns null when startTime is exactly 24h from now (boundary: sendAt === now, not strictly greater)", () => {
    const startTime = new Date(NOW.getTime() + DAY);
    const result = computeReminderSendAt(startTime, NOW);
    expect(result).toBeNull();
  });

  it("returns null when startTime is 23h from now (sendAt would be 1h in the past)", () => {
    const startTime = new Date(NOW.getTime() + 23 * HOUR);
    const result = computeReminderSendAt(startTime, NOW);
    expect(result).toBeNull();
  });

  it("returns null when startTime is in the past", () => {
    const startTime = new Date(NOW.getTime() - DAY);
    const result = computeReminderSendAt(startTime, NOW);
    expect(result).toBeNull();
  });

  it("returns a non-null Date when sendAt is 1ms in the future (just over boundary)", () => {
    const startTime = new Date(NOW.getTime() + DAY + 1);
    const result = computeReminderSendAt(startTime, NOW);
    expect(result).not.toBeNull();
    expect(result!.getTime()).toBe(NOW.getTime() + 1);
  });

  it("works with UTC Date inputs (timezone-agnostic)", () => {
    const utcNow = new Date("2026-08-04T00:00:00.000Z");
    const utcStart = new Date("2026-08-10T00:00:00.000Z");
    const result = computeReminderSendAt(utcStart, utcNow);
    expect(result).not.toBeNull();
    expect(result!.toISOString()).toBe("2026-08-09T00:00:00.000Z");
  });

  it("works with local-time Date inputs — only getTime() arithmetic matters", () => {
    const localNow = new Date(2026, 7, 4, 8, 0, 0, 0);
    const localStart = new Date(2026, 7, 11, 8, 0, 0, 0);
    const result = computeReminderSendAt(localStart, localNow);
    expect(result).not.toBeNull();
    expect(result!.getTime()).toBe(localStart.getTime() - DAY);
  });
});
