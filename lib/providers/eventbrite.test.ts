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

import fixtureData from "./__fixtures__/eventbrite.json";

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
    defaultDatasetId: "dataset-eb-123",
  });

  class MockApifyClient {
    task() {
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
  const mod = await import("./eventbrite");
  return { adapter: mod.eventbriteAdapter, mockCall, mockListItems };
}

describe("eventbrite adapter — normalization", () => {
  it("skips provider and yields nothing when APIFY_API_TOKEN is missing", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "");
    const { adapter } = await getAdapterWithMock(fixtureData);
    const results = await collectAll(adapter.fetchEvents());
    expect(results).toHaveLength(0);
  });

  it("normalizes valid events and skips events missing geo", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const { adapter } = await getAdapterWithMock(fixtureData);
    const results = await collectAll(adapter.fetchEvents());

    expect(results).toHaveLength(2);

    const [first, second] = results as Array<{
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

    expect(first.provider).toBe("EVENTBRITE");
    expect(first.externalId).toBe("eb-001");
    expect(first.title).toBe("NYC Tech Networking Night");
    expect(first.category).toBe("NETWORKING");
    // Actor doesn't provide price/free info; adapter defaults to unknown.
    expect(first.isFree).toBe(false);
    expect(first.price).toBeUndefined();
    expect(first.latitude).toBeCloseTo(40.7282, 3);
    expect(first.longitude).toBeCloseTo(-73.9942, 3);
    expect(first.venue).toBe("Werk NYC, 123 Broadway, New York, NY 10006");
    expect(first.description).toBe("Connect with engineers and founders in the NYC tech scene.");
    expect(first.imageUrl).toBe("https://img.evbuc.com/tech-night-original.jpg");

    expect(second.externalId).toBe("eb-002");
  });

  it("passes the correct input shape to the Apify actor", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const { adapter, mockCall } = await getAdapterWithMock(fixtureData);
    await collectAll(adapter.fetchEvents());

    expect(mockCall).toHaveBeenCalledWith(
      expect.objectContaining({
        country: expect.any(String),
        city: expect.any(String),
        maxResults: 200,
        enrichOrganizers: false,
      })
    );
    const firstCallArg = mockCall.mock.calls[0][0] as Record<string, unknown>;
    expect(firstCallArg).not.toHaveProperty("searchQuery");
    expect(firstCallArg).not.toHaveProperty("location");
  });

  it("skips the third event (no geo) and logs a warning", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { adapter } = await getAdapterWithMock(fixtureData);
    const results = await collectAll(adapter.fetchEvents());
    expect(results).toHaveLength(2);
    const warnMessages = warnSpy.mock.calls.map((c) => c[0] as string);
    expect(warnMessages.some((m) => m.includes("skip_no_geo"))).toBe(true);
  });

  it("skips online events with a warning", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onlineEvent = {
      ...fixtureData[0],
      eventbrite_event_id: "eb-online",
      is_online_event: true,
    };
    const { adapter } = await getAdapterWithMock([onlineEvent]);
    const results = await collectAll(adapter.fetchEvents());
    expect(results).toHaveLength(0);
    const warnMessages = warnSpy.mock.calls.map((c) => c[0] as string);
    expect(warnMessages.some((m) => m.includes("skip_online"))).toBe(true);
  });

  it("skips cancelled events with a warning", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cancelledEvent = {
      ...fixtureData[0],
      eventbrite_event_id: "eb-cancelled",
      status: "cancelled",
    };
    const { adapter } = await getAdapterWithMock([cancelledEvent]);
    const results = await collectAll(adapter.fetchEvents());
    expect(results).toHaveLength(0);
    const warnMessages = warnSpy.mock.calls.map((c) => c[0] as string);
    expect(warnMessages.some((m) => m.includes("skip_cancelled"))).toBe(true);
  });

  it("uses image_url from actor output", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const { adapter } = await getAdapterWithMock(fixtureData);
    const results = await collectAll(adapter.fetchEvents()) as Array<{ imageUrl?: string }>;
    expect(results[0].imageUrl).toBe("https://img.evbuc.com/tech-night-original.jpg");
  });

  it("trims and collapses whitespace in title", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const { adapter } = await getAdapterWithMock(fixtureData);
    const results = await collectAll(adapter.fetchEvents()) as Array<{ title: string }>;
    expect(results[0].title).not.toMatch(/^\s|\s$/);
    expect(results[0].title).not.toMatch(/\s{2,}/);
  });

  it("records failed metro in metroFailures when actor run fails", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const mockCall = vi.fn().mockRejectedValue(new Error("Actor timed out"));

    class MockApifyClient {
      task() { return { call: mockCall }; }
      dataset() { return { listItems: vi.fn() }; }
    }

    vi.doMock("apify-client", () => ({ ApifyClient: MockApifyClient }));
    const mod = await import("./eventbrite");
    const adapter = mod.eventbriteAdapter;
    adapter.metroFailures = [];
    await collectAll(adapter.fetchEvents());

    expect(adapter.metroFailures.length).toBeGreaterThan(0);
  });

  it("records failed metro in metroFailures when actor status is not SUCCEEDED", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const mockCall = vi.fn().mockResolvedValue({
      status: "FAILED",
      defaultDatasetId: "dataset-fail",
    });

    class MockApifyClient {
      task() { return { call: mockCall }; }
      dataset() { return { listItems: vi.fn() }; }
    }

    vi.doMock("apify-client", () => ({ ApifyClient: MockApifyClient }));
    const mod = await import("./eventbrite");
    const adapter = mod.eventbriteAdapter;
    adapter.metroFailures = [];
    await collectAll(adapter.fetchEvents());

    expect(adapter.metroFailures.length).toBeGreaterThan(0);
  });
});

