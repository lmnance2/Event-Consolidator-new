import { z } from "zod";
import { Category } from "@prisma/client";

export const PRO_ONLY_FIELDS = ["experienceType", "familyFriendly"] as const;

export const CATEGORY_DISPLAY_ORDER: Category[] = [
  Category.MUSIC,
  Category.SPORTS,
  Category.ARTS_THEATER,
  Category.FOOD_DRINK,
  Category.NETWORKING,
  Category.HEALTH_WELLNESS,
  Category.OUTDOOR_ADVENTURE,
  Category.FAMILY_FRIENDLY,
  Category.COMMUNITY_CULTURE,
  Category.NIGHTLIFE,
  Category.EDUCATION,
  Category.OTHER,
];

const priceRefinement = (data: {
  priceMin?: number | null;
  priceMax?: number | null;
}) => {
  if (data.priceMin != null && data.priceMax != null) {
    return data.priceMax >= data.priceMin;
  }
  return true;
};

const priceRefinementMessage = {
  message: "priceMax must be greater than or equal to priceMin",
  path: ["priceMax"],
};

const basePreferencesObject = z.object({
  disabledCategories: z.array(
    z.enum(Object.values(Category) as [Category, ...Category[]])
  ),
  maxDistanceMiles: z.number().int().min(1).max(500),
  dateRangeDays: z.number().int().min(1).max(365),
  priceMin: z.number().int().min(0).nullable().optional(),
  priceMax: z.number().int().min(0).nullable().optional(),
  experienceType: z.enum(["INDOOR", "OUTDOOR", "BOTH"]),
  familyFriendly: z.boolean(),
});

export const preferencesSchema = basePreferencesObject.refine(
  priceRefinement,
  priceRefinementMessage
);

export const preferencesPartialSchema = basePreferencesObject
  .partial()
  .refine(priceRefinement, priceRefinementMessage);

export type PreferencesInput = z.infer<typeof preferencesSchema>;
export type PreferencesPartialInput = z.infer<typeof preferencesPartialSchema>;
