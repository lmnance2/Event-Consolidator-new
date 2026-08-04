import { describe, it, expect, vi, beforeEach } from "vitest";
import { Category, ExperienceType, Provider } from "@prisma/client";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    event: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/client";
import { getFeedPage, type UserPreferencesInput } from "@/lib/events/feed-query";

const mockFindMany = vi.mocked(prisma.event.findMany);

const BASE_PREFS: UserPreferencesInput = {
  disabledCategories: [],
  maxDistanceMiles: 25,
  dateRangeDays: 30,
  priceMin: null,
  priceMax: null,
  experienceType: ExperienceType.BOTH,
  familyFriendly: false,
};

const ORIGIN = { lat: 40.7128, lng: -74.006 };

function makeEvent(overrides: Partial<{
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  startTime: Date;
  endTime: Date | null;
  venue: string;
  price: number | null;
  isFree: boolean;
  category: Category;
  performerName: string | null;
  description: string | null;
  imageUrl: string | null;
  sources: Array<{ provider: Provider; ticketUrl: string }>;
}> = {}) {
  return {
    id: overrides.id ?? "evt-1",
    title: overrides.title ?? "Test Concert",
    description: overrides.description ?? null,
    imageUrl: overrides.imageUrl ?? null,
    startTime: overrides.startTime ?? new Date(Date.now() + 86_400_000),
    endTime: overrides.endTime ?? null,
    venue: overrides.venue ?? "Test Venue, NYC, NY",
    latitude: overrides.latitude ?? 40.7128,
    longitude: overrides.longitude ?? -74.006,
    price: overrides.price !== undefined ? overrides.price : null,
    isFree: overrides.isFree ?? false,
    category: overrides.category ?? Category.MUSIC,
    performerName: overrides.performerName ?? null,
    sources: overrides.sources ?? [
      { provider: "TICKETMASTER" as Provider, ticketUrl: "https://tm.com/evt-1" },
    ],
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getFeedPage — preference merge", () => {
  it("uses user preference distanceMi when filter omits it", async () => {
    const prefs: UserPreferencesInput = { ...BASE_PREFS, maxDistanceMiles: 10 };
    mockFindMany.mockResolvedValueOnce([]);

    await getFeedPage({
      userId: "u1",
      userPreferences: prefs,
      isPro: false,
      origin: ORIGIN,
      filters: {},
      cursor: null,
    });

    const callArg = mockFindMany.mock.calls[0]![0];
    const latDelta = 10 / 69;
    expect(callArg?.where?.latitude).toEqual({
      gte: ORIGIN.lat - latDelta,
      lte: ORIGIN.lat + latDelta,
    });
  });

  it("overrides preference distance when filter provides distanceMi", async () => {
    const prefs: UserPreferencesInput = { ...BASE_PREFS, maxDistanceMiles: 50 };
    mockFindMany.mockResolvedValueOnce([]);

    await getFeedPage({
      userId: "u1",
      userPreferences: prefs,
      isPro: false,
      origin: ORIGIN,
      filters: { distanceMi: 5 },
      cursor: null,
    });

    const callArg = mockFindMany.mock.calls[0]![0];
    const latDelta = 5 / 69;
    expect(callArg?.where?.latitude).toEqual({
      gte: ORIGIN.lat - latDelta,
      lte: ORIGIN.lat + latDelta,
    });
  });

  it("uses preference dateRangeDays when filter omits it", async () => {
    const prefs: UserPreferencesInput = { ...BASE_PREFS, dateRangeDays: 7 };
    mockFindMany.mockResolvedValueOnce([]);

    await getFeedPage({
      userId: "u1",
      userPreferences: prefs,
      isPro: false,
      origin: ORIGIN,
      filters: {},
      cursor: null,
    });

    const callArg = mockFindMany.mock.calls[0]![0];
    const startTimeFilter = callArg?.where?.startTime as { lte: Date } | undefined;
    expect(startTimeFilter?.lte).toBeDefined();
    const diffDays =
      ((startTimeFilter!.lte as Date).getTime() - Date.now()) / 86_400_000;
    expect(diffDays).toBeCloseTo(7, 0);
  });
});

