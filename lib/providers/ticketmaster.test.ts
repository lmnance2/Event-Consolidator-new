import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function getAdapter() {
  const mod = await import("./ticketmaster");
  return mod.ticketmasterAdapter;
}

async function collectAll(
  gen: AsyncGenerator<unknown>
): Promise<unknown[]> {
  const results: unknown[] = [];
  for await (const item of gen) results.push(item);
  return results;
}

import fixtureData from "./__fixtures__/ticketmaster.json";

describe("ticketmaster adapter — normalization", () => {
  it("skips provider and yields nothing when TICKETMASTER_API_KEY is missing", async () => {
    vi.stubEnv("TICKETMASTER_API_KEY", "");
    const adapter = await getAdapter();
    const results = await collectAll(adapter.fetchEvents());
    expect(results).toHaveLength(0);
  });

  it("normalizes valid events and skips events without geo", async () => {
    vi.stubEnv("TICKETMASTER_API_KEY", "test-key");

    const emptyPage = { _embedded: { events: [] }, page: { size: 0, totalElements: 0, totalPages: 1, number: 0 } };
    let callCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      callCount++;
      return new Response(JSON.stringify(callCount === 1 ? fixtureData : emptyPage), { status: 200 });
    });

    const adapter = await getAdapter();
    const results = await collectAll(adapter.fetchEvents());

    expect(results).toHaveLength(2);

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
      performerName?: string;
      imageUrl?: string;
    }>;

    expect(first.provider).toBe("TICKETMASTER");
    expect(first.externalId).toBe("tm-001");
    expect(first.title).toBe("Taylor Swift: The Eras Tour");
    expect(first.category).toBe("MUSIC");
    expect(first.isFree).toBe(false);
    expect(first.price).toBe(8950);
    expect(first.latitude).toBeCloseTo(40.8135, 3);
    expect(first.longitude).toBeCloseTo(-74.0745, 3);
    expect(first.venue).toContain("MetLife Stadium");
    expect(first.performerName).toBe("Taylor Swift");
    expect(first.imageUrl).toBeTruthy();
  });

  it("trims and collapses whitespace in title", async () => {
    vi.stubEnv("TICKETMASTER_API_KEY", "test-key");

    const emptyPage = { _embedded: { events: [] }, page: { size: 0, totalElements: 0, totalPages: 1, number: 0 } };
    let callCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      callCount++;
      return new Response(JSON.stringify(callCount === 1 ? fixtureData : emptyPage), { status: 200 });
    });

    const adapter = await getAdapter();
    const results = await collectAll(adapter.fetchEvents()) as Array<{ title: string }>;
    expect(results[0].title).not.toMatch(/^\s|\s$/);
    expect(results[0].title).not.toMatch(/\s{2,}/);
  });

  it("maps Sports segment to SPORTS category", async () => {
    vi.stubEnv("TICKETMASTER_API_KEY", "test-key");

    const emptyPage = { _embedded: { events: [] }, page: { size: 0, totalElements: 0, totalPages: 1, number: 0 } };
    let callCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      callCount++;
      return new Response(JSON.stringify(callCount === 1 ? fixtureData : emptyPage), { status: 200 });
    });

    const adapter = await getAdapter();
    const results = await collectAll(adapter.fetchEvents()) as Array<{ category: string }>;
    expect(results[1].category).toBe("SPORTS");
  });

  it("picks the highest-resolution image", async () => {
    vi.stubEnv("TICKETMASTER_API_KEY", "test-key");

    const emptyPage = { _embedded: { events: [] }, page: { size: 0, totalElements: 0, totalPages: 1, number: 0 } };
    let callCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      callCount++;
      return new Response(JSON.stringify(callCount === 1 ? fixtureData : emptyPage), { status: 200 });
    });

    const adapter = await getAdapter();
    const results = await collectAll(adapter.fetchEvents()) as Array<{ imageUrl?: string }>;
    expect(results[0].imageUrl).toBe("https://example.com/img/large.jpg");
  });

  it("skips the third event (missing coordinates) and logs a warning", async () => {
    vi.stubEnv("TICKETMASTER_API_KEY", "test-key");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const emptyPage = { _embedded: { events: [] }, page: { size: 0, totalElements: 0, totalPages: 1, number: 0 } };
    let callCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      callCount++;
      return new Response(JSON.stringify(callCount === 1 ? fixtureData : emptyPage), { status: 200 });
    });

    const adapter = await getAdapter();
    const results = await collectAll(adapter.fetchEvents());

    expect(results).toHaveLength(2);
    const warnMessages = warnSpy.mock.calls.map((c) => c[0] as string);
    const skippedLog = warnMessages.find((m) => m.includes("skip_no_geo") || m.includes("skip"));
    expect(skippedLog).toBeTruthy();
  });

  it("backs off and retries on 429 then succeeds", async () => {
    vi.stubEnv("TICKETMASTER_API_KEY", "test-key");
    vi.useFakeTimers();

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    let callCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return new Response("", { status: 429 });
      return new Response(JSON.stringify(fixtureData), { status: 200 });
    });

    const adapterPromise = (async () => {
      const adapter = await getAdapter();
      return collectAll(adapter.fetchEvents());
    })();

    await vi.runAllTimersAsync();
    const results = await adapterPromise;

    expect(callCount).toBeGreaterThanOrEqual(2);
    expect(results.length).toBeGreaterThan(0);
    const warnMessages = warnSpy.mock.calls.map((c) => c[0] as string);
    expect(warnMessages.some((m) => m.includes("rate_limited"))).toBe(true);

    vi.useRealTimers();
  });
});

