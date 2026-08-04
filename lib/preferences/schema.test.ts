import { describe, it, expect } from "vitest";
import {
  preferencesSchema,
  preferencesPartialSchema,
  CATEGORY_DISPLAY_ORDER,
  PRO_ONLY_FIELDS,
} from "./schema";
import { Category } from "@prisma/client";

describe("preferencesSchema", () => {
  const valid = {
    disabledCategories: [Category.MUSIC, Category.SPORTS],
    maxDistanceMiles: 25,
    dateRangeDays: 30,
    priceMin: 0,
    priceMax: 100,
    experienceType: "BOTH" as const,
    familyFriendly: false,
  };

  it("accepts a fully valid preferences object", () => {
    expect(preferencesSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts an empty disabledCategories array", () => {
    expect(
      preferencesSchema.safeParse({ ...valid, disabledCategories: [] }).success
    ).toBe(true);
  });

  it("rejects an unknown category string", () => {
    const result = preferencesSchema.safeParse({
      ...valid,
      disabledCategories: ["CONCERTS"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects maxDistanceMiles below minimum (0)", () => {
    expect(
      preferencesSchema.safeParse({ ...valid, maxDistanceMiles: 0 }).success
    ).toBe(false);
  });

  it("rejects maxDistanceMiles above maximum (501)", () => {
    expect(
      preferencesSchema.safeParse({ ...valid, maxDistanceMiles: 501 }).success
    ).toBe(false);
  });

  it("rejects dateRangeDays below minimum (0)", () => {
    expect(
      preferencesSchema.safeParse({ ...valid, dateRangeDays: 0 }).success
    ).toBe(false);
  });

  it("rejects dateRangeDays above maximum (366)", () => {
    expect(
      preferencesSchema.safeParse({ ...valid, dateRangeDays: 366 }).success
    ).toBe(false);
  });

  it("rejects priceMax < priceMin", () => {
    const result = preferencesSchema.safeParse({
      ...valid,
      priceMin: 50,
      priceMax: 10,
    });
    expect(result.success).toBe(false);
  });

  it("accepts priceMax === priceMin (exact equality is valid)", () => {
    expect(
      preferencesSchema.safeParse({ ...valid, priceMin: 50, priceMax: 50 })
        .success
    ).toBe(true);
  });

  it("accepts null priceMin and null priceMax (both absent)", () => {
    expect(
      preferencesSchema.safeParse({ ...valid, priceMin: null, priceMax: null })
        .success
    ).toBe(true);
  });

  it("skips cross-field price check when only one is present", () => {
    expect(
      preferencesSchema.safeParse({ ...valid, priceMin: 50, priceMax: null })
        .success
    ).toBe(true);
  });

  it("strips unknown top-level fields (Zod default strip behaviour)", () => {
    const result = preferencesSchema.safeParse({ ...valid, unknownField: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("unknownField");
    }
  });
});

describe("preferencesPartialSchema", () => {
  it("accepts an empty object (partial update with no fields)", () => {
    expect(preferencesPartialSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a subset of fields", () => {
    expect(
      preferencesPartialSchema.safeParse({ maxDistanceMiles: 50 }).success
    ).toBe(true);
  });

  it("still rejects priceMax < priceMin when both are provided", () => {
    const result = preferencesPartialSchema.safeParse({
      priceMin: 100,
      priceMax: 10,
    });
    expect(result.success).toBe(false);
  });

  it("still rejects a bad category value", () => {
    const result = preferencesPartialSchema.safeParse({
      disabledCategories: ["NOT_A_CATEGORY"],
    });
    expect(result.success).toBe(false);
  });

  it("strips unknown top-level fields (Zod default strip behaviour)", () => {
    const result = preferencesPartialSchema.safeParse({ ghost: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("ghost");
    }
  });
});

describe("CATEGORY_DISPLAY_ORDER", () => {
  it("contains exactly 12 entries", () => {
    expect(CATEGORY_DISPLAY_ORDER).toHaveLength(12);
  });

  it("starts with MUSIC per PRD display order", () => {
    expect(CATEGORY_DISPLAY_ORDER[0]).toBe(Category.MUSIC);
  });

  it("ends with OTHER per PRD display order", () => {
    expect(CATEGORY_DISPLAY_ORDER[11]).toBe(Category.OTHER);
  });

  it("contains every Category enum value exactly once", () => {
    const allValues = Object.values(Category);
    expect(new Set(CATEGORY_DISPLAY_ORDER).size).toBe(allValues.length);
    for (const cat of allValues) {
      expect(CATEGORY_DISPLAY_ORDER).toContain(cat);
    }
  });
});

describe("PRO_ONLY_FIELDS", () => {
  it("includes experienceType and familyFriendly", () => {
    expect(PRO_ONLY_FIELDS).toContain("experienceType");
    expect(PRO_ONLY_FIELDS).toContain("familyFriendly");
  });

  it("has exactly 2 entries", () => {
    expect(PRO_ONLY_FIELDS).toHaveLength(2);
  });
});
