import "server-only";
import type { Category } from "@prisma/client";
import type { NormalizedEventInput, ProviderAdapter } from "./types";
import { assertHttpsUrl } from "./url";

const BASE_URL = "https://app.ticketmaster.com/discovery/v2/events.json";
const PAGE_SIZE = 200;

const METROS: ReadonlyArray<{ name: string; latlong: string }> = [
  { name: "NYC", latlong: "40.7128,-74.0060" },
  { name: "LA", latlong: "34.0522,-118.2437" },
  { name: "Chicago", latlong: "41.8781,-87.6298" },
  { name: "SF", latlong: "37.7749,-122.4194" },
  { name: "Austin", latlong: "30.2672,-97.7431" },
];

const METRO_RADIUS_MILES = "50";

type TmSegmentName =
  | "Music"
  | "Sports"
  | "Arts & Theatre"
  | "Film"
  | "Miscellaneous"
  | "Undefined"
  | string;

const SEGMENT_TO_CATEGORY: Record<string, Category> = {
  Music: "MUSIC",
  Sports: "SPORTS",
  "Arts & Theatre": "ARTS_THEATER",
  Film: "ARTS_THEATER",
  Miscellaneous: "OTHER",
  Undefined: "OTHER",
};

const GENRE_TO_CATEGORY: Record<string, Category> = {
  Comedy: "ARTS_THEATER",
  Family: "FAMILY_FRIENDLY",
  "Family - Kids": "FAMILY_FRIENDLY",
  Dance: "NIGHTLIFE",
  "Club Events": "NIGHTLIFE",
  Food: "FOOD_DRINK",
  "Culinary Arts": "FOOD_DRINK",
  Running: "HEALTH_WELLNESS",
  Yoga: "HEALTH_WELLNESS",
  Hiking: "OUTDOOR_ADVENTURE",
  Outdoor: "OUTDOOR_ADVENTURE",
  Conference: "NETWORKING",
  Convention: "NETWORKING",
  Education: "EDUCATION",
  Lecture: "EDUCATION",
  "Community / Civic": "COMMUNITY_CULTURE",
  Cultural: "COMMUNITY_CULTURE",
  Nightclub: "NIGHTLIFE",
  Bar: "NIGHTLIFE",
};

interface TmImage {
  ratio?: string;
  url: string;
  width?: number;
  height?: number;
  fallback?: boolean;
}

interface TmClassification {
  primary?: boolean;
  segment?: { id: string; name: string };
  genre?: { id: string; name: string };
  subGenre?: { id: string; name: string };
  type?: { id: string; name: string };
  family?: boolean;
}

interface TmPriceRange {
  type?: string;
  currency?: string;
  min?: number;
  max?: number;
}

interface TmVenue {
  name?: string;
  location?: { latitude?: string; longitude?: string };
  address?: { line1?: string };
  city?: { name?: string };
  state?: { stateCode?: string };
}

interface TmAttraction {
  name?: string;
}

interface TmEvent {
  id: string;
  name: string;
  url?: string;
  images?: TmImage[];
  dates?: {
    start?: {
      dateTime?: string;
      dateTBD?: boolean;
      dateTBC?: boolean;
      noSpecificTime?: boolean;
    };
    end?: { dateTime?: string };
  };
  classifications?: TmClassification[];
  priceRanges?: TmPriceRange[];
  _embedded?: {
    venues?: TmVenue[];
    attractions?: TmAttraction[];
  };
}

interface TmResponse {
  _embedded?: { events?: TmEvent[] };
  page?: { size: number; totalElements: number; totalPages: number; number: number };
}

function pickBestImage(images: TmImage[]): string | undefined {
  if (!images.length) return undefined;
  const sorted = [...images].sort(
    (a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0)
  );
  return sorted[0].url;
}

function mapCategory(classifications: TmClassification[]): Category {
  const primary = classifications.find((c) => c.primary) ?? classifications[0];
  if (!primary) return "OTHER";

  if (primary.family) return "FAMILY_FRIENDLY";

  const genreName = primary.genre?.name as TmSegmentName | undefined;
  if (genreName && GENRE_TO_CATEGORY[genreName]) {
    return GENRE_TO_CATEGORY[genreName];
  }

  const segmentName = primary.segment?.name as TmSegmentName | undefined;
  if (segmentName) {
    const mapped = SEGMENT_TO_CATEGORY[segmentName];
    if (mapped) return mapped;
    console.warn(
      JSON.stringify({
        event: "ticketmaster.unmapped_segment",
        segment: segmentName,
        genre: genreName,
        action: "fallback_to_OTHER",
      })
    );
  }

  return "OTHER";
}