describe("eventbrite ticketUrl — XSS guard", () => {
  function makeEventWithUrl(url: unknown) {
    return {
      ...fixtureData[0],
      eventbrite_event_id: "eb-url-test",
      url,
    };
  }

  it("stores a valid https:// URL verbatim", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const event = makeEventWithUrl("https://www.eventbrite.com/e/eb-url-test");
    const { adapter } = await getAdapterWithMock([event]);
    const results = await collectAll(adapter.fetchEvents()) as Array<{ ticketUrl: string }>;
    expect(results[0].ticketUrl).toBe("https://www.eventbrite.com/e/eb-url-test");
  });

  it("falls back to canonical URL when actor returns javascript: scheme", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const event = makeEventWithUrl("javascript:alert(1)");
    const { adapter } = await getAdapterWithMock([event]);
    const results = await collectAll(adapter.fetchEvents()) as Array<{ ticketUrl: string }>;
    expect(results[0].ticketUrl).toBe("https://www.eventbrite.com/e/eb-url-test");
  });

  it("falls back to canonical URL when actor returns http:// (insecure)", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const event = makeEventWithUrl("http://www.eventbrite.com/e/eb-url-test");
    const { adapter } = await getAdapterWithMock([event]);
    const results = await collectAll(adapter.fetchEvents()) as Array<{ ticketUrl: string }>;
    expect(results[0].ticketUrl).toBe("https://www.eventbrite.com/e/eb-url-test");
  });

  it("falls back to canonical URL when actor returns undefined", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const base = {
      ...fixtureData[0],
      eventbrite_event_id: "eb-url-test",
    };
    delete (base as Record<string, unknown>).url;
    const { adapter } = await getAdapterWithMock([base]);
    const results = await collectAll(adapter.fetchEvents()) as Array<{ ticketUrl: string }>;
    expect(results[0].ticketUrl).toBe("https://www.eventbrite.com/e/eb-url-test");
  });

  it("falls back to canonical URL when actor returns null", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const event = makeEventWithUrl(null);
    const { adapter } = await getAdapterWithMock([event]);
    const results = await collectAll(adapter.fetchEvents()) as Array<{ ticketUrl: string }>;
    expect(results[0].ticketUrl).toBe("https://www.eventbrite.com/e/eb-url-test");
  });
});

describe("eventbrite category map completeness", () => {
  const categoryCases: Array<[string, string]> = [
    ["Music", "MUSIC"],
    ["Business & Professional", "NETWORKING"],
    ["Food & Drink", "FOOD_DRINK"],
    ["Community & Culture", "COMMUNITY_CULTURE"],
    ["Performing & Visual Arts", "ARTS_THEATER"],
    ["Film, Media & Entertainment", "ARTS_THEATER"],
    ["Sports & Fitness", "SPORTS"],
    ["Health & Wellness", "HEALTH_WELLNESS"],
    ["Science & Technology", "NETWORKING"],
    ["Travel & Outdoor", "OUTDOOR_ADVENTURE"],
    ["Charity & Causes", "COMMUNITY_CULTURE"],
    ["Religion & Spirituality", "COMMUNITY_CULTURE"],
    ["Family & Education", "FAMILY_FRIENDLY"],
    ["Hobbies & Special Interest", "OTHER"],
    ["Government & Politics", "OTHER"],
    ["Fashion & Beauty", "OTHER"],
    ["Home & Lifestyle", "OTHER"],
    ["Auto, Boat & Air", "OTHER"],
    ["Nightlife", "NIGHTLIFE"],
    ["School Activities", "EDUCATION"],
  ];

  for (const [tag, expected] of categoryCases) {
    it(`maps tag "${tag}" to ${expected}`, async () => {
      vi.stubEnv("APIFY_API_TOKEN", "test-token");

      const eventWithTag = {
        ...fixtureData[0],
        eventbrite_event_id: `test-cat-${tag}`,
        tags: [tag],
      };

      const { adapter } = await getAdapterWithMock([eventWithTag]);
      const results = await collectAll(adapter.fetchEvents()) as Array<{ category: string }>;
      expect(results[0]?.category).toBe(expected);
    });
  }

  it("logs and falls back to OTHER for unknown tag", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const eventWithUnknown = {
      ...fixtureData[0],
      eventbrite_event_id: "test-unknown-cat",
      tags: ["Quantum Experiences"],
    };

    const { adapter } = await getAdapterWithMock([eventWithUnknown]);
    const results = await collectAll(adapter.fetchEvents()) as Array<{ category: string }>;
    expect(results[0]?.category).toBe("OTHER");
    const warnMessages = warnSpy.mock.calls.map((c) => c[0] as string);
    expect(warnMessages.some((m) => m.includes("unmapped_category"))).toBe(true);
  });

  it("returns OTHER when tags is empty", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "test-token");

    const eventWithNoTags = {
      ...fixtureData[0],
      eventbrite_event_id: "test-no-cat",
      tags: [],
    };

    const { adapter } = await getAdapterWithMock([eventWithNoTags]);
    const results = await collectAll(adapter.fetchEvents()) as Array<{ category: string }>;
    expect(results[0]?.category).toBe("OTHER");
  });
});
