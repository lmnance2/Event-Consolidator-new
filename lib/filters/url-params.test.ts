import { describe, it, expect, vi, afterEach } from "vitest";
import { parseFilterParams, serializeFilterParams, parseGeoCoords } from "./url-params";
import { Category, ExperienceType } from "@prisma/client";

describe("parseFilterParams", () => {
  it("returns empty overrides for empty params", () => {
    const result = parseFilterParams(new URLSearchParams());
    expect(result).toEqual({});
  });

  it("parses search query", () => {
    const result = parseFilterParams(new URLSearchParams("q=jazz+festival"));
    expect(result.q).toBe("jazz festival");
  });

  it("parses single category", () => {
    const result = parseFilterParams(new URLSearchParams("cat=MUSIC"));
    expect(result.categories).toEqual([Category.MUSIC]);
  });

  it("parses multiple categories", () => {
    const result = parseFilterParams(new URLSearchParams("cat=MUSIC,SPORTS"));
    expect(result.categories).toEqual([Category.MUSIC, Category.SPORTS]);
  });

  it("ignores unknown categories", () => {
    const result = parseFilterParams(new URLSearchParams("cat=MUSIC,NOTREAL"));
    expect(result.categories).toEqual([Category.MUSIC]);
  });

  it("drops category param if all values unknown", () => {
    const result = parseFilterParams(new URLSearchParams("cat=NOTREAL"));
    expect(result.categories).toBeUndefined();
  });

  it("parses distance", () => {
    const result = parseFilterParams(new URLSearchParams("dist=15"));
    expect(result.distanceMi).toBe(15);
  });

  it("ignores invalid distance", () => {
    expect(parseFilterParams(new URLSearchParams("dist=abc")).distanceMi).toBeUndefined();
    expect(parseFilterParams(new URLSearchParams("dist=0")).distanceMi).toBeUndefined();
    expect(parseFilterParams(new URLSearchParams("dist=501")).distanceMi).toBeUndefined();
  });

  it("parses date range", () => {
    const result = parseFilterParams(new URLSearchParams("days=30"));
    expect(result.dateRangeDays).toBe(30);
  });

  it("parses price range", () => {
    const result = parseFilterParams(new URLSearchParams("pmin=10&pmax=100"));
    expect(result.priceMin).toBe(10);
    expect(result.priceMax).toBe(100);
  });

  it("parses experience type", () => {
    const result = parseFilterParams(new URLSearchParams("exp=INDOOR"));
    expect(result.experienceType).toBe(ExperienceType.INDOOR);
  });

  it("ignores unknown experience type", () => {
    const result = parseFilterParams(new URLSearchParams("exp=UNKNOWN"));
    expect(result.experienceType).toBeUndefined();
  });

  it("parses family=1 as true", () => {
    const result = parseFilterParams(new URLSearchParams("family=1"));
    expect(result.familyFriendly).toBe(true);
  });

  it("ignores family=0", () => {
    const result = parseFilterParams(new URLSearchParams("family=0"));
    expect(result.familyFriendly).toBeUndefined();
  });

  it("parses free=1 as true", () => {
    const result = parseFilterParams(new URLSearchParams("free=1"));
    expect(result.freeOnly).toBe(true);
  });

  it("parses time of day", () => {
    const result = parseFilterParams(new URLSearchParams("time=EVENING"));
    expect(result.timeOfDay).toBe("EVENING");
  });

  it("ignores unknown time of day", () => {
    const result = parseFilterParams(new URLSearchParams("time=NIGHT"));
    expect(result.timeOfDay).toBeUndefined();
  });

  it("parses venue", () => {
    const result = parseFilterParams(new URLSearchParams("venue=Radio+City"));
    expect(result.venue).toBe("Radio City");
  });

  it("ignores unknown params", () => {
    const result = parseFilterParams(new URLSearchParams("unknownparam=value&q=jazz"));
    expect(result.q).toBe("jazz");
    expect(result).not.toHaveProperty("unknownparam");
  });
});

