import "server-only";
import type { Category } from "@prisma/client";
import type { NormalizedEventInput, ProviderAdapter } from "./types";
import { assertHttpsUrl } from "./url";
import { parseLocalDateTime as parseLocalDateTimeShared } from "./timezone";

const ACTOR_ID = "filip_cicvarek/meetup-scraper";

const TARGET_METROS: ReadonlyArray<{
  name: string;
  city: string;
  state: string;
}> = [
  { name: "NYC", city: "New York City", state: "NY" },
  { name: "LA", city: "Los Angeles", state: "CA" },
  { name: "Chicago", city: "Chicago", state: "IL" },
  { name: "SF", city: "San Francisco", state: "CA" },
  { name: "Austin", city: "Austin", state: "TX" },
];

type MeetupTopic = string;

const TOPIC_TO_CATEGORY: Record<MeetupTopic, Category> = {
  "Tech": "NETWORKING",
  "Technology": "NETWORKING",
  "JavaScript": "NETWORKING",
  "Python": "NETWORKING",
  "Startup": "NETWORKING",
  "Networking": "NETWORKING",
  "Business": "NETWORKING",
  "Entrepreneurship": "NETWORKING",
  "Music": "MUSIC",
  "Arts": "ARTS_THEATER",
  "Theater": "ARTS_THEATER",
  "Photography": "ARTS_THEATER",
  "Film": "ARTS_THEATER",
  "Dance": "ARTS_THEATER",
  "Food & Drink": "FOOD_DRINK",
  "Food": "FOOD_DRINK",
  "Wine": "FOOD_DRINK",
  "Cooking": "FOOD_DRINK",
  "Health & Wellness": "HEALTH_WELLNESS",
  "Fitness": "HEALTH_WELLNESS",
  "Yoga": "HEALTH_WELLNESS",
  "Meditation": "HEALTH_WELLNESS",
  "Running": "HEALTH_WELLNESS",
  "Outdoors & Adventure": "OUTDOOR_ADVENTURE",
  "Hiking": "OUTDOOR_ADVENTURE",
  "Outdoors": "OUTDOOR_ADVENTURE",
  "Adventure": "OUTDOOR_ADVENTURE",
  "Cycling": "OUTDOOR_ADVENTURE",
  "Family": "FAMILY_FRIENDLY",
  "Kids": "FAMILY_FRIENDLY",
  "Parenting": "FAMILY_FRIENDLY",
  "Community": "COMMUNITY_CULTURE",
  "Culture": "COMMUNITY_CULTURE",
  "Language": "COMMUNITY_CULTURE",
  "Social": "COMMUNITY_CULTURE",
  "Nightlife": "NIGHTLIFE",
  "Night Life": "NIGHTLIFE",
  "Bar": "NIGHTLIFE",
  "Party": "NIGHTLIFE",
  "Education": "EDUCATION",
  "Learning": "EDUCATION",
  "Book Club": "EDUCATION",
  "Science": "EDUCATION",
  "Sports": "SPORTS",
  "Basketball": "SPORTS",
  "Soccer": "SPORTS",
  "Tennis": "SPORTS",
  "Volleyball": "SPORTS",
};

interface MeetupVenue {
  name?: string;
  lat?: number;
  lon?: number;
  address?: string;
}

interface MeetupTopicObject {
  id?: string;
  name?: string;
  urlkey?: string;
}

interface MeetupEvent {
  eventId?: string;
  eventName?: string;
  eventDescription?: string;
  eventUrl?: string;
  startDateTime?: string;
  endDateTime?: string;
  timezone?: string;
  isOnline?: boolean;
  eventType?: string;
  isPaidEvent?: boolean;
  feeAmount?: number;
  feeCurrency?: string;
  topics?: Array<MeetupTopicObject | string>;
  featuredPhotoUrl?: string;
  venue?: MeetupVenue | null;
  group?: { name?: string };
}

function mapCategory(topics: Array<MeetupTopicObject | string>): Category {
  const names = topics.map((t) => (typeof t === "string" ? t : t.name ?? "")).filter(Boolean);
  for (const name of names) {
    const mapped = TOPIC_TO_CATEGORY[name];
    if (mapped) return mapped;
  }
  if (names.length > 0) {
    console.warn(
      JSON.stringify({
        event: "meetup.unmapped_topics",
        topics: names,
        action: "fallback_to_OTHER",
      })
    );
  }
  return "OTHER";
}

