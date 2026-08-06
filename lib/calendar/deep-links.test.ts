import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { googleCalendarUrl, appleCalendarUrl } from "@/lib/calendar/deep-links";

const BASE_EVENT = {
  id: "evt-xyz",
  title: "Summer Festival",
  description: "Music & food",
  startTime: new Date("2026-09-15T18:00:00.000Z"),
  endTime: new Date("2026-09-15T22:00:00.000Z"),
  venue: "Central Park, NYC",
};

describe("googleCalendarUrl", () => {
  it("produces a URL with the correct base and action=TEMPLATE", () => {
    const url = googleCalendarUrl(BASE_EVENT);
    expect(url).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?/);
    expect(url).toContain("action=TEMPLATE");
  });

  it("encodes special characters in title and venue", () => {
    const event = {
      ...BASE_EVENT,
      title: "Rock & Roll: Fest",
      venue: "The O2, London & Beyond",
    };
    const url = googleCalendarUrl(event);
    const parsed = new URL(url);
    expect(parsed.searchParams.get("text")).toBe("Rock & Roll: Fest");
    expect(parsed.searchParams.get("location")).toBe("The O2, London & Beyond");
  });

  it("formats dates as YYYYMMDDTHHmmssZ/YYYYMMDDTHHmmssZ", () => {
    const url = googleCalendarUrl(BASE_EVENT);
    expect(url).toContain("20260915T180000Z%2F20260915T220000Z");
  });

  it("falls back DTEND to startTime + 2h when endTime is null", () => {
    const event = { ...BASE_EVENT, endTime: null };
    const url = googleCalendarUrl(event);
    expect(url).toContain("20260915T180000Z%2F20260915T200000Z");
  });
});

describe("appleCalendarUrl", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "window", {
      value: { location: { host: "eventatlas.app" } },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the webcal: scheme", () => {
    const url = appleCalendarUrl(BASE_EVENT);
    expect(url).toMatch(/^webcal:\/\//);
  });

  it("derives host from window.location.host and constructs the ICS URL", () => {
    const url = appleCalendarUrl(BASE_EVENT);
    expect(url).toBe(`webcal://eventatlas.app/api/events/${BASE_EVENT.id}/ics`);
  });

  it("uses the correct event id in the path", () => {
    const event = { ...BASE_EVENT, id: "evt-abc-123" };
    const url = appleCalendarUrl(event);
    expect(url).toBe(`webcal://eventatlas.app/api/events/evt-abc-123/ics`);
  });

  it("throws when called server-side (window undefined)", () => {
    const saved = globalThis.window;
    // @ts-expect-error — simulating SSR environment
    globalThis.window = undefined;
    expect(() => appleCalendarUrl(BASE_EVENT)).toThrow("appleCalendarUrl must be called client-side");
    globalThis.window = saved;
  });
});
