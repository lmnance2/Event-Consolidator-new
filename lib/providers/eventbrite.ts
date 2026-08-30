import "server-only";
import { assertHttpsUrl } from "./url";
// Apify Task (not a raw actor) — task holds a pre-saved input; we override
// city/country/maxResults per-metro. Override the id via APIFY_EVENTBRITE_TASK_ID.
// Input: { country, city, maxResults, enrichOrganizers } — country/city are
//   full-name lowercase (e.g. "united states", "new york").
// Output flat fields include: eventbrite_event_id, name, summary, url,
//   image_url, start_datetime, end_date, end_time, timezone, latitude/longitude
//   (strings), venue_address, is_online_event, status, tags[].
import type { Category } from "@prisma/client";
import type { NormalizedEventInput, ProviderAdapter } from "./types";
import { parseLocalDateTime as parseLocalDateTimeShared } from "./timezone";

const TASK_ID =
  process.env.APIFY_EVENTBRITE_TASK_ID ?? "u1GK6rfogRmTlU5rK";

// Actor requires hyphen-separated slug-style values (per its input schema
// error listing: "united-states", "new-york", "los-angeles", ...).
const METROS: ReadonlyArray<{ name: string; city: string; country: string }> = [
  { name: "NYC", city: "new-york", country: "united-states" },
  { name: "LA", city: "los-angeles", country: "united-states" },
  { name: "Chicago", city: "chicago", country: "united-states" },
  { name: "SF", city: "san-francisco", country: "united-states" },
  { name: "Austin", city: "austin", country: "united-states" },
];

const CATEGORY_TAG_MAP: Record<string, Category> = {
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

interface EbEvent {
  eventbrite_event_id?: string;
  name?: string;
  summary?: string;
  url?: string;
  image_url?: string;
  start_date?: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  timezone?: string;
  start_datetime?: string;
  latitude?: string | number;
  longitude?: string | number;
  venue_address?: string;
  is_online_event?: boolean;
  status?: string;
  tags?: string[];
}

function mapCategory(tags: string[] | undefined): Category {
  if (!tags || tags.length === 0) return "OTHER";
  for (const tag of tags) {
    const mapped = CATEGORY_TAG_MAP[tag];
    if (mapped) return mapped;
  }
  console.warn(
    JSON.stringify({
      event: "eventbrite.unmapped_category",
      tags,
      action: "fallback_to_OTHER",
    })
  );
  return "OTHER";
}

const parseLocalDateTime = (dateTimeStr: string, timezone: string) =>
  parseLocalDateTimeShared(dateTimeStr, timezone, "eventbrite");

function normalizeEvent(raw: EbEvent): NormalizedEventInput | null {
  if (raw.is_online_event) {
    console.warn(
      JSON.stringify({
        event: "eventbrite.skip_online",
        externalId: raw.eventbrite_event_id,
        action: "skip",
      })
    );
    return null;
  }

  if (raw.status && raw.status.toLowerCase() === "cancelled") {
    console.warn(
      JSON.stringify({
        event: "eventbrite.skip_cancelled",
        externalId: raw.eventbrite_event_id,
        action: "skip",
      })
    );
    return null;
  }

  const lat = typeof raw.latitude === "string" ? parseFloat(raw.latitude) : (raw.latitude ?? NaN);
  const lng = typeof raw.longitude === "string" ? parseFloat(raw.longitude) : (raw.longitude ?? NaN);
  if (isNaN(lat) || isNaN(lng)) {
    console.warn(
      JSON.stringify({
        event: "eventbrite.skip_no_geo",
        externalId: raw.eventbrite_event_id,
        action: "skip",
      })
    );
    return null;
  }

  const timezone = raw.timezone ?? "UTC";
  const startInput = raw.start_datetime
    ?? (raw.start_date && raw.start_time ? `${raw.start_date}T${raw.start_time}` : undefined);
  if (!startInput) {
    console.warn(
      JSON.stringify({
        event: "eventbrite.skip_no_start_time",
        externalId: raw.eventbrite_event_id,
        action: "skip",
      })
    );
    return null;
  }

  const startTime = parseLocalDateTime(startInput, timezone);
  if (isNaN(startTime.getTime()) || startTime <= new Date()) return null;

  const endInput = raw.end_date && raw.end_time
    ? `${raw.end_date}T${raw.end_time}`
    : undefined;
  const endTime = endInput ? parseLocalDateTime(endInput, timezone) : undefined;

  const title = (raw.name ?? "").trim().replace(/\s+/g, " ");
  const venue = raw.venue_address?.trim() || "Unknown Venue";
  const externalId = raw.eventbrite_event_id ?? raw.url ?? title;

  return {
    provider: "EVENTBRITE",
    externalId,
    title,
    description: raw.summary ?? undefined,
    imageUrl: raw.image_url ?? undefined,
    startTime,
    endTime,
    venue,
    latitude: lat,
    longitude: lng,
    isFree: false,
    category: mapCategory(raw.tags),
    ticketUrl: assertHttpsUrl(raw.url, `https://www.eventbrite.com/e/${externalId}`),
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
        run = await client.task(TASK_ID).call({
          country: metro.country,
          city: metro.city,
          maxResults: 200,
          enrichOrganizers: false,
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

        const items = result.items as EbEvent[];
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
