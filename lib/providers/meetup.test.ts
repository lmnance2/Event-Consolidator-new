import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function collectAll(gen: AsyncGenerator<unknown>): Promise<unknown[]> {
  const results: unknown[] = [];
  for await (const item of gen) results.push(item);
  return results;
}

import fixtureData from "./__fixtures__/meetup.json";

function makeMockApifyModule(items: unknown[]) {
  let firstCall = true;
  const mockListItems = vi.fn().mockImplementation(async () => {
    if (firstCall) {
      firstCall = false;
      return { items };
    }
    return { items: [] };
  });
  const mockCall = vi.fn().mockResolvedValue({
    status: "SUCCEEDED",
    defaultDatasetId: "dataset-123",
  });

  class MockApifyClient {
    actor() {
      return { call: mockCall };
    }
    dataset() {
      return { listItems: mockListItems };
    }
  }

  return { ApifyClient: MockApifyClient, mockCall, mockListItems };
}

async function getAdapterWithMock(items: unknown[]) {
  const { ApifyClient, mockCall, mockListItems } = makeMockApifyModule(items);
  vi.doMock("apify-client", () => ({ ApifyClient }));
  const mod = await import("./meetup");
  return { adapter: mod.meetupAdapter, mockCall, mockListItems };
}

describe("meetup adapter — normalization", () => {
  it("skips provider and yields nothing when APIFY_API_TOKEN is missing", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "");
    const { adapter } = await getAdapterWithMock(fixtureData);
    const results = await collectAll(adapter.fetchEvents());
    expect(results).toHaveLength(0);
  });

  it("normalizes valid events and skips events without venue", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const { adapter } = await getAdapterWithMock(fixtureData);
    const results = await collectAll(adapter.fetchEvents());

    expect(results).toHaveLength(3);

    const [first] = results as Array<{
      provider: string;
      externalId: string;
      title: string;
      category: string;
      isFree: boolean;
      price?: number;
      latitude: number;
      longitude: number;
      venue: string;
      description?: string;
      imageUrl?: string;
    }>;

    expect(first.provider).toBe("MEETUP");
    expect(first.externalId).toBe("mu-001");
    expect(first.title).toBe("Chicago JS Meetup: React Patterns");
    expect(first.category).toBe("NETWORKING");
    expect(first.isFree).toBe(true);
    expect(first.latitude).toBe(41.8867);
    expect(first.longitude).toBe(-87.6347);
    expect(first.venue).toBe("1871 Chicago");
    expect(first.imageUrl).toBe("https://secure.meetupstatic.com/photos/event/mu-001.jpg");
  });

  it("normalizes paid event with fee amount in cents", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const { adapter } = await getAdapterWithMock(fixtureData);
    const results = await collectAll(adapter.fetchEvents()) as Array<{
      isFree: boolean;
      price?: number;
    }>;
    const paid = results[1];
    expect(paid.isFree).toBe(false);
    expect(paid.price).toBe(3000);
  });

  it("maps Outdoors & Adventure topic to OUTDOOR_ADVENTURE", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const { adapter } = await getAdapterWithMock(fixtureData);
    const results = await collectAll(adapter.fetchEvents()) as Array<{ category: string }>;
    expect(results[2].category).toBe("OUTDOOR_ADVENTURE");
  });

  it("skips the fourth event (no venue) and logs a warning", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { adapter } = await getAdapterWithMock(fixtureData);
    const results = await collectAll(adapter.fetchEvents());
    expect(results).toHaveLength(3);
    const warnMessages = warnSpy.mock.calls.map((c) => c[0] as string);
    expect(warnMessages.some((m) => m.includes("skip_no_venue"))).toBe(true);
  });

  it("trims whitespace in title", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const { adapter } = await getAdapterWithMock(fixtureData);
    const results = await collectAll(adapter.fetchEvents()) as Array<{ title: string }>;
    expect(results[0].title).not.toMatch(/^\s|\s$/);
  });
});

