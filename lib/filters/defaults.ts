import { Category, ExperienceType } from "@prisma/client";
import { FilterOverrides } from "./url-params";

export interface UserPreferencesDefaults {
  disabledCategories: Category[];
  maxDistanceMiles: number;
  dateRangeDays: number;
  priceMin: number | null;
  priceMax: number | null;
  experienceType: ExperienceType;
  familyFriendly: boolean;
}

export interface EffectiveFilters {
  q?: string;
  categories: Category[];
  distanceMi: number;
  dateRangeDays: number;
  priceMin: number | null;
  priceMax: number | null;
  experienceType: ExperienceType;
  familyFriendly: boolean;
  freeOnly: boolean;
  timeOfDay?: "MORNING" | "AFTERNOON" | "EVENING";
  venue?: string;
}

export function effectiveFilters(
  overrides: FilterOverrides,
  prefs: UserPreferencesDefaults
): EffectiveFilters {
  const allCategories = Object.values(Category) as Category[];
  const defaultCategories = allCategories.filter(
    (c) => !prefs.disabledCategories.includes(c)
  );

  return {
    q: overrides.q,
    categories: overrides.categories ?? defaultCategories,
    distanceMi: overrides.distanceMi ?? prefs.maxDistanceMiles,
    dateRangeDays: overrides.dateRangeDays ?? prefs.dateRangeDays,
    priceMin:
      overrides.priceMin !== undefined ? overrides.priceMin : prefs.priceMin,
    priceMax:
      overrides.priceMax !== undefined ? overrides.priceMax : prefs.priceMax,
    experienceType: overrides.experienceType ?? prefs.experienceType,
    familyFriendly: overrides.familyFriendly ?? prefs.familyFriendly,
    freeOnly: overrides.freeOnly ?? false,
    timeOfDay: overrides.timeOfDay,
    venue: overrides.venue,
  };
}