const parseLocalDateTime = (dateTimeStr: string, timezone: string) =>
  parseLocalDateTimeShared(dateTimeStr, timezone, "meetup");

function normalizeEvent(raw: MeetupEvent): NormalizedEventInput | null {
  // Feed is location-based; online-only events have no meaningful physical location.
  if (raw.isOnline || raw.eventType === "ONLINE" || !raw.venue) {
    console.warn(
      JSON.stringify({
        event: "meetup.skip_no_venue",
        externalId: raw.eventId,
        online: raw.isOnline || raw.eventType === "ONLINE",
        action: "skip",
      })
    );
    return null;
  }

  const venue = raw.venue;
  const lat = venue.lat;
  const lng = venue.lon;
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
    console.warn(
      JSON.stringify({
        event: "meetup.skip_no_geo",
        externalId: raw.eventId,
        venueName: venue.name,
        action: "skip",
      })
    );
    return null;
  }

  const dateTimeStr = raw.startDateTime;
  if (!dateTimeStr) {
    console.warn(
      JSON.stringify({
        event: "meetup.skip_no_start_time",
        externalId: raw.eventId,
        action: "skip",
      })
    );
    return null;
  }

  const timezone = raw.timezone ?? "UTC";
  const startTime = parseLocalDateTime(dateTimeStr, timezone);
  if (startTime <= new Date()) return null;

  const endTime = raw.endDateTime
    ? parseLocalDateTime(raw.endDateTime, timezone)
    : undefined;

  // feeAmount is in whole currency units, not cents.
  const isFree = raw.isPaidEvent === false || raw.isPaidEvent == null;
  const price = !isFree && raw.feeAmount != null
    ? Math.round(raw.feeAmount * 100)
    : undefined;

  const category = mapCategory(raw.topics ?? []);

  const title = (raw.eventName ?? "").trim().replace(/\s+/g, " ");
  const venueName = venue.name ?? venue.address ?? "Unknown Venue";

  const externalId = raw.eventId ?? raw.eventUrl ?? title;

  return {
    provider: "MEETUP",
    externalId,
    title,
    description: raw.eventDescription ?? undefined,
    imageUrl: raw.featuredPhotoUrl ?? undefined,
    startTime,
    endTime,
    venue: venueName,
    latitude: lat,
    longitude: lng,
    price,
    isFree,
    category,
    ticketUrl: assertHttpsUrl(raw.eventUrl, `https://www.meetup.com/events/${externalId}`),
  };
}

export const meetupAdapter: ProviderAdapter = {
  provider: "MEETUP",
  metroFailures: [],

  async *fetchEvents(): AsyncGenerator<NormalizedEventInput, void, undefined> {
    const apifyToken = process.env.APIFY_API_TOKEN;
    if (!apifyToken) {
      console.warn(
        JSON.stringify({
          event: "meetup.skip_missing_token",
          action: "provider_skipped",
        })
      );
      return;
    }

    const { ApifyClient } = await import("apify-client");
    const client = new ApifyClient({ token: apifyToken });

    for (const metro of TARGET_METROS) {
      let run: { defaultDatasetId: string; status: string };
      try {
        run = await client.actor(ACTOR_ID).call({
          city: metro.city,
          state: metro.state,
          country: "us",
          maxResults: 200,
          maxItems: 200,
        }) as { defaultDatasetId: string; status: string };
      } catch (err) {
        console.error(
          JSON.stringify({
            event: "meetup.actor_run_failed",
            metro: metro.name,
            error: String(err),
            action: "skip_metro",
          })
        );
        meetupAdapter.metroFailures.push(metro.name);
        continue;
      }

      if (run.status !== "SUCCEEDED") {
        console.warn(
          JSON.stringify({
            event: "meetup.actor_run_non_success",
            metro: metro.name,
            status: run.status,
            action: "skip_metro",
          })
        );
        meetupAdapter.metroFailures.push(metro.name);
        continue;
      }

      const CHUNK_SIZE = 100;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const result = await client
          .dataset(run.defaultDatasetId)
          .listItems({ limit: CHUNK_SIZE, offset });

        const items = result.items as MeetupEvent[];
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
