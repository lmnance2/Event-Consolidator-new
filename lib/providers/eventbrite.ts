import "server-only";
import { assertHttpsUrl } from "./url";
// Actor: automation-lab/eventbrite-scraper
// Replaces direct Eventbrite REST calls — /v3/events/search/ was retired Dec 2019.
// Input: { searchQuery, location (Eventbrite slug "state--city"), maxResults }
// Output items include: name, description, url, start_date, end_date, is_free,
//   category, venue { name, lat, lng, address }, ticket_info { min_price }
import type { Category } from "@prisma/client";
import type { NormalizedEventInput, ProviderAdapter } from "./types";

const ACTOR_ID =
  process.env.APIFY_EVENTBRITE_ACTOR_ID ?? "automation-lab/eventbrite-scraper";

const METROS: ReadonlyArray<{ name: string; location: string }> = [
  { name: "NYC", location: "ny--new-york" },
  { name: "LA", location: "ca--los-angeles" },
  { name: "Chicago", location: "il--chicago" },
  { name: "SF", location: "ca--san-francisco" },
  { name: "Austin", location: "tx--austin" },
];

type EbScraperCategoryName = string;

const CATEGORY_NAME_MAP: Record<EbScraperCategoryName, Category> = {
  "Music": "MUSIC",
  "Business & Professional": "NETWORKING",
  "Food & Drink": "FOOD_DRINK",
  "Community & Culture": "COMMUNITY_CULTURE",
  "Performing & Visual Arts": "ARTS_THEATER",
  "Film, Media & Entertainment": "ARTS_THEATER",
  "Sports & Fitness": "SPORTS",
  "Health & Wellness": "HEALTH_WELLNESS",
  "Science & Technology": "NETWORKING",
  "Travel & Outdoor": "OUTDOOR_ADVENTURE",
  "Charity & Causes": "COMMUNITY_CULTURE",
  "Religion & Spirituality": "COMMUNITY_CULTURE",
  "Family & Education": "FAMILY_FRIENDLY",
  "Hobbies & Special Interest": "OTHER",
  "Government & Politics": "OTHER",
  "Fashion & Beauty": "OTHER",
  "Home & Lifestyle": "OTHER",
  "Auto, Boat & Air": "OTHER",
  "Nightlife": "NIGHTLIFE",
  "School Activities": "EDUCATION",
};

interface EbScraperVenue {
  name?: string;
  lat?: number | string;
  lng?: number | string;
  address?: string;
}

interface EbScraperTicketInfo {
  min_price?: number | null;
  is_free?: boolean;
}

interface EbScraperEvent {
  id?: string;
  name?: string;
  description?: string;
  url?: string;
  start_date?: string;
  end_date?: string;
  is_free?: boolean;
  category?: string;
  image?: string;
  venue?: EbScraperVenue | null;
  ticket_info?: EbScraperTicketInfo | null;
}

function mapCategory(categoryName: string | undefined): Category {
  if (!categoryName) return "OTHER";
  const mapped = CATEGORY_NAME_MAP[categoryName];
  if (mapped) return mapped;
  console.warn(
    JSON.stringify({
      event: "eventbrite.unmapped_category",
      categoryName,
      action: "fallback_to_OTHER",
    })
  );
  return "OTHER";
}

function normalizeEvent(raw: EbScraperEvent): NormalizedEventInput | null {
  const venue = raw.venue;
  if (!venue) {
    console.warn(
      JSON.stringify({
        event: "eventbrite.skip_no_venue",
        externalId: raw.id,
        action: "skip",
      })
    );
    return null;
  }

  const lat = typeof venue.lat === "string" ? parseFloat(venue.lat) : (venue.lat ?? NaN);
  const lng = typeof venue.lng === "string" ? parseFloat(venue.lng) : (venue.lng ?? NaN);
  if (isNaN(lat) || isNaN(lng)) {
    console.warn(
      JSON.stringify({
        event: "eventbrite.skip_no_geo",
        externalId: raw.id,
        venueName: venue.name,
        action: "skip",
      })
    );
    return null;
  }

  const startDateStr = raw.start_date;
  if (!startDateStr) {
    console.warn(
      JSON.stringify({
        event: "eventbrite.skip_no_start_time",
        externalId: raw.id,
        action: "skip",
      })
    );
    return null;
  }

  const startTime = new Date(startDateStr);
  if (isNaN(startTime.getTime()) || startTime <= new Date()) return null;

  const endDateStr = raw.end_date;
  const endTime = endDateStr ? new Date(endDateStr) : undefined;

  const isFree = raw.is_free ?? raw.ticket_info?.is_free ?? false;
  const minPriceCents =
    !isFree && raw.ticket_info?.min_price != null && raw.ticket_info.min_price > 0
      ? Math.round(raw.ticket_info.min_price * 100)
      : undefined;

  const title = (raw.name ?? "").trim().replace(/\s+/g, " ");
  const venueName = venue.name ?? venue.address ?? "Unknown Venue";
  const externalId = raw.id ?? raw.url ?? title;

  return {
    provider: "EVENTBRITE",
    externalId,
    title,
    description: raw.description ?? undefined,
    imageUrl: raw.image ?? undefined,
    startTime,
    endTime,
    venue: venueName,
    latitude: lat,
    longitude: lng,
    price: minPriceCents,
    isFree,
    category: mapCategory(raw.category),
    ticketUrl: assertHttpsUrl(raw.url, `https://www.eventbrite.com/e/${raw.id ?? externalId}`),
  };
}

export const eventbriteAdapter: ProviderAdapter = {
  provider: "EVENTBRITE",
  metroFailures: [],

  async *fetchEvents(): AsyncGenerator<NormalizedEventInput, void, undefined> {
    const apifyToken = process.env.APIFY_API_TOKEN;
    if (!apifyToken) {
      console.warn(
        JSON.stringify({
          event: "eventbrite.skip_missing_token",
          action: "provider_skipped",
        })
      );
      return;
    }

    const { ApifyClient } = await import("apify-client");
    const client = new ApifyClient({ token: apifyToken });

    for (const metro of METROS) {
      let run: { defaultDatasetId: string; status: string };
      try {
        run = await client.actor(ACTOR_ID).call({
          location: metro.location,
          maxResults: 200,
        }) as { defaultDatasetId: string; status: string };
      } catch (err) {
        console.error(
          JSON.stringify({
            event: "eventbrite.actor_run_failed",
            metro: metro.name,
            error: String(err),
            action: "skip_metro",
          })
        );
        eventbriteAdapter.metroFailures.push(metro.name);
        continue;
      }

      if (run.status !== "SUCCEEDED") {
        console.warn(
          JSON.stringify({
            event: "eventbrite.actor_run_non_success",
            metro: metro.name,
            status: run.status,
            action: "skip_metro",
          })
        );
        eventbriteAdapter.metroFailures.push(metro.name);
        continue;
      }

      const CHUNK_SIZE = 100;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const result = await client
          .dataset(run.defaultDatasetId)
          .listItems({ limit: CHUNK_SIZE, offset });

        const items = result.items as EbScraperEvent[];
        for (const raw of items) {
          const normalized = normalizeEvent(raw);
          if (normalized) yield normalized;
        }

        if (items.length < CHUNK_SIZE) {
          hasMore = false;
        } else {
          offset += CHUNK_SIZE;
        }
      }
    }
  },
};
