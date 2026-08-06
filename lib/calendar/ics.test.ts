import { describe, it, expect } from "vitest";
import { buildIcsFile } from "@/lib/calendar/ics";

const BASE_EVENT = {
  id: "evt-abc123",
  title: "Test Concert",
  description: "A great show.",
  startTime: new Date("2026-09-01T20:00:00.000Z"),
  endTime: new Date("2026-09-01T22:00:00.000Z"),
  venue: "Madison Square Garden, NYC",
  sources: [{ ticketUrl: "https://tm.com/evt-abc123" }],
};

function getLines(ics: string): string[] {
  return ics.split("\r\n").filter((l) => l.length > 0);
}

function getField(ics: string, name: string): string | undefined {
  const unfolded = ics.replace(/\r\n /g, "");
  const line = unfolded.split("\r\n").find((l) => l.startsWith(`${name}:`));
  return line?.slice(name.length + 1);
}

describe("buildIcsFile — envelope structure", () => {
  it("contains BEGIN:VCALENDAR and END:VCALENDAR", () => {
    const ics = buildIcsFile(BASE_EVENT);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("contains BEGIN:VEVENT and END:VEVENT", () => {
    const ics = buildIcsFile(BASE_EVENT);
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
  });

  it("contains VERSION:2.0 and PRODID", () => {
    const ics = buildIcsFile(BASE_EVENT);
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//Event Atlas//EN");
  });

  it("uses CRLF line endings throughout", () => {
    const ics = buildIcsFile(BASE_EVENT);
    const lines = ics.split("\r\n");
    expect(lines.length).toBeGreaterThan(5);
    expect(ics).not.toMatch(/(?<!\r)\n/);
  });

  it("UID format is {id}@eventatlas.app", () => {
    const ics = buildIcsFile(BASE_EVENT);
    expect(getField(ics, "UID")).toBe("evt-abc123@eventatlas.app");
  });
});

describe("buildIcsFile — datetime format", () => {
  it("formats DTSTART as YYYYMMDDTHHmmssZ", () => {
    const ics = buildIcsFile(BASE_EVENT);
    expect(getField(ics, "DTSTART")).toBe("20260901T200000Z");
  });

  it("formats DTEND as YYYYMMDDTHHmmssZ", () => {
    const ics = buildIcsFile(BASE_EVENT);
    expect(getField(ics, "DTEND")).toBe("20260901T220000Z");
  });

  it("falls back DTEND to startTime + 2h when endTime is null", () => {
    const event = { ...BASE_EVENT, endTime: null };
    const ics = buildIcsFile(event);
    expect(getField(ics, "DTEND")).toBe("20260901T220000Z");
  });
});

describe("buildIcsFile — text escaping", () => {
  it("escapes commas in SUMMARY", () => {
    const event = { ...BASE_EVENT, title: "Rock, Pop, Jazz" };
    const ics = buildIcsFile(event);
    const summary = getField(ics, "SUMMARY");
    expect(summary).toContain("Rock\\, Pop\\, Jazz");
  });

  it("escapes semicolons in SUMMARY", () => {
    const event = { ...BASE_EVENT, title: "Rock; Jazz" };
    const ics = buildIcsFile(event);
    const summary = getField(ics, "SUMMARY");
    expect(summary).toContain("Rock\\; Jazz");
  });

  it("escapes backslashes in SUMMARY", () => {
    const event = { ...BASE_EVENT, title: "C:\\Music" };
    const ics = buildIcsFile(event);
    const summary = getField(ics, "SUMMARY");
    expect(summary).toContain("C:\\\\Music");
  });

  it("escapes CRLF in DESCRIPTION as \\n", () => {
    const event = { ...BASE_EVENT, description: "Line one\r\nLine two" };
    const ics = buildIcsFile(event);
    const desc = getField(ics, "DESCRIPTION");
    expect(desc).toContain("Line one\\nLine two");
  });

  it("escapes LF in DESCRIPTION as \\n", () => {
    const event = { ...BASE_EVENT, description: "Line one\nLine two" };
    const ics = buildIcsFile(event);
    const desc = getField(ics, "DESCRIPTION");
    expect(desc).toContain("Line one\\nLine two");
  });
});

describe("buildIcsFile — line folding", () => {
  it("folds a SUMMARY longer than 75 bytes with CRLF+space", () => {
    const longTitle = "A".repeat(80);
    const event = { ...BASE_EVENT, title: longTitle };
    const ics = buildIcsFile(event);
    expect(ics).toContain("\r\n ");
    const summaryLine = ics
      .split("\r\n")
      .find((l) => l.startsWith("SUMMARY:"));
    expect(summaryLine!.length).toBeLessThanOrEqual(75);
  });

  it("short lines are not folded", () => {
    const event = { ...BASE_EVENT, title: "Short" };
    const ics = buildIcsFile(event);
    const lines = getLines(ics);
    const summaryLine = lines.find((l) => l.startsWith("SUMMARY:"));
    expect(summaryLine).toBeDefined();
    expect(summaryLine!.length).toBeLessThanOrEqual(75);
    const nextLine = lines[lines.indexOf(summaryLine!) + 1];
    expect(nextLine).not.toMatch(/^ /);
  });
});