describe("ticketmaster startDateTime format — no fractional seconds", () => {
  it("sends startDateTime without milliseconds (.sssZ stripped)", async () => {
    vi.stubEnv("TICKETMASTER_API_KEY", "test-key");

    const capturedUrls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      capturedUrls.push(typeof input === "string" ? input : String(input));
      return new Response(
        JSON.stringify({
          _embedded: { events: [] },
          page: { size: 0, totalElements: 0, totalPages: 1, number: 0 },
        }),
        { status: 200 }
      );
    });

    const adapter = await getAdapter();
    await collectAll(adapter.fetchEvents());

    expect(capturedUrls.length).toBeGreaterThan(0);
    for (const url of capturedUrls) {
      const parsed = new URL(url);
      const startDateTime = parsed.searchParams.get("startDateTime");
      expect(startDateTime).not.toBeNull();
      expect(startDateTime).not.toMatch(/\.\d{3}Z$/);
      expect(startDateTime).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    }
  });
});

describe("ticketmaster isFree / price normalization — M3", () => {
  function makeEventWithPriceRange(priceRanges: unknown) {
    return {
      ...fixtureData._embedded.events[0],
      id: "test-price",
      dates: { start: { dateTime: "2030-01-01T20:00:00Z" } },
      priceRanges,
    };
  }

  function makeResponse(event: unknown) {
    return {
      _embedded: { events: [event] },
      page: { size: 20, totalElements: 1, totalPages: 1, number: 0 },
    };
  }

  it("missing priceRanges → isFree = false, price = undefined", async () => {
    vi.stubEnv("TICKETMASTER_API_KEY", "test-key");
    const event = makeEventWithPriceRange(undefined);
    delete (event as Record<string, unknown>).priceRanges;

    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(makeResponse(event)), { status: 200 })
    );

    const adapter = await getAdapter();
    const results = await collectAll(adapter.fetchEvents()) as Array<{
      isFree: boolean;
      price?: number;
    }>;
    expect(results[0].isFree).toBe(false);
    expect(results[0].price).toBeUndefined();
  });

  it("{ min: 0, max: 0 } → isFree = true, price = undefined", async () => {
    vi.stubEnv("TICKETMASTER_API_KEY", "test-key");
    const event = makeEventWithPriceRange([{ type: "standard", currency: "USD", min: 0, max: 0 }]);

    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(makeResponse(event)), { status: 200 })
    );

    const adapter = await getAdapter();
    const results = await collectAll(adapter.fetchEvents()) as Array<{
      isFree: boolean;
      price?: number;
    }>;
    expect(results[0].isFree).toBe(true);
    expect(results[0].price).toBeUndefined();
  });

  it("{ min: 25, max: 100 } → isFree = false, price = 2500", async () => {
    vi.stubEnv("TICKETMASTER_API_KEY", "test-key");
    const event = makeEventWithPriceRange([{ type: "standard", currency: "USD", min: 25, max: 100 }]);

    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify(makeResponse(event)), { status: 200 })
    );

    const adapter = await getAdapter();
    const results = await collectAll(adapter.fetchEvents()) as Array<{
      isFree: boolean;
      price?: number;
    }>;
    expect(results[0].isFree).toBe(false);
    expect(results[0].price).toBe(2500);
  });
});

