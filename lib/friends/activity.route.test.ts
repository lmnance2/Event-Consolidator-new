import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    subscription: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/friends/activity", () => ({
  getFriendActivityPage: vi.fn(),
  decodeActivityCursor: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { getFriendActivityPage, decodeActivityCursor } from "@/lib/friends/activity";
import { GET } from "@/app/api/social/activity/route";

const mockAuth = vi.mocked(auth);
const mockSubscriptionFind = vi.mocked(prisma.subscription.findUnique);
const mockGetActivityPage = vi.mocked(getFriendActivityPage);
const mockDecodeActivityCursor = vi.mocked(decodeActivityCursor);

const PRO_SESSION = { user: { id: "pro-user" } };
const FREE_SESSION = { user: { id: "free-user" } };

function makeGetReq(cursor?: string): Request {
  const url = cursor
    ? `http://localhost/api/social/activity?cursor=${cursor}`
    : "http://localhost/api/social/activity";
  return new Request(url, { method: "GET" });
}

const MOCK_ITEM = {
  id: "going-1",
  kind: "GOING" as const,
  createdAt: "2026-07-01T10:00:00.000Z",
  actor: { id: "friend-1", name: "Alice", image: null },
  event: {
    id: "evt-1",
    title: "Test Event",
    imageUrl: null,
    startTime: "2026-09-01T18:00:00.000Z",
    category: "MUSIC",
  },
};

beforeEach(() => {
  vi.resetAllMocks();
  mockDecodeActivityCursor.mockReturnValue(null);
});

describe("GET /api/social/activity", () => {
  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await GET(makeGetReq());
    expect(res.status).toBe(401);
  });

  it("returns 403 for FREE user", async () => {
    mockAuth.mockResolvedValueOnce(FREE_SESSION as never);
    mockSubscriptionFind.mockResolvedValueOnce({ status: "FREE" } as never);

    const res = await GET(makeGetReq());
    expect(res.status).toBe(403);
    const json = await res.json() as { code: string };
    expect(json.code).toBe("PRO_REQUIRED");
  });

  it("returns 403 for PAST_DUE", async () => {
    mockAuth.mockResolvedValueOnce(FREE_SESSION as never);
    mockSubscriptionFind.mockResolvedValueOnce({ status: "PAST_DUE" } as never);

    const res = await GET(makeGetReq());
    expect(res.status).toBe(403);
  });

  it("returns 403 for null subscription", async () => {
    mockAuth.mockResolvedValueOnce(FREE_SESSION as never);
    mockSubscriptionFind.mockResolvedValueOnce(null as never);

    const res = await GET(makeGetReq());
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid cursor", async () => {
    mockAuth.mockResolvedValueOnce(PRO_SESSION as never);
    mockSubscriptionFind.mockResolvedValueOnce({ status: "ACTIVE" } as never);
    mockDecodeActivityCursor.mockReturnValue(null);

    const res = await GET(makeGetReq("not-valid-base64url!!!"));
    expect(res.status).toBe(400);
  });

  it("returns items and nextCursor from getFriendActivityPage", async () => {
    mockAuth.mockResolvedValueOnce(PRO_SESSION as never);
    mockSubscriptionFind.mockResolvedValueOnce({ status: "ACTIVE" } as never);
    mockGetActivityPage.mockResolvedValueOnce({
      items: [MOCK_ITEM],
      nextCursor: null,
    });

    const res = await GET(makeGetReq());
    expect(res.status).toBe(200);
    const json = await res.json() as { items: typeof MOCK_ITEM[]; nextCursor: null };
    expect(json.items).toHaveLength(1);
    expect(json.items[0].id).toBe("going-1");
    expect(json.nextCursor).toBeNull();
  });

  it("passes cursor: null to getFriendActivityPage when no cursor param", async () => {
    mockAuth.mockResolvedValueOnce(PRO_SESSION as never);
    mockSubscriptionFind.mockResolvedValueOnce({ status: "ACTIVE" } as never);
    mockGetActivityPage.mockResolvedValueOnce({ items: [], nextCursor: null });

    await GET(makeGetReq());
    expect(mockGetActivityPage).toHaveBeenCalledWith({ userId: "pro-user", cursor: null });
  });

  it("passes decoded cursor to getFriendActivityPage", async () => {
    const decodedCursor = { createdAt: "2026-07-01T10:00:00.000Z", id: "going-1", kind: "GOING" as const };
    mockAuth.mockResolvedValueOnce(PRO_SESSION as never);
    mockSubscriptionFind.mockResolvedValueOnce({ status: "ACTIVE" } as never);
    mockDecodeActivityCursor.mockReturnValue(decodedCursor);
    mockGetActivityPage.mockResolvedValueOnce({ items: [], nextCursor: null });

    await GET(makeGetReq("some-cursor"));
    expect(mockGetActivityPage).toHaveBeenCalledWith({ userId: "pro-user", cursor: decodedCursor });
  });

  it("returns 500 on unexpected error", async () => {
    mockAuth.mockResolvedValueOnce(PRO_SESSION as never);
    mockSubscriptionFind.mockResolvedValueOnce({ status: "ACTIVE" } as never);
    mockGetActivityPage.mockRejectedValueOnce(new Error("DB error"));

    const res = await GET(makeGetReq());
    expect(res.status).toBe(500);
  });
});
