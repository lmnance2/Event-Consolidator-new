import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { isPro } from "@/lib/subscription/is-pro";
import { getFeedPage } from "@/lib/events/feed-query";
import { Category, ExperienceType } from "@prisma/client";

const LAT_MIN = -90;
const LAT_MAX = 90;
const LNG_MIN = -180;
const LNG_MAX = 180;

const QuerySchema = z.object({
  q: z.string().optional(),
  cat: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined
    )
    .pipe(
      z
        .array(z.nativeEnum(Category))
        .optional()
    ),
  dist: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? Number(v) : undefined))
    .pipe(z.number().int().min(1).max(500).optional()),
  days: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? Number(v) : undefined))
    .pipe(z.number().int().min(1).max(365).optional()),
  pmin: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? Number(v) : undefined))
    .pipe(z.number().int().min(0).optional()),
  pmax: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? Number(v) : undefined))
    .pipe(z.number().int().min(0).optional()),
  exp: z.nativeEnum(ExperienceType).optional(),
  family: z
    .string()
    .optional()
    .transform((v) => (v === "1" ? true : v === "0" ? false : undefined)),
  free: z
    .string()
    .optional()
    .transform((v) => (v === "1" ? true : v === "0" ? false : undefined)),
  time: z.enum(["MORNING", "AFTERNOON", "EVENING"]).optional(),
  venue: z.string().max(200).optional(),
  cursor: z.string().optional(),
  lat: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? Number(v) : undefined))
    .pipe(z.number().min(LAT_MIN).max(LAT_MAX).optional()),
  lng: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? Number(v) : undefined))
    .pipe(z.number().min(LNG_MIN).max(LNG_MAX).optional()),
  limit: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? Number(v) : undefined))
    .pipe(z.number().int().min(1).max(50).optional()),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) {
    console.error("[events GET] Invalid query params:", parsed.error.issues);
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const {
    q,
    cat,
    dist,
    days,
    pmin,
    pmax,
    exp,
    family,
    free,
    time,
    venue,
    cursor,
    lat: clientLat,
    lng: clientLng,
    limit,
  } = parsed.data;

  let user: {
    latitude: number | null;
    longitude: number | null;
    preferences: {
      disabledCategories: unknown;
      maxDistanceMiles: number;
      dateRangeDays: number;
      priceMin: number | null;
      priceMax: number | null;
      experienceType: string;
      familyFriendly: boolean;
    } | null;
    subscription: { status: string } | null;
  } | null;

  try {
    user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        latitude: true,
        longitude: true,
        preferences: {
          select: {
            disabledCategories: true,
            maxDistanceMiles: true,
            dateRangeDays: true,
            priceMin: true,
            priceMax: true,
            experienceType: true,
            familyFriendly: true,
          },
        },
        subscription: {
          select: { status: true },
        },
      },
    });
  } catch (err) {
    console.error("[events GET] DB error loading user:", err);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const originLat = clientLat ?? user.latitude;
  const originLng = clientLng ?? user.longitude;

  if (originLat == null || originLng == null) {
    return Response.json({ error: "Location required" }, { status: 400 });
  }

  const prefs = user.preferences;
  const defaultPrefs = {
    disabledCategories: [] as Category[],
    maxDistanceMiles: 25,
    dateRangeDays: 30,
    priceMin: null,
    priceMax: null,
    experienceType: "BOTH" as const,
    familyFriendly: false,
  };

  let disabledCategories: Category[] = defaultPrefs.disabledCategories;
  if (prefs) {
    const raw = prefs.disabledCategories;
    if (Array.isArray(raw)) {
      disabledCategories = (raw as unknown[]).filter(
        (v): v is Category =>
          typeof v === "string" && Object.values(Category).includes(v as Category)
      );
    }
  }

  const userPreferences = {
    disabledCategories,
    maxDistanceMiles: prefs?.maxDistanceMiles ?? defaultPrefs.maxDistanceMiles,
    dateRangeDays: prefs?.dateRangeDays ?? defaultPrefs.dateRangeDays,
    priceMin: prefs?.priceMin ?? defaultPrefs.priceMin,
    priceMax: prefs?.priceMax ?? defaultPrefs.priceMax,
    experienceType: (prefs?.experienceType ??
      defaultPrefs.experienceType) as ExperienceType,
    familyFriendly: prefs?.familyFriendly ?? defaultPrefs.familyFriendly,
  };

  const userIsPro = isPro(
    user.subscription as { status: import("@prisma/client").SubscriptionStatus } | null
  );

  try {
    const page = await getFeedPage({
      userId: session.user.id,
      userPreferences,
      isPro: userIsPro,
      origin: { lat: originLat, lng: originLng },
      filters: {
        q,
        categories: cat,
        distanceMi: dist,
        dateRangeDays: days,
        priceMin: pmin,
        priceMax: pmax,
        experienceType: exp,
        familyFriendly: family,
        freeOnly: free,
        timeOfDay: time,
        venue,
      },
      cursor: cursor ?? null,
      limit,
    });

    return Response.json(page);
  } catch (err) {
    console.error("[events GET] Feed query error:", err);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
