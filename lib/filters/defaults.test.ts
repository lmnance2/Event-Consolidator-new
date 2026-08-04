import { describe, it, expect } from "vitest";
import { effectiveFilters } from "./defaults";
import { Category, ExperienceType } from "@prisma/client";

const defaultPrefs = {
  disabledCategories: [] as Category[],
  maxDistanceMiles: 25,
  dateRangeDays: 30,
  priceMin: null,
  priceMax: null,
  experienceType: ExperienceType.BOTH,
  familyFriendly: false,
};

describe("effectiveFilters", () => {
  it("uses pref defaults when no overrides", () => {
    const result = effectiveFilters({}, defaultPrefs);
    expect(result.distanceMi).toBe(25);
    expect(result.dateRangeDays).toBe(30);
    expect(result.priceMin).toBeNull();
    expect(result.priceMax).toBeNull();
    expect(result.experienceType).toBe(ExperienceType.BOTH);
    expect(result.familyFriendly).toBe(false);
    expect(result.freeOnly).toBe(false);
    expect(result.q).toBeUndefined();
  });

  it("includes all categories when none disabled", () => {
    const result = effectiveFilters({}, defaultPrefs);
    const all = Object.values(Category);
    expect(result.categories).toEqual(all);
  });

  it("excludes disabled categories from defaults", () => {
    const prefs = { ...defaultPrefs, disabledCategories: [Category.NIGHTLIFE, Category.OTHER] };
    const result = effectiveFilters({}, prefs);
    expect(result.categories).not.toContain(Category.NIGHTLIFE);
    expect(result.categories).not.toContain(Category.OTHER);
    expect(result.categories).toContain(Category.MUSIC);
  });

  it("overrides win over pref defaults", () => {
    const result = effectiveFilters(
      { distanceMi: 10, dateRangeDays: 7, familyFriendly: true },
      defaultPrefs
    );
    expect(result.distanceMi).toBe(10);
    expect(result.dateRangeDays).toBe(7);
    expect(result.familyFriendly).toBe(true);
  });

  it("category override replaces default category list entirely", () => {
    const result = effectiveFilters(
      { categories: [Category.MUSIC, Category.SPORTS] },
      defaultPrefs
    );
    expect(result.categories).toEqual([Category.MUSIC, Category.SPORTS]);
  });

  it("priceMin=0 override is used (not treated as falsy)", () => {
    const result = effectiveFilters({ priceMin: 0 }, defaultPrefs);
    expect(result.priceMin).toBe(0);
  });

  it("freeOnly defaults to false when not in overrides", () => {
    const result = effectiveFilters({}, defaultPrefs);
    expect(result.freeOnly).toBe(false);
  });

  it("freeOnly override sets to true", () => {
    const result = effectiveFilters({ freeOnly: true }, defaultPrefs);
    expect(result.freeOnly).toBe(true);
  });

  it("timeOfDay and venue pass through when set", () => {
    const result = effectiveFilters(
      { timeOfDay: "MORNING", venue: "The Venue" },
      defaultPrefs
    );
    expect(result.timeOfDay).toBe("MORNING");
    expect(result.venue).toBe("The Venue");
  });

  it("only serialized overrides differ from defaults — pure passthrough check", () => {
    const result = effectiveFilters({}, defaultPrefs);
    expect(result.timeOfDay).toBeUndefined();
    expect(result.venue).toBeUndefined();
    expect(result.q).toBeUndefined();
  });
});
