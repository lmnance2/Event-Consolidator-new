import { describe, it, expect, vi, beforeEach } from "vitest";
import { Category, ExperienceType } from "@prisma/client";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/events/feed-query", () => ({
  getFeedPage: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { getFeedPage } from "@/lib/events/feed-query";
import { GET } from "@/app/api/events/route";

const mockAuth = vi.mocked(auth);
const mockUserFind = vi.mocked(prisma.user.findUnique);
const mockGetFeedPage = vi.mocked(getFeedPage);

const SESSION = { user: { id: "user-1" } };

const DB_USER = {
  latitude: 40.7128,
  longitude: -74.006,
  preferences: {
    disabledCategories: [],
    maxDistanceMiles: 25,
    dateRangeDays: 30,
    priceMin: null,
    priceMax: null,
    experienceType: "BOTH",
    familyFriendly: false,
  },
  subscription: { status: "FREE" },
};

const FEED_PAGE = {
  rows: [
    {
      id: "evt-1",
      title: "Rock Concert",
      description: null,
      imageUrl: null,
      startTime: "2027-01-15T20:00:00.000Z",
      endTime: null,
      venueName: "Venue, NYC, NY",
      venueAddress: "Venue, NYC, NY",
      latitude: 40.71,
      longitude: -74.01,
      distanceMi: 0.2,
      category: Category.MUSIC,
      priceMin: null,
      priceMax: null,
      isFree: false,
      performerName: null,
      ticketUrl: "https://tm.com/evt-1",
      provider: "TICKETMASTER" as const,
    },
  ],
  nextCursor: null,
};

function makeRequest(url: string): Request {
  return new Request(url);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/events", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await GET(makeRequest("http://localhost/api/events"));
    expect(res.status).toBe(401);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Unauthorized");
    expect(mockUserFind).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid dist param (out of range)", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    const res = await GET(makeRequest("http://localhost/api/events?dist=999"));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Invalid request");
  });

  it("returns 400 for invalid days param (0 is below min)", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    const res = await GET(makeRequest("http://localhost/api/events?days=0"));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Invalid request");
  });

  it("returns 400 for invalid limit param (> 50)", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    const res = await GET(makeRequest("http://localhost/api/events?limit=100"));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Invalid request");
  });

  it("returns 400 for invalid cat param (unknown category)", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    const res = await GET(makeRequest("http://localhost/api/events?cat=FAKE_CATEGORY"));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Invalid request");
  });

  it("returns 400 when user has no lat/lng and client supplies none", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockUserFind.mockResolvedValueOnce({
      ...DB_USER,
      latitude: null,
      longitude: null,
    } as never);
    const res = await GET(makeRequest("http://localhost/api/events"));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Location required");
  });

  it("returns 400 when client-supplied lat is out of range", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    const res = await GET(makeRequest("http://localhost/api/events?lat=91&lng=0"));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Invalid request");
  });

  it("returns 200 with FeedPage on success", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockUserFind.mockResolvedValueOnce(DB_USER as never);
    mockGetFeedPage.mockResolvedValueOnce(FEED_PAGE);

    const res = await GET(makeRequest("http://localhost/api/events"));
    expect(res.status).toBe(200);
    const json = await res.json() as typeof FEED_PAGE;
    expect(json.rows).toHaveLength(1);
    expect(json.rows[0]!.id).toBe("evt-1");
    expect(json.nextCursor).toBeNull();
  });

  it("prefers client-supplied lat/lng over DB user coords", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockUserFind.mockResolvedValueOnce(DB_USER as never);
    mockGetFeedPage.mockResolvedValueOnce(FEED_PAGE);

    await GET(makeRequest("http://localhost/api/events?lat=34.05&lng=-118.24"));

    const callArg = mockGetFeedPage.mock.calls[0]![0];
    expect(callArg.origin).toEqual({ lat: 34.05, lng: -118.24 });
  });

  it("falls back to DB lat/lng when client does not supply coords", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockUserFind.mockResolvedValueOnce(DB_USER as never);
    mockGetFeedPage.mockResolvedValueOnce(FEED_PAGE);

    await GET(makeRequest("http://localhost/api/events"));

    const callArg = mockGetFeedPage.mock.calls[0]![0];
    expect(callArg.origin).toEqual({ lat: 40.7128, lng: -74.006 });
  });

  it("passes isPro=false for FREE subscription", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockUserFind.mockResolvedValueOnce(DB_USER as never);
    mockGetFeedPage.mockResolvedValueOnce(FEED_PAGE);

    await GET(makeRequest("http://localhost/api/events"));

    const callArg = mockGetFeedPage.mock.calls[0]![0];
    expect(callArg.isPro).toBe(false);
  });

  it("passes isPro=true for ACTIVE subscription", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockUserFind.mockResolvedValueOnce({
      ...DB_USER,
      subscription: { status: "ACTIVE" },
    } as never);
    mockGetFeedPage.mockResolvedValueOnce(FEED_PAGE);

    await GET(makeRequest("http://localhost/api/events"));

    const callArg = mockGetFeedPage.mock.calls[0]![0];
    expect(callArg.isPro).toBe(true);
  });

  it("parses comma-separated cat param into array", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockUserFind.mockResolvedValueOnce(DB_USER as never);
    mockGetFeedPage.mockResolvedValueOnce(FEED_PAGE);

    await GET(makeRequest("http://localhost/api/events?cat=MUSIC,SPORTS"));

    const callArg = mockGetFeedPage.mock.calls[0]![0];
    expect(callArg.filters.categories).toEqual([Category.MUSIC, Category.SPORTS]);
  });

  it("passes experienceType from exp param", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockUserFind.mockResolvedValueOnce({
      ...DB_USER,
      subscription: { status: "ACTIVE" },
    } as never);
    mockGetFeedPage.mockResolvedValueOnce(FEED_PAGE);

    await GET(makeRequest("http://localhost/api/events?exp=INDOOR"));

    const callArg = mockGetFeedPage.mock.calls[0]![0];
    expect(callArg.filters.experienceType).toBe(ExperienceType.INDOOR);
  });

  it("returns 500 on unexpected DB error, with generic message", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockUserFind.mockRejectedValueOnce(new Error("DB down") as never);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await GET(makeRequest("http://localhost/api/events"));
    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Something went wrong");
    expect(spy).toHaveBeenCalled();
  });

  it("returns 500 on feed-query error, with generic message", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockUserFind.mockResolvedValueOnce(DB_USER as never);
    mockGetFeedPage.mockRejectedValueOnce(new Error("Query timeout"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await GET(makeRequest("http://localhost/api/events"));
    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Something went wrong");
    expect(spy).toHaveBeenCalled();
  });
});