describe("meetup actor input shape", () => {
  it("passes city, state, lowercase country, and both maxResults + maxItems", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const { adapter, mockCall } = await getAdapterWithMock(fixtureData);
    await collectAll(adapter.fetchEvents());

    expect(mockCall).toHaveBeenCalled();
    const firstCallArg = mockCall.mock.calls[0][0] as Record<string, unknown>;

    expect(firstCallArg).toHaveProperty("city");
    expect(firstCallArg).toHaveProperty("state");
    // Actor's input schema requires lowercase ISO-3166 alpha-2.
    expect(firstCallArg).toHaveProperty("country", "us");
    // Actor requires `maxResults`; `maxItems` kept as a defensive alias.
    expect(firstCallArg).toHaveProperty("maxResults", 200);
    expect(firstCallArg).toHaveProperty("maxItems", 200);

    expect(firstCallArg).not.toHaveProperty("searchTerm");
  });

  it("records failed metro in metroFailures when actor run throws", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const mockCall = vi.fn().mockRejectedValue(new Error("Network error"));

    class MockApifyClient {
      actor() { return { call: mockCall }; }
      dataset() { return { listItems: vi.fn() }; }
    }

    vi.doMock("apify-client", () => ({ ApifyClient: MockApifyClient }));
    const mod = await import("./meetup");
    const adapter = mod.meetupAdapter;
    adapter.metroFailures = [];
    await collectAll(adapter.fetchEvents());

    expect(adapter.metroFailures.length).toBeGreaterThan(0);
  });

  it("records failed metro in metroFailures when actor run status is not SUCCEEDED", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const mockCall = vi.fn().mockResolvedValue({
      status: "FAILED",
      defaultDatasetId: "dataset-fail",
    });

    class MockApifyClient {
      actor() { return { call: mockCall }; }
      dataset() { return { listItems: vi.fn() }; }
    }

    vi.doMock("apify-client", () => ({ ApifyClient: MockApifyClient }));
    const mod = await import("./meetup");
    const adapter = mod.meetupAdapter;
    adapter.metroFailures = [];
    await collectAll(adapter.fetchEvents());

    expect(adapter.metroFailures.length).toBeGreaterThan(0);
  });
});

describe("meetup ticketUrl — XSS guard", () => {
  function makeEventWithLink(link: unknown) {
    return {
      ...fixtureData[0],
      eventId: "mu-url-test",
      eventUrl: link,
      startDateTime: "2030-01-01T18:00:00",
      timezone: "America/Chicago",
    };
  }

  it("stores a valid https:// URL verbatim", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const event = makeEventWithLink("https://www.meetup.com/group/events/mu-url-test");
    const { adapter } = await getAdapterWithMock([event]);
    const results = await collectAll(adapter.fetchEvents()) as Array<{ ticketUrl: string }>;
    expect(results[0].ticketUrl).toBe("https://www.meetup.com/group/events/mu-url-test");
  });

  it("falls back to canonical URL when actor returns javascript: scheme", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const event = makeEventWithLink("javascript:alert(1)");
    const { adapter } = await getAdapterWithMock([event]);
    const results = await collectAll(adapter.fetchEvents()) as Array<{ ticketUrl: string }>;
    expect(results[0].ticketUrl).toBe("https://www.meetup.com/events/mu-url-test");
  });

  it("falls back to canonical URL when actor returns http:// (insecure)", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const event = makeEventWithLink("http://www.meetup.com/group/events/mu-url-test");
    const { adapter } = await getAdapterWithMock([event]);
    const results = await collectAll(adapter.fetchEvents()) as Array<{ ticketUrl: string }>;
    expect(results[0].ticketUrl).toBe("https://www.meetup.com/events/mu-url-test");
  });

  it("falls back to canonical URL when actor returns undefined", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const base = { ...fixtureData[0], eventId: "mu-url-test", startDateTime: "2030-01-01T18:00:00", timezone: "America/Chicago" };
    delete (base as Record<string, unknown>).eventUrl;
    const { adapter } = await getAdapterWithMock([base]);
    const results = await collectAll(adapter.fetchEvents()) as Array<{ ticketUrl: string }>;
    expect(results[0].ticketUrl).toBe("https://www.meetup.com/events/mu-url-test");
  });

  it("falls back to canonical URL when actor returns null", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const event = makeEventWithLink(null);
    const { adapter } = await getAdapterWithMock([event]);
    const results = await collectAll(adapter.fetchEvents()) as Array<{ ticketUrl: string }>;
    expect(results[0].ticketUrl).toBe("https://www.meetup.com/events/mu-url-test");
  });
});

