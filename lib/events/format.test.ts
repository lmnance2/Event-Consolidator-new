import { describe, it, expect } from "vitest";
import { formatDayTime, formatFullDate, formatTime, priceLabel, distanceLabel } from "./format";

describe("formatDayTime", () => {
  it("formats a UTC ISO string to short weekday + month + day + time", () => {
    const result = formatDayTime("2025-07-12T20:00:00.000Z");
    expect(result).toBe("Sat, Jul 12 · 8:00 PM");
  });

  it("pads minutes for times like 8:05", () => {
    const result = formatDayTime("2025-07-12T20:05:00.000Z");
    expect(result).toBe("Sat, Jul 12 · 8:05 PM");
  });

  it("handles midnight (12:00 AM)", () => {
    const result = formatDayTime("2025-07-13T00:00:00.000Z");
    expect(result).toBe("Sun, Jul 13 · 12:00 AM");
  });
});

describe("formatFullDate", () => {
  it("formats full date with weekday and year", () => {
    const result = formatFullDate("2025-07-12T20:00:00.000Z");
    expect(result).toBe("Saturday, July 12, 2025");
  });
});

describe("formatTime", () => {
  it("formats to 12-hour time with AM/PM", () => {
    expect(formatTime("2025-07-12T20:00:00.000Z")).toBe("8:00 PM");
  });

  it("formats morning time", () => {
    expect(formatTime("2025-07-12T10:30:00.000Z")).toBe("10:30 AM");
  });
});

describe("priceLabel", () => {
  it("returns Free when isFree is true", () => {
    expect(priceLabel(true, 0)).toBe("Free");
    expect(priceLabel(true, null)).toBe("Free");
  });

  it("returns dollar + price when priceMin is set", () => {
    expect(priceLabel(false, 25)).toBe("$25");
    expect(priceLabel(false, 0)).toBe("$0");
  });

  it("returns Price not listed when priceMin is null and not free", () => {
    expect(priceLabel(false, null)).toBe("Price not listed");
  });
});

describe("distanceLabel", () => {
  it("returns integer for distances >= 10", () => {
    expect(distanceLabel(10)).toBe("10 mi");
    expect(distanceLabel(15.7)).toBe("16 mi");
    expect(distanceLabel(100)).toBe("100 mi");
  });

  it("returns one decimal for distances < 10", () => {
    expect(distanceLabel(3.2)).toBe("3.2 mi");
    expect(distanceLabel(0.5)).toBe("0.5 mi");
    expect(distanceLabel(9.9)).toBe("9.9 mi");
  });

  it("returns one decimal for 0", () => {
    expect(distanceLabel(0)).toBe("0 mi");
  });
});