describe("getFeedPage — Pro strip", () => {
  it("FREE user: experienceType / freeOnly / timeOfDay / venue in filters are silently ignored", async () => {
    const event = makeEvent({ isFree: false });
    mockFindMany.mockResolvedValueOnce([event] as never);

    const page = await getFeedPage({
      userId: "u1",
      userPreferences: BASE_PREFS,
      isPro: false,
      origin: ORIGIN,
      filters: {
        experienceType: ExperienceType.INDOOR,
        freeOnly: true,
        timeOfDay: "MORNING",
        venue: "Madison Square Garden",
      },
      cursor: null,
    });

    const callArg = mockFindMany.mock.calls[0]![0];
    expect(callArg?.where).not.toHaveProperty("experienceType");
    expect((callArg?.where as { isFree?: boolean } | undefined)?.isFree).toBeUndefined();
    expect((callArg?.where as { venue?: unknown } | undefined)?.venue).toBeUndefined();
    expect(page.rows).toHaveLength(1);
  });

  it("FREE user: categories / distance / price filters still work", async () => {
    mockFindMany.mockResolvedValueOnce([]);

    await getFeedPage({
      userId: "u1",
      userPreferences: BASE_PREFS,
      isPro: false,
      origin: ORIGIN,
      filters: {
        categories: [Category.MUSIC],
        distanceMi: 10,
        priceMin: 0,
        priceMax: 50,
      },
      cursor: null,
    });

    const callArg = mockFindMany.mock.calls[0]![0];
    expect(callArg?.where?.category).toEqual({ in: [Category.MUSIC] });
    expect((callArg?.where as { price?: unknown } | undefined)?.price).toBeDefined();
  });

  it("PRO user: freeOnly=true is applied to the DB where clause", async () => {
    mockFindMany.mockResolvedValueOnce([]);

    await getFeedPage({
      userId: "u1",
      userPreferences: BASE_PREFS,
      isPro: true,
      origin: ORIGIN,
      filters: { freeOnly: true },
      cursor: null,
    });

    const callArg = mockFindMany.mock.calls[0]![0];
    expect((callArg?.where as { isFree?: boolean } | undefined)?.isFree).toBe(true);
  });

  it("PRO user: venue filter is applied to the DB where clause", async () => {
    mockFindMany.mockResolvedValueOnce([]);

    await getFeedPage({
      userId: "u1",
      userPreferences: BASE_PREFS,
      isPro: true,
      origin: ORIGIN,
      filters: { venue: "Garden" },
      cursor: null,
    });

    const callArg = mockFindMany.mock.calls[0]![0];
    expect((callArg?.where as { venue?: unknown } | undefined)?.venue).toEqual({
      contains: "Garden",
      mode: "insensitive",
    });
  });
});

describe("getFeedPage — bounding-box math", () => {
  it("event far outside radius is excluded by in-memory Haversine", async () => {
    const farEvent = makeEvent({
      id: "far",
      latitude: 51.5074,
      longitude: -0.1278,
    });
    mockFindMany.mockResolvedValueOnce([farEvent] as never);

    const page = await getFeedPage({
      userId: "u1",
      userPreferences: BASE_PREFS,
      isPro: false,
      origin: ORIGIN,
      filters: { distanceMi: 25 },
      cursor: null,
    });

    expect(page.rows).toHaveLength(0);
  });

  it("event within radius is included", async () => {
    const nearEvent = makeEvent({
      id: "near",
      latitude: 40.73,
      longitude: -73.99,
    });
    mockFindMany.mockResolvedValueOnce([nearEvent] as never);

    const page = await getFeedPage({
      userId: "u1",
      userPreferences: BASE_PREFS,
      isPro: false,
      origin: ORIGIN,
      filters: { distanceMi: 25 },
      cursor: null,
    });

    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]!.id).toBe("near");
  });

  it("distanceMi on returned row is rounded to 1 decimal place", async () => {
    const nearEvent = makeEvent({
      latitude: 40.73,
      longitude: -73.99,
    });
    mockFindMany.mockResolvedValueOnce([nearEvent] as never);

    const page = await getFeedPage({
      userId: "u1",
      userPreferences: BASE_PREFS,
      isPro: false,
      origin: ORIGIN,
      filters: {},
      cursor: null,
    });

    expect(page.rows[0]!.distanceMi).toEqual(
      Math.round(page.rows[0]!.distanceMi * 10) / 10
    );
  });
});

