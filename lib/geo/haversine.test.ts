import { describe, it, expect } from "vitest";
import { haversineMeters } from "./haversine";

describe("haversineMeters", () => {
  it("returns 0 for identical coordinates", () => {
    expect(haversineMeters(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
  });

  it("computes ~111.195 km for 1° latitude apart on the equator", () => {
    const meters = haversineMeters(0, 0, 1, 0);
    expect(meters).toBeCloseTo(111_195, -2);
  });

  it("computes ~111.195 km for 1° longitude apart on the equator", () => {
    const meters = haversineMeters(0, 0, 0, 1);
    expect(meters).toBeCloseTo(111_195, -2);
  });

  it("computes ~0 m for longitude at the pole (meridians converge)", () => {
    const meters = haversineMeters(90, 0, 90, 90);
    expect(meters).toBeCloseTo(0, 0);
  });

  it("NYC to LA is approximately 3940 km", () => {
    const nyc = { lat: 40.7128, lng: -74.006 };
    const la = { lat: 34.0522, lng: -118.2437 };
    const meters = haversineMeters(nyc.lat, nyc.lng, la.lat, la.lng);
    expect(meters).toBeGreaterThan(3_900_000);
    expect(meters).toBeLessThan(3_980_000);
  });

  it("returns positive value regardless of point order", () => {
    const a = haversineMeters(40.7128, -74.006, 34.0522, -118.2437);
    const b = haversineMeters(34.0522, -118.2437, 40.7128, -74.006);
    expect(a).toBeCloseTo(b, 0);
  });

  it("distances just under 500m return < 500", () => {
    // 0.0044° latitude ≈ 494m at NYC latitude
    const meters = haversineMeters(40.7128, -74.006, 40.7172, -74.006);
    expect(meters).toBeLessThan(500);
  });

  it("distances just over 500m return > 500", () => {
    // 0.0045° latitude ≈ 500.38m at NYC latitude
    const meters = haversineMeters(40.7128, -74.006, 40.7173, -74.006);
    expect(meters).toBeGreaterThan(500);
  });
});