async function fetchPage(
  apiKey: string,
  latlong: string,
  page: number,
  signal?: AbortSignal
): Promise<TmResponse> {
  const url = new URL(BASE_URL);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("latlong", latlong);
  url.searchParams.set("radius", METRO_RADIUS_MILES);
  url.searchParams.set("unit", "miles");
  url.searchParams.set("size", String(PAGE_SIZE));
  url.searchParams.set("page", String(page));
  url.searchParams.set("sort", "date,asc");
  url.searchParams.set("startDateTime", new Date().toISOString().replace(/\.\d{3}Z$/, "Z"));
  url.searchParams.set("includeTest", "no");

  let delayMs = 500;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url.toString(), { signal });
    if (res.status === 429) {
      console.warn(
        JSON.stringify({
          event: "ticketmaster.rate_limited",
          attempt,
          delayMs,
          action: "backoff",
        })
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * 2, 8_000);
      continue;
    }
    if (!res.ok) {
      throw new Error(`[ticketmaster] HTTP ${res.status} fetching page ${page}`);
    }
    return res.json() as Promise<TmResponse>;
  }
  throw new Error("[ticketmaster] Exceeded retry budget after repeated 429s");
}

function normalizeEvent(event: TmEvent): NormalizedEventInput | null {
  const venue = event._embedded?.venues?.[0];
  const lat = parseFloat(venue?.location?.latitude ?? "");
  const lng = parseFloat(venue?.location?.longitude ?? "");

  if (!venue || isNaN(lat) || isNaN(lng)) {
    console.warn(
      JSON.stringify({
        event: "ticketmaster.skip_no_geo",
        externalId: event.id,
        title: event.name,
        action: "skip",
      })
    );
    return null;
  }

  const startDateTime = event.dates?.start?.dateTime;
  if (!startDateTime) {
    console.warn(
      JSON.stringify({
        event: "ticketmaster.skip_no_start_time",
        externalId: event.id,
        action: "skip",
      })
    );
    return null;
  }

  const startTime = new Date(startDateTime);
  if (startTime <= new Date()) return null;

  const endDateTime = event.dates?.end?.dateTime;
  const endTime = endDateTime ? new Date(endDateTime) : undefined;

  const venueName = [
    venue.name,
    venue.city?.name,
    venue.state?.stateCode,
  ]
    .filter(Boolean)
    .join(", ");

  const classifications = event.classifications ?? [];
  const category = mapCategory(classifications);

  const priceRange = event.priceRanges?.[0];
  const isFree = priceRange != null && priceRange.min === 0 && priceRange.max === 0;
  const price = priceRange?.min != null && priceRange.min > 0
    ? Math.round(priceRange.min * 100)
    : undefined;

  const images = event.images ?? [];
  const imageUrl = pickBestImage(images);

  const performer = event._embedded?.attractions?.[0]?.name;

  const title = event.name.trim().replace(/\s+/g, " ");

  return {
    provider: "TICKETMASTER",
    externalId: event.id,
    title,
    imageUrl,
    startTime,
    endTime,
    venue: venueName,
    latitude: lat,
    longitude: lng,
    price,
    isFree,
    category,
    performerName: performer,
    ticketUrl: assertHttpsUrl(event.url, `https://www.ticketmaster.com/event/${event.id}`),
  };
}

export const ticketmasterAdapter: ProviderAdapter = {
  provider: "TICKETMASTER",
  metroFailures: [],

  async *fetchEvents(): AsyncGenerator<NormalizedEventInput, void, undefined> {
    const apiKey = process.env.TICKETMASTER_API_KEY;
    if (!apiKey) {
      console.warn(
        JSON.stringify({
          event: "ticketmaster.skip_missing_key",
          action: "provider_skipped",
        })
      );
      return;
    }

    for (const metro of METROS) {
      let page = 0;
      let totalPages = 1;
      let metroFailed = false;

      while (page < totalPages) {
        let response: TmResponse;
        try {
          response = await fetchPage(apiKey, metro.latlong, page);
        } catch (err) {
          console.error(
            JSON.stringify({
              event: "ticketmaster.fetch_error",
              metro: metro.name,
              page,
              error: String(err),
              action: "abort_metro",
            })
          );
          metroFailed = true;
          break;
        }

        totalPages = response.page?.totalPages ?? 1;
        const events = response._embedded?.events ?? [];

        for (const raw of events) {
          const normalized = normalizeEvent(raw);
          if (normalized) yield normalized;
        }

        page++;

        if (page < totalPages) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      if (metroFailed) {
        ticketmasterAdapter.metroFailures.push(metro.name);
      }
    }
  },
};
