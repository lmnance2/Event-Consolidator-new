import { describe, it, expect } from "vitest";
import { googleMapsUrl, appleMapsUrl } from "./maps";

describe("googleMapsUrl", () => {
  it("produces correct Google Maps search URL", () => {
    expect(googleMapsUrl("Madison Square Garden, NYC, NY")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Madison%20Square%20Garden%2C%20NYC%2C%20NY"
    );
  });

  it("encodes special characters", () => {
    const url = googleMapsUrl("O'Brien's Pub & Grill, 5th Ave");
    expect(url).toContain("O'Brien");
    expect(url).toContain("%26");
  });

  it("handles empty string", () => {
    expect(googleMapsUrl("")).toBe(
      "https://www.google.com/maps/search/?api=1&query="
    );
  });
});

describe("appleMapsUrl", () => {
  it("produces correct Apple Maps URL", () => {
    expect(appleMapsUrl("Madison Square Garden, NYC, NY")).toBe(
      "https://maps.apple.com/?q=Madison%20Square%20Garden%2C%20NYC%2C%20NY"
    );
  });

  it("encodes special characters", () => {
    const url = appleMapsUrl("Pier 39 & Embarcadero");
    expect(url).toContain("%26");
  });
});