describe("meetup timezone parsing — parseLocalDateTime (C1)", () => {
  function makeTimezoneEvent(
    dateTime: string,
    timezone: string,
    id = "tz-test"
  ) {
    return {
      ...fixtureData[0],
      eventId: id,
      startDateTime: dateTime,
      endDateTime: undefined,
      timezone,
    };
  }

  it("America/Chicago winter (UTC-6) → correct UTC startTime", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const event = makeTimezoneEvent("2027-01-15T18:30:00", "America/Chicago");
    const { adapter } = await getAdapterWithMock([event]);
    const results = await collectAll(adapter.fetchEvents()) as Array<{ startTime: Date }>;
    expect(results[0].startTime.toISOString()).toBe("2027-01-16T00:30:00.000Z");
  });

  it("America/Chicago summer (UTC-5, CDT) → correct UTC startTime", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const event = makeTimezoneEvent("2030-07-15T18:30:00", "America/Chicago");
    const { adapter } = await getAdapterWithMock([event]);
    const results = await collectAll(adapter.fetchEvents()) as Array<{ startTime: Date }>;
    expect(results[0].startTime.toISOString()).toBe("2030-07-15T23:30:00.000Z");
  });

  it("America/Los_Angeles winter (UTC-8) → correct UTC startTime", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const event = makeTimezoneEvent("2027-01-20T19:00:00", "America/Los_Angeles", "tz-la");
    const { adapter } = await getAdapterWithMock([event]);
    const results = await collectAll(adapter.fetchEvents()) as Array<{ startTime: Date }>;
    expect(results[0].startTime.toISOString()).toBe("2027-01-21T03:00:00.000Z");
  });

  it("America/New_York winter (UTC-5) → correct UTC startTime", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const event = makeTimezoneEvent("2027-01-10T20:00:00", "America/New_York", "tz-nyc");
    const { adapter } = await getAdapterWithMock([event]);
    const results = await collectAll(adapter.fetchEvents()) as Array<{ startTime: Date }>;
    expect(results[0].startTime.toISOString()).toBe("2027-01-11T01:00:00.000Z");
  });

  it("America/New_York summer (UTC-4, EDT) → correct UTC startTime", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const event = makeTimezoneEvent("2030-07-04T20:00:00", "America/New_York", "tz-nyc-summer");
    const { adapter } = await getAdapterWithMock([event]);
    const results = await collectAll(adapter.fetchEvents()) as Array<{ startTime: Date }>;
    expect(results[0].startTime.toISOString()).toBe("2030-07-05T00:00:00.000Z");
  });

  it("Asia/Kathmandu (UTC+5:45, Nepal) → correct UTC startTime", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const event = makeTimezoneEvent("2030-03-01T12:00:00", "Asia/Kathmandu", "tz-nepal");
    const { adapter } = await getAdapterWithMock([event]);
    const results = await collectAll(adapter.fetchEvents()) as Array<{ startTime: Date }>;
    expect(results[0].startTime.toISOString()).toBe("2030-03-01T06:15:00.000Z");
  });

  it("malformed timezone string falls back to Z and logs warning", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const event = makeTimezoneEvent("2030-01-01T12:00:00", "Not/A/Timezone", "tz-bad");
    const { adapter } = await getAdapterWithMock([event]);
    const results = await collectAll(adapter.fetchEvents()) as Array<{ startTime: Date }>;
    expect(results[0].startTime.toISOString()).toBe("2030-01-01T12:00:00.000Z");
    const warnMessages = warnSpy.mock.calls.map((c) => c[0] as string);
    expect(warnMessages.some((m) => m.includes("tz_parse_fallback"))).toBe(true);
  });
});