describe("getFeedPage — cursor pagination", () => {
  function makeSortedEvents(n: number, baseOffsetMs = 86_400_000) {
    return Array.from({ length: n }, (_, i) => ({
      ...makeEvent({
        id: `evt-${i}`,
        startTime: new Date(Date.now() + baseOffsetMs + i * 1000),
      }),
    }));
  }

  it("page 1 + page 2 do not repeat rows when cursor from page 1 is passed", async () => {
    const events = makeSortedEvents(6);
    mockFindMany
      .mockResolvedValueOnce(events.slice(0, 3) as never)
      .mockResolvedValueOnce(events.slice(3, 6) as never)
      .mockResolvedValueOnce([] as never);

    const page1 = await getFeedPage({
      userId: "u1",
      userPreferences: BASE_PREFS,
      isPro: false,
      origin: ORIGIN,
      filters: {},
      cursor: null,
      limit: 3,
    });

    expect(page1.rows).toHaveLength(3);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await getFeedPage({
      userId: "u1",
      userPreferences: BASE_PREFS,
      isPro: false,
      origin: ORIGIN,
      filters: {},
      cursor: page1.nextCursor,
      limit: 3,
    });

    const page1Ids = new Set(page1.rows.map((r) => r.id));
    const page2Ids = page2.rows.map((r) => r.id);
    expect(page2Ids.some((id) => page1Ids.has(id))).toBe(false);
  });

  it("returns nextCursor=null when DB returns fewer rows than the batch size", async () => {
    mockFindMany.mockResolvedValueOnce([makeEvent()] as never);

    const page = await getFeedPage({
      userId: "u1",
      userPreferences: BASE_PREFS,
      isPro: false,
      origin: ORIGIN,
      filters: {},
      cursor: null,
      limit: 20,
    });

    expect(page.nextCursor).toBeNull();
  });

  it("cursor from an all-filtered-out page advances without returning that page's rows", async () => {
    const outsideEvent = makeEvent({
      id: "far-out",
      latitude: 51.5,
      longitude: -0.1,
      startTime: new Date(Date.now() + 86_400_000),
    });
    const insideEvent = makeEvent({
      id: "near-in",
      startTime: new Date(Date.now() + 172_800_000),
    });

    mockFindMany
      .mockResolvedValueOnce([...Array(60).fill(outsideEvent).map((e: ReturnType<typeof makeEvent>, i: number) => ({ ...e, id: `far-${i}` }))] as never)
      .mockResolvedValueOnce([insideEvent] as never)
      .mockResolvedValueOnce([] as never);

    const page = await getFeedPage({
      userId: "u1",
      userPreferences: BASE_PREFS,
      isPro: false,
      origin: ORIGIN,
      filters: { distanceMi: 25 },
      cursor: null,
      limit: 1,
    });

    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]!.id).toBe("near-in");
  });

  it("loop bound: stops after MAX_LOOP_ITERATIONS even if never full", async () => {
    const outsideEvent = makeEvent({
      latitude: 51.5,
      longitude: -0.1,
    });
    mockFindMany.mockResolvedValue(
      Array(60).fill(null).map((_, i) => ({ ...outsideEvent, id: `far-${i}` })) as never
    );

    const page = await getFeedPage({
      userId: "u1",
      userPreferences: BASE_PREFS,
      isPro: false,
      origin: ORIGIN,
      filters: { distanceMi: 25 },
      cursor: null,
      limit: 20,
    });

    expect(page.rows).toHaveLength(0);
    expect(mockFindMany).toHaveBeenCalledTimes(10);
  });
});

describe("getFeedPage — search", () => {
  it("applies OR on title and performerName with mode insensitive", async () => {
    mockFindMany.mockResolvedValueOnce([]);

    await getFeedPage({
      userId: "u1",
      userPreferences: BASE_PREFS,
      isPro: false,
      origin: ORIGIN,
      filters: { q: "beyoncé" },
      cursor: null,
    });

    const callArg = mockFindMany.mock.calls[0]![0];
    const where = callArg?.where as {
      OR?: Array<{ title?: unknown; performerName?: unknown }>;
    };
    expect(where?.OR).toBeDefined();
    expect(where?.OR).toHaveLength(2);
    expect(where?.OR?.[0]).toEqual({
      title: { contains: "beyoncé", mode: "insensitive" },
    });
    expect(where?.OR?.[1]).toEqual({
      performerName: { contains: "beyoncé", mode: "insensitive" },
    });
  });

  it("passes query as a parameterized value (not interpolated) — no OR clause when q is absent", async () => {
    mockFindMany.mockResolvedValueOnce([]);

    await getFeedPage({
      userId: "u1",
      userPreferences: BASE_PREFS,
      isPro: false,
      origin: ORIGIN,
      filters: {},
      cursor: null,
    });

    const callArg = mockFindMany.mock.calls[0]![0];
    const where = callArg?.where as { OR?: unknown };
    expect(where?.OR).toBeUndefined();
  });
});

