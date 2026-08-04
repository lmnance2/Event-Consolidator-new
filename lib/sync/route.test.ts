import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/sync/run", () => ({
  runSync: vi.fn(),
}));

const CRON_SECRET = "test-secret-123";

const mockSyncSummary = {
  providers: {
    TICKETMASTER: { status: "ok" as const, fetched: 10, normalized: 9, upserted: 9, skipped: 1, metroFailures: [] },
    EVENTBRITE: { status: "ok" as const, fetched: 5, normalized: 5, upserted: 5, skipped: 0, metroFailures: [] },
    MEETUP: { status: "ok" as const, fetched: 3, normalized: 3, upserted: 3, skipped: 0, metroFailures: [] },
  },
  crossProviderDeduped: 1,
  cleanup: { softDeleted: 2, hardDeleted: 1 },
  durationMs: 1234,
};

import { GET } from "../../app/api/sync/run/route";
import { runSync } from "@/lib/sync/run";

function makeRequest(authHeader?: string): Request {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) {
    headers["Authorization"] = authHeader;
  }
  return new Request("http://localhost:3000/api/sync/run", { headers });
}

describe("GET /api/sync/run", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
    vi.mocked(runSync).mockResolvedValue(mockSyncSummary);
    vi.clearAllMocks();
    vi.mocked(runSync).mockResolvedValue(mockSyncSummary);
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when bearer token is wrong", async () => {
    const res = await GET(makeRequest("Bearer wrong-secret"));
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when Authorization header is malformed (no Bearer prefix)", async () => {
    const res = await GET(makeRequest(CRON_SECRET));
    expect(res.status).toBe(401);
  });

  it("returns 401 when CRON_SECRET env var is not set", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(401);
  });

  it("returns 200 with summary counts on valid bearer token", async () => {
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json() as {
      ok: boolean;
      providers: Record<string, unknown>;
      crossProviderDeduped: number;
      cleanup: unknown;
      durationMs: number;
    };
    expect(body.ok).toBe(true);
    expect(body.providers).toBeDefined();
    expect(body.crossProviderDeduped).toBe(1);
    expect(body.cleanup).toBeDefined();
    expect(typeof body.durationMs).toBe("number");
  });

  it("includes per-provider counts in the response", async () => {
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    const body = await res.json() as {
      providers: {
        TICKETMASTER: { fetched: number; upserted: number };
        EVENTBRITE: { fetched: number };
        MEETUP: { fetched: number };
      };
    };
    expect(body.providers.TICKETMASTER.fetched).toBe(10);
    expect(body.providers.TICKETMASTER.upserted).toBe(9);
    expect(body.providers.EVENTBRITE.fetched).toBe(5);
    expect(body.providers.MEETUP.fetched).toBe(3);
  });

  it("calls runSync exactly once per valid request", async () => {
    await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(runSync).toHaveBeenCalledTimes(1);
  });

  it("does not call runSync when auth fails", async () => {
    await GET(makeRequest("Bearer wrong"));
    expect(runSync).not.toHaveBeenCalled();
  });

  it("exposes metroFailures in provider counts when all metros fail", async () => {
    vi.mocked(runSync).mockResolvedValue({
      providers: {
        TICKETMASTER: {
          status: "all_metros_failed",
          fetched: 0,
          normalized: 0,
          upserted: 0,
          skipped: 0,
          metroFailures: ["NYC", "LA", "Chicago", "SF", "Austin"],
        },
        EVENTBRITE: {
          status: "all_metros_failed",
          fetched: 0,
          normalized: 0,
          upserted: 0,
          skipped: 0,
          metroFailures: ["NYC", "LA", "Chicago", "SF", "Austin"],
        },
        MEETUP: {
          status: "all_metros_failed",
          fetched: 0,
          normalized: 0,
          upserted: 0,
          skipped: 0,
          metroFailures: ["NYC", "LA", "Chicago", "SF", "Austin"],
        },
      },
      crossProviderDeduped: 0,
      cleanup: { softDeleted: 0, hardDeleted: 0 },
      durationMs: 500,
    });

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json() as {
      ok: boolean;
      providers: {
        TICKETMASTER: { status: string; metroFailures: string[] };
      };
    };
    expect(body.ok).toBe(true);
    expect(body.providers.TICKETMASTER.status).toBe("all_metros_failed");
    expect(body.providers.TICKETMASTER.metroFailures).toHaveLength(5);
  });

  it("exposes metroFailures in provider counts when some metros fail", async () => {
    vi.mocked(runSync).mockResolvedValue({
      providers: {
        TICKETMASTER: {
          status: "ok",
          fetched: 15,
          normalized: 15,
          upserted: 15,
          skipped: 0,
          metroFailures: ["SF"],
        },
        EVENTBRITE: {
          status: "ok",
          fetched: 10,
          normalized: 10,
          upserted: 10,
          skipped: 0,
          metroFailures: [],
        },
        MEETUP: {
          status: "ok",
          fetched: 0,
          normalized: 0,
          upserted: 0,
          skipped: 0,
          metroFailures: ["Austin"],
        },
      },
      crossProviderDeduped: 0,
      cleanup: { softDeleted: 0, hardDeleted: 0 },
      durationMs: 800,
    });

    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json() as {
      ok: boolean;
      providers: {
        TICKETMASTER: { status: string; metroFailures: string[] };
        MEETUP: { status: string; metroFailures: string[] };
      };
    };
    expect(body.providers.TICKETMASTER.status).toBe("ok");
    expect(body.providers.TICKETMASTER.metroFailures).toEqual(["SF"]);
    expect(body.providers.MEETUP.metroFailures).toEqual(["Austin"]);
  });
});
