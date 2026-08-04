import { z } from "zod";
import { Category, ExperienceType } from "@prisma/client";

const VALID_CATEGORIES = new Set(Object.values(Category));
const VALID_EXPERIENCE = new Set(Object.values(ExperienceType));
const VALID_TIME = new Set(["MORNING", "AFTERNOON", "EVENING"] as const);

const GEO_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface FilterOverrides {
  q?: string;
  categories?: Category[];
  distanceMi?: number;
  dateRangeDays?: number;
  priceMin?: number;
  priceMax?: number;
  experienceType?: ExperienceType;
  familyFriendly?: boolean;
  freeOnly?: boolean;
  timeOfDay?: "MORNING" | "AFTERNOON" | "EVENING";
  venue?: string;
}

const geoSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  ts: z.number().int().positive(),
});

export type GeoCoords = z.infer<typeof geoSchema>;

export function parseGeoCoords(raw: string): GeoCoords | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = geoSchema.safeParse(parsed);
    if (!result.success) return null;
    if (Date.now() - result.data.ts > GEO_MAX_AGE_MS) return null;
    return result.data;
  } catch {
    return null;
  }
}

export function parseFilterParams(searchParams: URLSearchParams): FilterOverrides {
  const overrides: FilterOverrides = {};

  const q = searchParams.get("q");
  if (q !== null && q.length > 0) overrides.q = q;

  const cat = searchParams.get("cat");
  if (cat !== null) {
    const cats = cat
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is Category => VALID_CATEGORIES.has(s as Category));
    if (cats.length > 0) overrides.categories = cats;
  }

  const dist = searchParams.get("dist");
  if (dist !== null) {
    const n = parseInt(dist, 10);
    if (!isNaN(n) && n >= 1 && n <= 500) overrides.distanceMi = n;
  }

  const days = searchParams.get("days");
  if (days !== null) {
    const n = parseInt(days, 10);
    if (!isNaN(n) && n >= 1 && n <= 365) overrides.dateRangeDays = n;
  }

  const pmin = searchParams.get("pmin");
  if (pmin !== null) {
    const n = parseInt(pmin, 10);
    if (!isNaN(n) && n >= 0) overrides.priceMin = n;
  }

  const pmax = searchParams.get("pmax");
  if (pmax !== null) {
    const n = parseInt(pmax, 10);
    if (!isNaN(n) && n >= 0) overrides.priceMax = n;
  }

  const exp = searchParams.get("exp");
  if (exp !== null && VALID_EXPERIENCE.has(exp as ExperienceType)) {
    overrides.experienceType = exp as ExperienceType;
  }

  const family = searchParams.get("family");
  if (family === "1") overrides.familyFriendly = true;

  const free = searchParams.get("free");
  if (free === "1") overrides.freeOnly = true;

  const time = searchParams.get("time");
  if (time !== null && VALID_TIME.has(time as "MORNING" | "AFTERNOON" | "EVENING")) {
    overrides.timeOfDay = time as "MORNING" | "AFTERNOON" | "EVENING";
  }

  const venue = searchParams.get("venue");
  if (venue !== null && venue.length > 0) overrides.venue = venue;

  return overrides;
}

export interface PrefsForSerialization {
  disabledCategories: Category[];
}

function categoriesMatchDefault(cats: Category[], prefs: PrefsForSerialization): boolean {
  const allCategories = Object.values(Category) as Category[];
  const defaultEnabled = allCategories.filter((c) => !prefs.disabledCategories.includes(c));
  if (cats.length !== defaultEnabled.length) return false;
  const catSet = new Set(cats);
  return defaultEnabled.every((c) => catSet.has(c));
}

export function serializeFilterParams(
  overrides: FilterOverrides,
  prefs?: PrefsForSerialization
): URLSearchParams {
  const params = new URLSearchParams();

  if (overrides.q !== undefined && overrides.q.length > 0) {
    params.set("q", overrides.q);
  }
  if (overrides.categories !== undefined && overrides.categories.length > 0) {
    const isDefault = prefs !== undefined && categoriesMatchDefault(overrides.categories, prefs);
    if (!isDefault) {
      params.set("cat", overrides.categories.join(","));
    }
  }
  if (overrides.distanceMi !== undefined) {
    params.set("dist", String(overrides.distanceMi));
  }
  if (overrides.dateRangeDays !== undefined) {
    params.set("days", String(overrides.dateRangeDays));
  }
  if (overrides.priceMin !== undefined) {
    params.set("pmin", String(overrides.priceMin));
  }
  if (overrides.priceMax !== undefined) {
    params.set("pmax", String(overrides.priceMax));
  }
  if (overrides.experienceType !== undefined) {
    params.set("exp", overrides.experienceType);
  }
  if (overrides.familyFriendly === true) {
    params.set("family", "1");
  }
  if (overrides.freeOnly === true) {
    params.set("free", "1");
  }
  if (overrides.timeOfDay !== undefined) {
    params.set("time", overrides.timeOfDay);
  }
  if (overrides.venue !== undefined && overrides.venue.length > 0) {
    params.set("venue", overrides.venue);
  }

  return params;
}
