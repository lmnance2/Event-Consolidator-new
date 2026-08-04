import "server-only";
import type { Category } from "@prisma/client";
import type { NormalizedEventInput, ProviderAdapter } from "./types";
import { assertHttpsUrl } from "./url";

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

interface MeetupEvent {
  id?: string;
  name?: string;
  description?: string;
  link?: string;
  dateTime?: string;
  endTime?: string;
  timezone?: string;
  isFree?: boolean;
  fee?: { amount?: number; currency?: string };
  topics?: string[];
  images?: Array<{ url?: string }>;
  venue?: MeetupVenue | null;
  group?: { name?: string };
}

function mapCategory(topics: string[]): Category {
  for (const topic of topics) {
    const mapped = TOPIC_TO_CATEGORY[topic];
    if (mapped) return mapped;
  }
  if (topics.length > 0) {
    console.warn(
      JSON.stringify({
        event: "meetup.unmapped_topics",
        topics,
        action: "fallback_to_OTHER",
      })
    );
  }
  return "OTHER";
}

function buildIsoOffset(sign: string, hours: string, mins?: string): string {
  const h = hours.padStart(2, "0");
  const m = (mins ?? "00").padStart(2, "0");
  return `${sign}${h}:${m}`;
}

function parseLocalDateTime(dateTimeStr: string, timezone: string): Date {
  const isoLike = dateTimeStr.includes("T")
    ? dateTimeStr
    : dateTimeStr.replace(" ", "T");

  if (isoLike.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(isoLike)) {
    return new Date(isoLike);
  }

  try {
    const offsetFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZoneName: "shortOffset",
    });
    const offsetParts = offsetFormatter.formatToParts(new Date(isoLike));
    const offsetStr = offsetParts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    const offsetMatch = offsetStr.match(/GMT([+-])(\d+)(?::(\d+))?/);
    if (offsetMatch) {
      const isoOffset = buildIsoOffset(offsetMatch[1], offsetMatch[2], offsetMatch[3]);
      return new Date(`${isoLike}${isoOffset}`);
    }
    if (offsetStr === "GMT") {
      return new Date(`${isoLike}+00:00`);
    }
  } catch {
  }

  console.warn(
    JSON.stringify({
      event: "meetup.tz_parse_fallback",
      timezone,
      dateTimeStr,
      reason: "offset_extraction_failed",
    })
  );
  return new Date(isoLike + "Z");
}

function normalizeEvent(raw: MeetupEvent): NormalizedEventInput | null {
  const venue = raw.venue;
  if (!venue) {
    console.warn(
      JSON.stringify({
        event: "meetup.skip_no_venue",
        externalId: raw.id,
        action: "skip",
      })
    );
    return null;
  }

  const lat = venue.lat;
  const lng = venue.lon;
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
    console.warn(
      JSON.stringify({
        event: "meetup.skip_no_geo",
        externalId: raw.id,
        venueName: venue.name,
        action: "skip",
      })
    );
    return null;
  }

  const dateTimeStr = raw.dateTime;
  if (!dateTimeStr) {
    console.warn(
      JSON.stringify({
        event: "meetup.skip_no_start_time",
        externalId: raw.id,
        action: "skip",
      })
    );
    return null;
  }

  const timezone = raw.timezone ?? "UTC";
  const startTime = parseLocalDateTime(dateTimeStr, timezone);
  if (startTime <= new Date()) return null;

  const endTime = raw.endTime
    ? parseLocalDateTime(raw.endTime, timezone)
    : undefined;

  // Apify meetup-scraper returns fee.amount in whole USD, not cents.
  const isFree = raw.isFree ?? false;
  const price = !isFree && raw.fee?.amount != null
    ? Math.round(raw.fee.amount * 100)
    : undefined;

  const topics = raw.topics ?? [];
  const category = mapCategory(topics);

  const imageUrl = raw.images?.[0]?.url ?? undefined;
  const title = (raw.name ?? "").trim().replace(/\s+/g, " ");
  const venueName = venue.name ?? venue.address ?? "Unknown Venue";

  const externalId = raw.id ?? raw.link ?? title;

  return {
    provider: "MEETUP",
    externalId,
    title,
    description: raw.description ?? undefined,
    imageUrl,
    startTime,
    endTime,
    venue: venueName,
    latitude: lat,
    longitude: lng,
    price,
    isFree,
    category,
    ticketUrl: assertHttpsUrl(raw.link, `https://www.meetup.com/events/${externalId}`),
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
          country: "US",
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