describe("serializeFilterParams", () => {
  it("produces empty params for empty overrides", () => {
    const params = serializeFilterParams({});
    expect(params.toString()).toBe("");
  });

  it("round-trips a full set of overrides", () => {
    const overrides = {
      q: "jazz",
      categories: [Category.MUSIC, Category.SPORTS],
      distanceMi: 15,
      dateRangeDays: 30,
      priceMin: 0,
      priceMax: 100,
      experienceType: ExperienceType.INDOOR,
      familyFriendly: true,
      freeOnly: true,
      timeOfDay: "EVENING" as const,
      venue: "Radio City",
    };

    const params = serializeFilterParams(overrides);
    const parsed = parseFilterParams(params);

    expect(parsed.q).toBe("jazz");
    expect(parsed.categories).toEqual([Category.MUSIC, Category.SPORTS]);
    expect(parsed.distanceMi).toBe(15);
    expect(parsed.dateRangeDays).toBe(30);
    expect(parsed.priceMin).toBe(0);
    expect(parsed.priceMax).toBe(100);
    expect(parsed.experienceType).toBe(ExperienceType.INDOOR);
    expect(parsed.familyFriendly).toBe(true);
    expect(parsed.freeOnly).toBe(true);
    expect(parsed.timeOfDay).toBe("EVENING");
    expect(parsed.venue).toBe("Radio City");
  });

  it("omits false/undefined values", () => {
    const params = serializeFilterParams({ familyFriendly: false, freeOnly: false });
    expect(params.has("family")).toBe(false);
    expect(params.has("free")).toBe(false);
  });

  it("omits empty string q", () => {
    const params = serializeFilterParams({ q: "" });
    expect(params.has("q")).toBe(false);
  });

  it("omits empty categories array", () => {
    const params = serializeFilterParams({ categories: [] });
    expect(params.has("cat")).toBe(false);
  });

  it("omits cat param when categories match user preference defaults", () => {
    const allCategories = Object.values(Category) as Category[];
    const prefs = { disabledCategories: [] };
    const params = serializeFilterParams({ categories: allCategories }, prefs);
    expect(params.has("cat")).toBe(false);
  });

  it("omits cat param when categories equal prefs-enabled set (some disabled)", () => {
    const allCategories = Object.values(Category) as Category[];
    const prefs = { disabledCategories: [Category.SPORTS] };
    const defaultEnabled = allCategories.filter((c) => c !== Category.SPORTS);
    const params = serializeFilterParams({ categories: defaultEnabled }, prefs);
    expect(params.has("cat")).toBe(false);
  });

  it("writes cat param when categories differ from preference defaults", () => {
    const prefs = { disabledCategories: [] };
    const params = serializeFilterParams({ categories: [Category.MUSIC] }, prefs);
    expect(params.get("cat")).toBe("MUSIC");
  });

  it("writes cat param without prefs (no delta comparison)", () => {
    const params = serializeFilterParams({ categories: [Category.MUSIC] });
    expect(params.get("cat")).toBe("MUSIC");
  });
});

describe("parseGeoCoords", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses valid coords JSON with fresh timestamp", () => {
    const ts = Date.now();
    const raw = JSON.stringify({ lat: 37.7749, lng: -122.4194, ts });
    const result = parseGeoCoords(raw);
    expect(result).toEqual({ lat: 37.7749, lng: -122.4194, ts });
  });

  it("returns null for missing fields", () => {
    const raw = JSON.stringify({ lat: 37.7749 });
    expect(parseGeoCoords(raw)).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseGeoCoords("not json")).toBeNull();
    expect(parseGeoCoords("{corrupt")).toBeNull();
  });

  it("returns null for null input value", () => {
    expect(parseGeoCoords("null")).toBeNull();
  });

  it("returns null for wrong types", () => {
    const ts = Date.now();
    const raw = JSON.stringify({ lat: "37", lng: -122, ts });
    expect(parseGeoCoords(raw)).toBeNull();
  });

  it("returns null for lat out of range", () => {
    const ts = Date.now();
    expect(parseGeoCoords(JSON.stringify({ lat: 999, lng: 0, ts }))).toBeNull();
    expect(parseGeoCoords(JSON.stringify({ lat: -999, lng: 0, ts }))).toBeNull();
  });

  it("returns null for lng out of range", () => {
    const ts = Date.now();
    expect(parseGeoCoords(JSON.stringify({ lat: 0, lng: 999, ts }))).toBeNull();
    expect(parseGeoCoords(JSON.stringify({ lat: 0, lng: -999, ts }))).toBeNull();
  });

  it("returns null for non-finite lat or lng", () => {
    const ts = Date.now();
    expect(parseGeoCoords(JSON.stringify({ lat: Infinity, lng: 0, ts }))).toBeNull();
    expect(parseGeoCoords(JSON.stringify({ lat: 0, lng: -Infinity, ts }))).toBeNull();
  });

  it("returns null for negative timestamp", () => {
    const raw = JSON.stringify({ lat: 37.7749, lng: -122.4194, ts: -1 });
    expect(parseGeoCoords(raw)).toBeNull();
  });

  it("returns null for zero timestamp", () => {
    const raw = JSON.stringify({ lat: 37.7749, lng: -122.4194, ts: 0 });
    expect(parseGeoCoords(raw)).toBeNull();
  });

  it("returns null for timestamp older than 24 hours", () => {
    const staleTs = Date.now() - 25 * 60 * 60 * 1000;
    const raw = JSON.stringify({ lat: 37.7749, lng: -122.4194, ts: staleTs });
    expect(parseGeoCoords(raw)).toBeNull();
  });

  it("accepts timestamp at boundary within 24 hours", () => {
    const freshTs = Date.now() - 23 * 60 * 60 * 1000;
    const raw = JSON.stringify({ lat: 37.7749, lng: -122.4194, ts: freshTs });
    expect(parseGeoCoords(raw)).not.toBeNull();
  });
});