describe("ticketmaster ticketUrl — XSS guard", () => {
  function makeEventWithUrl(url: unknown) {
    return {
      ...fixtureData._embedded.events[0],
      id: "tm-url-test",
      url,
      dates: { start: { dateTime: "2030-01-01T20:00:00Z" } },
    };
  }

  function makeResponse(event: unknown) {
    return {
      _embedded: { events: [event] },
      page: { size: 1, totalElements: 1, totalPages: 1, number: 0 },
    };
  }

  it("stores a valid https:// URL verbatim", async () => {
    vi.stubEnv("TICKETMASTER_API_KEY", "test-key");
    const event = makeEventWithUrl("https://www.ticketmaster.com/event/tm-url-test");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(makeResponse(event)), { status: 200 })
    );
    const adapter = await getAdapter();
    const results = await collectAll(adapter.fetchEvents()) as Array<{ ticketUrl: string }>;
    expect(results[0].ticketUrl).toBe("https://www.ticketmaster.com/event/tm-url-test");
  });

  it("falls back to canonical URL when API returns javascript: scheme", async () => {
    vi.stubEnv("TICKETMASTER_API_KEY", "test-key");
    const event = makeEventWithUrl("javascript:alert(1)");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(makeResponse(event)), { status: 200 })
    );
    const adapter = await getAdapter();
    const results = await collectAll(adapter.fetchEvents()) as Array<{ ticketUrl: string }>;
    expect(results[0].ticketUrl).toBe("https://www.ticketmaster.com/event/tm-url-test");
  });

  it("falls back to canonical URL when API returns http:// (insecure)", async () => {
    vi.stubEnv("TICKETMASTER_API_KEY", "test-key");
    const event = makeEventWithUrl("http://www.ticketmaster.com/event/tm-url-test");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(makeResponse(event)), { status: 200 })
    );
    const adapter = await getAdapter();
    const results = await collectAll(adapter.fetchEvents()) as Array<{ ticketUrl: string }>;
    expect(results[0].ticketUrl).toBe("https://www.ticketmaster.com/event/tm-url-test");
  });

  it("falls back to canonical URL when API returns undefined", async () => {
    vi.stubEnv("TICKETMASTER_API_KEY", "test-key");
    const base = { ...fixtureData._embedded.events[0], id: "tm-url-test", dates: { start: { dateTime: "2030-01-01T20:00:00Z" } } };
    delete (base as Record<string, unknown>).url;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(makeResponse(base)), { status: 200 })
    );
    const adapter = await getAdapter();
    const results = await collectAll(adapter.fetchEvents()) as Array<{ ticketUrl: string }>;
    expect(results[0].ticketUrl).toBe("https://www.ticketmaster.com/event/tm-url-test");
  });

  it("falls back to canonical URL when API returns null", async () => {
    vi.stubEnv("TICKETMASTER_API_KEY", "test-key");
    const event = makeEventWithUrl(null);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(makeResponse(event)), { status: 200 })
    );
    const adapter = await getAdapter();
    const results = await collectAll(adapter.fetchEvents()) as Array<{ ticketUrl: string }>;
    expect(results[0].ticketUrl).toBe("https://www.ticketmaster.com/event/tm-url-test");
  });
});

describe("ticketmaster category map completeness", () => {
  const segmentCases: Array<[string, string]> = [
    ["Music", "MUSIC"],
    ["Sports", "SPORTS"],
    ["Arts & Theatre", "ARTS_THEATER"],
    ["Film", "ARTS_THEATER"],
    ["Miscellaneous", "OTHER"],
    ["Undefined", "OTHER"],
  ];

  for (const [segment, expected] of segmentCases) {
    it(`maps segment "${segment}" to ${expected}`, async () => {
      vi.stubEnv("TICKETMASTER_API_KEY", "test-key");

      const eventWithSegment = {
        ...fixtureData._embedded.events[0],
        id: `test-${segment}`,
        classifications: [
          { primary: true, segment: { id: "seg-id", name: segment } },
        ],
        dates: {
          start: { dateTime: "2030-01-01T20:00:00Z" },
        },
      };

      const response = {
        _embedded: { events: [eventWithSegment] },
        page: { size: 20, totalElements: 1, totalPages: 1, number: 0 },
      };

      vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
        new Response(JSON.stringify(response), { status: 200 })
      );

      const adapter = await getAdapter();
      const results = await collectAll(adapter.fetchEvents()) as Array<{ category: string }>;
      expect(results[0].category).toBe(expected);
    });
  }

  it("logs and falls back to OTHER for unknown segment", async () => {
    vi.stubEnv("TICKETMASTER_API_KEY", "test-key");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const eventWithUnknown = {
      ...fixtureData._embedded.events[0],
      id: "test-unknown-seg",
      classifications: [
        { primary: true, segment: { id: "seg-id", name: "Quantum Events" } },
      ],
      dates: { start: { dateTime: "2030-01-01T20:00:00Z" } },
    };

    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({
          _embedded: { events: [eventWithUnknown] },
          page: { size: 20, totalElements: 1, totalPages: 1, number: 0 },
        }),
        { status: 200 }
      )
    );

    const adapter = await getAdapter();
    const results = await collectAll(adapter.fetchEvents()) as Array<{ category: string }>;
    expect(results[0].category).toBe("OTHER");
    const warnMessages = warnSpy.mock.calls.map((c) => c[0] as string);
    expect(warnMessages.some((m) => m.includes("unmapped_segment"))).toBe(true);
  });
});