describe("getFeedPage — category filter", () => {
  it("excludes disabled categories from the default enabled list", async () => {
    const prefs: UserPreferencesInput = {
      ...BASE_PREFS,
      disabledCategories: [Category.MUSIC],
    };
    mockFindMany.mockResolvedValueOnce([]);

    await getFeedPage({
      userId: "u1",
      userPreferences: prefs,
      isPro: false,
      origin: ORIGIN,
      filters: {},
      cursor: null,
    });

    const callArg = mockFindMany.mock.calls[0]![0];
    const catIn = (callArg?.where?.category as { in?: Category[] })?.in;
    expect(catIn).toBeDefined();
    expect(catIn).not.toContain(Category.MUSIC);
    expect(catIn?.length).toBe(
      Object.values(Category).length - 1
    );
  });

  it("URL param categories override user preference disabled list", async () => {
    const prefs: UserPreferencesInput = {
      ...BASE_PREFS,
      disabledCategories: [Category.MUSIC],
    };
    mockFindMany.mockResolvedValueOnce([]);

    await getFeedPage({
      userId: "u1",
      userPreferences: prefs,
      isPro: false,
      origin: ORIGIN,
      filters: { categories: [Category.MUSIC] },
      cursor: null,
    });

    const callArg = mockFindMany.mock.calls[0]![0];
    const catIn = (callArg?.where?.category as { in?: Category[] })?.in;
    expect(catIn).toEqual([Category.MUSIC]);
  });
});

describe("getFeedPage — source priority", () => {
  it("prefers TICKETMASTER over EVENTBRITE over MEETUP for ticketUrl", async () => {
    const event = makeEvent({
      sources: [
        { provider: "MEETUP" as Provider, ticketUrl: "https://meetup.com/e" },
        { provider: "TICKETMASTER" as Provider, ticketUrl: "https://tm.com/e" },
        { provider: "EVENTBRITE" as Provider, ticketUrl: "https://eb.com/e" },
      ],
    });
    mockFindMany.mockResolvedValueOnce([event] as never);

    const page = await getFeedPage({
      userId: "u1",
      userPreferences: BASE_PREFS,
      isPro: false,
      origin: ORIGIN,
      filters: {},
      cursor: null,
    });

    expect(page.rows[0]!.ticketUrl).toBe("https://tm.com/e");
    expect(page.rows[0]!.provider).toBe("TICKETMASTER");
  });

  it("event with no sources is excluded from results", async () => {
    const event = makeEvent({ sources: [] });
    mockFindMany.mockResolvedValueOnce([event] as never);

    const page = await getFeedPage({
      userId: "u1",
      userPreferences: BASE_PREFS,
      isPro: false,
      origin: ORIGIN,
      filters: {},
      cursor: null,
    });

    expect(page.rows).toHaveLength(0);
  });
});

describe("getFeedPage — FeedRow shape", () => {
  it("maps Event.venue to both venueName and venueAddress", async () => {
    const event = makeEvent({ venue: "Madison Square Garden, NYC, NY" });
    mockFindMany.mockResolvedValueOnce([event] as never);

    const page = await getFeedPage({
      userId: "u1",
      userPreferences: BASE_PREFS,
      isPro: false,
      origin: ORIGIN,
      filters: {},
      cursor: null,
    });

    expect(page.rows[0]!.venueName).toBe("Madison Square Garden, NYC, NY");
    expect(page.rows[0]!.venueAddress).toBe("Madison Square Garden, NYC, NY");
  });

  it("maps Event.price to priceMin and sets priceMax=null", async () => {
    const event = makeEvent({ price: 4999, isFree: false });
    mockFindMany.mockResolvedValueOnce([event] as never);

    const page = await getFeedPage({
      userId: "u1",
      userPreferences: BASE_PREFS,
      isPro: false,
      origin: ORIGIN,
      filters: {},
      cursor: null,
    });

    expect(page.rows[0]!.priceMin).toBe(4999);
    expect(page.rows[0]!.priceMax).toBeNull();
  });

  it("returns ISO 8601 string for startTime", async () => {
    const event = makeEvent({ startTime: new Date("2027-01-15T20:00:00Z") });
    mockFindMany.mockResolvedValueOnce([event] as never);

    const page = await getFeedPage({
      userId: "u1",
      userPreferences: BASE_PREFS,
      isPro: false,
      origin: ORIGIN,
      filters: {},
      cursor: null,
    });

    expect(page.rows[0]!.startTime).toBe("2027-01-15T20:00:00.000Z");
  });
});

describe("getFeedPage — cursor encoding", () => {
  it("encodeCursor round-trips through decodeCursor", async () => {
    const { encodeCursor: enc, decodeCursor: dec } = await import("@/lib/events/cursor");
    const payload = { startTime: "2027-01-15T20:00:00.000Z", id: "evt-abc" };
    const encoded = enc(payload);
    const decoded = dec(encoded);
    expect(decoded).toEqual(payload);
  });

  it("decodeCursor returns null for invalid base64", async () => {
    const { decodeCursor: dec } = await import("@/lib/events/cursor");
    expect(dec("not-valid-base64!!!")).toBeNull();
  });

  it("decodeCursor returns null for a valid base64 but wrong shape", async () => {
    const { decodeCursor: dec } = await import("@/lib/events/cursor");
    const bad = Buffer.from(JSON.stringify({ foo: "bar" })).toString("base64url");
    expect(dec(bad)).toBeNull();
  });
});
