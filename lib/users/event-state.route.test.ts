import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    savedEvent: { findMany: vi.fn() },
    goingEvent: { findMany: vi.fn() },
    subscription: { findUnique: vi.fn() },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { GET } from "@/app/api/users/me/event-state/route";

const mockAuth = vi.mocked(auth);
const mockSavedFindMany = vi.mocked(prisma.savedEvent.findMany);
const mockGoingFindMany = vi.mocked(prisma.goingEvent.findMany);
const mockSubscriptionFind = vi.mocked(prisma.subscription.findUnique);

const SESSION_1 = { user: { id: "user-1" } };

function setupEmpty(subscriptionStatus: string | null) {
  mockSavedFindMany.mockResolvedValueOnce([] as never);
  mockGoingFindMany.mockResolvedValueOnce([] as never);
  mockSubscriptionFind.mockResolvedValueOnce(
    (subscriptionStatus !== null ? { status: subscriptionStatus } : null) as never
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/users/me/event-state", () => {
  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await GET();
    expect(res.status).toBe(401);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Unauthorized");
    expect(mockSavedFindMany).not.toHaveBeenCalled();
    expect(mockGoingFindMany).not.toHaveBeenCalled();
  });

  it("returns 200 with empty arrays when user has no saves or going", async () => {
    mockAuth.mockResolvedValueOnce(SESSION_1 as never);
    setupEmpty("FREE");

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json() as { saved: string[]; going: string[]; isPro: boolean };
    expect(json.saved).toEqual([]);
    expect(json.going).toEqual([]);
  });

  it("returns correct saved and going event ID arrays", async () => {
    mockAuth.mockResolvedValueOnce(SESSION_1 as never);
    mockSavedFindMany.mockResolvedValueOnce([
      { eventId: "evt-a" },
      { eventId: "evt-b" },
    ] as never);
    mockGoingFindMany.mockResolvedValueOnce([
      { eventId: "evt-c" },
    ] as never);
    mockSubscriptionFind.mockResolvedValueOnce({ status: "FREE" } as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json() as { saved: string[]; going: string[] };
    expect(json.saved).toEqual(["evt-a", "evt-b"]);
    expect(json.going).toEqual(["evt-c"]);
  });

  it("queries only the authenticated user's events (userId scoped)", async () => {
    mockAuth.mockResolvedValueOnce(SESSION_1 as never);
    setupEmpty("FREE");

    await GET();

    expect(mockSavedFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    );
    expect(mockGoingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    );
  });

  it("sets Cache-Control: private, no-store header", async () => {
    mockAuth.mockResolvedValueOnce(SESSION_1 as never);
    setupEmpty("FREE");

    const res = await GET();
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("returns isPro: false for FREE user", async () => {
    mockAuth.mockResolvedValueOnce(SESSION_1 as never);
    setupEmpty("FREE");

    const res = await GET();
    const json = await res.json() as { isPro: boolean };
    expect(json.isPro).toBe(false);
  });

  it("returns isPro: true for ACTIVE subscription", async () => {
    mockAuth.mockResolvedValueOnce(SESSION_1 as never);
    setupEmpty("ACTIVE");

    const res = await GET();
    const json = await res.json() as { isPro: boolean };
    expect(json.isPro).toBe(true);
  });

  it("returns isPro: false for PAST_DUE subscription", async () => {
    mockAuth.mockResolvedValueOnce(SESSION_1 as never);
    setupEmpty("PAST_DUE");

    const res = await GET();
    const json = await res.json() as { isPro: boolean };
    expect(json.isPro).toBe(false);
  });

  it("returns isPro: false for CANCELED subscription", async () => {
    mockAuth.mockResolvedValueOnce(SESSION_1 as never);
    setupEmpty("CANCELED");

    const res = await GET();
    const json = await res.json() as { isPro: boolean };
    expect(json.isPro).toBe(false);
  });

  it("returns isPro: false when subscription row is missing", async () => {
    mockAuth.mockResolvedValueOnce(SESSION_1 as never);
    setupEmpty(null);

    const res = await GET();
    const json = await res.json() as { isPro: boolean };
    expect(json.isPro).toBe(false);
  });
});