describe("meetup category map completeness", () => {
  const topicCases: Array<[string, string]> = [
    ["Tech", "NETWORKING"],
    ["Technology", "NETWORKING"],
    ["JavaScript", "NETWORKING"],
    ["Python", "NETWORKING"],
    ["Startup", "NETWORKING"],
    ["Networking", "NETWORKING"],
    ["Business", "NETWORKING"],
    ["Entrepreneurship", "NETWORKING"],
    ["Music", "MUSIC"],
    ["Arts", "ARTS_THEATER"],
    ["Theater", "ARTS_THEATER"],
    ["Photography", "ARTS_THEATER"],
    ["Film", "ARTS_THEATER"],
    ["Dance", "ARTS_THEATER"],
    ["Food & Drink", "FOOD_DRINK"],
    ["Food", "FOOD_DRINK"],
    ["Wine", "FOOD_DRINK"],
    ["Cooking", "FOOD_DRINK"],
    ["Health & Wellness", "HEALTH_WELLNESS"],
    ["Fitness", "HEALTH_WELLNESS"],
    ["Yoga", "HEALTH_WELLNESS"],
    ["Meditation", "HEALTH_WELLNESS"],
    ["Running", "HEALTH_WELLNESS"],
    ["Outdoors & Adventure", "OUTDOOR_ADVENTURE"],
    ["Hiking", "OUTDOOR_ADVENTURE"],
    ["Outdoors", "OUTDOOR_ADVENTURE"],
    ["Adventure", "OUTDOOR_ADVENTURE"],
    ["Cycling", "OUTDOOR_ADVENTURE"],
    ["Family", "FAMILY_FRIENDLY"],
    ["Kids", "FAMILY_FRIENDLY"],
    ["Parenting", "FAMILY_FRIENDLY"],
    ["Community", "COMMUNITY_CULTURE"],
    ["Culture", "COMMUNITY_CULTURE"],
    ["Language", "COMMUNITY_CULTURE"],
    ["Social", "COMMUNITY_CULTURE"],
    ["Nightlife", "NIGHTLIFE"],
    ["Night Life", "NIGHTLIFE"],
    ["Bar", "NIGHTLIFE"],
    ["Party", "NIGHTLIFE"],
    ["Education", "EDUCATION"],
    ["Learning", "EDUCATION"],
    ["Book Club", "EDUCATION"],
    ["Science", "EDUCATION"],
    ["Sports", "SPORTS"],
    ["Basketball", "SPORTS"],
    ["Soccer", "SPORTS"],
    ["Tennis", "SPORTS"],
    ["Volleyball", "SPORTS"],
  ];

  for (const [topic, expected] of topicCases) {
    it(`maps topic "${topic}" to ${expected}`, async () => {
      vi.stubEnv("APIFY_API_TOKEN", "test-token");

      const eventWithTopic = {
        ...fixtureData[0],
        eventId: `test-topic-${topic}`,
        topics: [{ name: topic }],
        startDateTime: "2030-01-01T18:00:00",
        timezone: "America/New_York",
        endDateTime: "2030-01-01T21:00:00",
      };

      const { adapter } = await getAdapterWithMock([eventWithTopic]);
      const results = await collectAll(adapter.fetchEvents()) as Array<{ category: string }>;
      expect(results[0]?.category).toBe(expected);
    });
  }

  it("logs and falls back to OTHER for unknown topic", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const eventWithUnknown = {
      ...fixtureData[0],
      eventId: "test-unknown-topic",
      topics: [{ name: "Quantum Levitation" }],
      startDateTime: "2030-01-01T18:00:00",
      timezone: "America/New_York",
    };

    const { adapter } = await getAdapterWithMock([eventWithUnknown]);
    const results = await collectAll(adapter.fetchEvents()) as Array<{ category: string }>;
    expect(results[0]?.category).toBe("OTHER");
    const warnMessages = warnSpy.mock.calls.map((c) => c[0] as string);
    expect(warnMessages.some((m) => m.includes("unmapped_topics"))).toBe(true);
  });
});
