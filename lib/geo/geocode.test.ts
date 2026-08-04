import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("geocodeZip", () => {
  it("returns lat/lng on a successful API response", async () => {
    vi.stubEnv("OPENCAGE_API_KEY", "test-key");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: { code: 200, message: "OK" },
          results: [
            {
              geometry: { lat: 37.7749, lng: -122.4194 },
            },
          ],
        }),
        { status: 200 }
      )
    );

    const { geocodeZip } = await import("./geocode");
    const result = await geocodeZip("94102");

    expect(result).toEqual({ lat: 37.7749, lng: -122.4194 });
  });

  it("returns null when API returns no results", async () => {
    vi.stubEnv("OPENCAGE_API_KEY", "test-key");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: { code: 200, message: "OK" },
          results: [],
        }),
        { status: 200 }
      )
    );

    const { geocodeZip } = await import("./geocode");
    const result = await geocodeZip("00000");

    expect(result).toBeNull();
  });

  it("returns null when fetch throws a network error", async () => {
    vi.stubEnv("OPENCAGE_API_KEY", "test-key");

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network error")
    );

    const { geocodeZip } = await import("./geocode");
    const result = await geocodeZip("94102");

    expect(result).toBeNull();
  });

  it("returns null when the HTTP response is not ok", async () => {
    vi.stubEnv("OPENCAGE_API_KEY", "test-key");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ status: { code: 402, message: "Payment required" }, results: [] }), {
        status: 402,
      })
    );

    const { geocodeZip } = await import("./geocode");
    const result = await geocodeZip("94102");

    expect(result).toBeNull();
  });

  it("throws when OPENCAGE_API_KEY env var is missing", async () => {
    vi.stubEnv("OPENCAGE_API_KEY", "");

    const { geocodeZip } = await import("./geocode");

    await expect(geocodeZip("94102")).rejects.toThrow("OPENCAGE_API_KEY");
  });
});
