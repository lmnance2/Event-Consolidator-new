import "server-only";
import { Category, ExperienceType, Provider, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { haversineMeters } from "@/lib/geo/haversine";
import { encodeCursor, decodeCursor } from "@/lib/events/cursor";
import { pickPrimarySource } from "@/lib/events/primary-source";

const METERS_PER_MILE = 1609.344;
const DEGREES_LAT_PER_MILE = 1 / 69;
const MAX_LOOP_ITERATIONS = 10;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export interface FeedFilters {
  q?: string;
  categories?: Category[];
  distanceMi?: number;
  dateRangeDays?: number;
  priceMin?: number | null;
  priceMax?: number | null;
  experienceType?: ExperienceType;
  familyFriendly?: boolean;
  freeOnly?: boolean;
  timeOfDay?: "MORNING" | "AFTERNOON" | "EVENING";
  venue?: string;
}

export interface FeedRow {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  startTime: string;
  endTime: string | null;
  venueName: string;
  venueAddress: string;
  latitude: number;
  longitude: number;
  distanceMi: number;
  category: Category;
  priceMin: number | null;
  priceMax: number | null;
  isFree: boolean;
  performerName: string | null;
  ticketUrl: string;
  provider: Provider;
}

export interface FeedPage {
  rows: FeedRow[];
  nextCursor: string | null;
}

export interface UserPreferencesInput {
  disabledCategories: Category[];
  maxDistanceMiles: number;
  dateRangeDays: number;
  priceMin?: number | null;
  priceMax?: number | null;
  experienceType: ExperienceType;
  familyFriendly: boolean;
}

export interface FeedQueryInput {
  userId: string;
  userPreferences: UserPreferencesInput;
  isPro: boolean;
  origin: { lat: number; lng: number };
  filters: FeedFilters;
  cursor: string | null;
  limit?: number;
}

function timeOfDayHours(
  band: "MORNING" | "AFTERNOON" | "EVENING"
): { from: number; to: number } {
  if (band === "MORNING") return { from: 6, to: 12 };
  if (band === "AFTERNOON") return { from: 12, to: 17 };
  return { from: 17, to: 24 };
}

export async function getFeedPage(input: FeedQueryInput): Promise<FeedPage> {
  const limit = Math.min(
    Math.max(1, input.limit ?? DEFAULT_LIMIT),
    MAX_LIMIT
  );
  const prefs = input.userPreferences;

  const rawFilters: FeedFilters = input.isPro
    ? { ...input.filters }
    : {
        q: input.filters.q,
        categories: input.filters.categories,
        distanceMi: input.filters.distanceMi,
        dateRangeDays: input.filters.dateRangeDays,
        priceMin: input.filters.priceMin,
        priceMax: input.filters.priceMax,
      };

  const distanceMi = rawFilters.distanceMi ?? prefs.maxDistanceMiles;
  const dateRangeDays = rawFilters.dateRangeDays ?? prefs.dateRangeDays;
  const effectivePriceMin =
    rawFilters.priceMin !== undefined ? rawFilters.priceMin : prefs.priceMin;
  const effectivePriceMax =
    rawFilters.priceMax !== undefined ? rawFilters.priceMax : prefs.priceMax;

  const enabledCategories =
    rawFilters.categories !== undefined
      ? rawFilters.categories
      : (Object.values(Category) as Category[]).filter(
          (c) => !prefs.disabledCategories.includes(c)
        );

  const now = new Date();
  const dateHorizon = new Date(now.getTime() + dateRangeDays * 86_400_000);

  const latDelta = distanceMi * DEGREES_LAT_PER_MILE;
  const lngDelta =
    distanceMi /
    (69 * Math.max(Math.cos((input.origin.lat * Math.PI) / 180), 0.0001));

  const latMin = input.origin.lat - latDelta;
  const latMax = input.origin.lat + latDelta;
  const lngMin = input.origin.lng - lngDelta;
  const lngMax = input.origin.lng + lngDelta;

  const distanceMeters = distanceMi * METERS_PER_MILE;
  const fetchBatch = limit * 3;

  const collected: FeedRow[] = [];
  let lastScannedCursor: string | null = null;
  let afterCursor = input.cursor;

  for (let iteration = 0; iteration < MAX_LOOP_ITERATIONS; iteration++) {
    let cursorStartTime: Date | undefined;
    let cursorId: string | undefined;

    if (afterCursor !== null) {
      const decoded = decodeCursor(afterCursor);
      if (decoded) {
        cursorStartTime = new Date(decoded.startTime);
        cursorId = decoded.id;
      } else {
        afterCursor = null;
      }
    }

    const where: Prisma.EventWhereInput = {
      isActive: true,
      startTime: { gte: now, lte: dateHorizon },
      latitude: { gte: latMin, lte: latMax },
      longitude: { gte: lngMin, lte: lngMax },
      category: { in: enabledCategories.length > 0 ? enabledCategories : [] },
    };

    if (rawFilters.q) {
      where.OR = [
        { title: { contains: rawFilters.q, mode: "insensitive" } },
        { performerName: { contains: rawFilters.q, mode: "insensitive" } },
      ];
    }

    if (effectivePriceMin != null && effectivePriceMax != null) {
      where.price = { gte: effectivePriceMin, lte: effectivePriceMax };
    } else if (effectivePriceMin != null) {
      where.price = { gte: effectivePriceMin };
    } else if (effectivePriceMax != null) {
      where.price = { lte: effectivePriceMax };
    }

    if (rawFilters.freeOnly) {
      where.isFree = true;
    }

    if (rawFilters.venue) {
      where.venue = { contains: rawFilters.venue, mode: "insensitive" };
    }

    if (cursorStartTime !== undefined && cursorId !== undefined) {
      where.AND = [
        {
          OR: [
            { startTime: { gt: cursorStartTime } },
            { AND: [{ startTime: cursorStartTime }, { id: { gt: cursorId } }] },
          ],
        },
      ];
    }

    const rawRows = await prisma.event.findMany({
      where,
      orderBy: [{ startTime: "asc" }, { id: "asc" }],
      take: fetchBatch,
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        startTime: true,
        endTime: true,
        venue: true,
        latitude: true,
        longitude: true,
        price: true,
        isFree: true,
        category: true,
        performerName: true,
        sources: {
          select: { provider: true, ticketUrl: true },
        },
      },
    });

    if (rawRows.length === 0) {
      break;
    }

    const lastRow = rawRows[rawRows.length - 1]!;
    lastScannedCursor = encodeCursor({
      startTime: lastRow.startTime.toISOString(),
      id: lastRow.id,
    });
    afterCursor = lastScannedCursor;

    for (const row of rawRows) {
      const distM = haversineMeters(
        input.origin.lat,
        input.origin.lng,
        row.latitude,
        row.longitude
      );

      if (distM > distanceMeters) continue;

      if (rawFilters.timeOfDay !== undefined) {
        // timeOfDay filters on UTC hours. Correct fix is a stored local-hour field on Event (populated at ingest). Tracked as a known limitation until the schema supports venue timezones.
        const hour = row.startTime.getUTCHours();
        const { from, to } = timeOfDayHours(rawFilters.timeOfDay);
        if (hour < from || hour >= to) continue;
      }

      const source = pickPrimarySource(row.sources);
      if (!source) continue;

      const distanceMiRounded = Math.round((distM / METERS_PER_MILE) * 10) / 10;

      collected.push({
        id: row.id,
        title: row.title,
        description: row.description,
        imageUrl: row.imageUrl,
        startTime: row.startTime.toISOString(),
        endTime: row.endTime ? row.endTime.toISOString() : null,
        venueName: row.venue ?? "",
        venueAddress: row.venue ?? "",
        latitude: row.latitude,
        longitude: row.longitude,
        distanceMi: distanceMiRounded,
        category: row.category,
        priceMin: row.price !== null ? row.price : null,
        priceMax: null,
        isFree: row.isFree,
        performerName: row.performerName,
        ticketUrl: source.ticketUrl,
        provider: source.provider,
      });

      if (collected.length >= limit) break;
    }

    if (collected.length >= limit) break;

    if (rawRows.length < fetchBatch) {
      lastScannedCursor = null;
      break;
    }
  }

  const nextCursor =
    collected.length >= limit ? lastScannedCursor : null;

  return {
    rows: collected.slice(0, limit),
    nextCursor,
  };
}
