import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    subscription: { findUnique: vi.fn() },
    event: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    friendship: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/email/templates/event-invite", () => ({
  EventInviteEmail: vi.fn(() => null),
}));

vi.mock("@/lib/auth/rate-limit", () => ({
  createEventInviteRateLimiter: vi.fn(() => ({
    limit: vi.fn().mockResolvedValue({ success: true }),
  })),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/send";
import { createEventInviteRateLimiter } from "@/lib/auth/rate-limit";
import { POST } from "@/app/api/events/[id]/invite/route";

const mockAuth = vi.mocked(auth);
const mockSubscriptionFind = vi.mocked(prisma.subscription.findUnique);
const mockEventFind = vi.mocked(prisma.event.findUnique);
const mockUserFind = vi.mocked(prisma.user.findUnique);
const mockUserFindMany = vi.mocked(prisma.user.findMany);
const mockFriendshipFindMany = vi.mocked(prisma.friendship.findMany);
const mockSendEmail = vi.mocked(sendEmail);
const mockInviteLimiter = vi.mocked(createEventInviteRateLimiter);

const PRO_SESSION = { user: { id: "pro-user" } };
const FREE_SESSION = { user: { id: "free-user" } };
const PARAMS = Promise.resolve({ id: "evt-1" });

const ACTIVE_EVENT = {
  id: "evt-1",
  title: "Test Event",
  startTime: new Date("2026-09-01T18:00:00Z"),
  venue: "Test Venue",
  isActive: true,
};

function makePostReq(body: unknown): Request {
  return new Request("http://localhost/api/events/evt-1/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function setupProUser() {
  mockSubscriptionFind.mockResolvedValueOnce({ status: "ACTIVE" } as never);
}

function setupFreeUser() {
  mockSubscriptionFind.mockResolvedValueOnce({ status: "FREE" } as never);
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.NEXTAUTH_URL = "https://app.example.com";
  mockInviteLimiter.mockReturnValue({
    limit: vi.fn().mockResolvedValue({ success: true }),
  } as never);
});

describe("POST /api/events/[id]/invite", () => {
  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await POST(makePostReq({ friendIds: [] }), { params: PARAMS });
    expect(res.status).toBe(401);
  });

  it("returns 403 for FREE user with code PRO_REQUIRED", async () => {
    mockAuth.mockResolvedValueOnce(FREE_SESSION as never);
    setupFreeUser();

    const res = await POST(makePostReq({ friendIds: ["f-1"] }), { params: PARAMS });
    expect(res.status).toBe(403);
    const json = await res.json() as { code: string };
    expect(json.code).toBe("PRO_REQUIRED");
  });

  it("returns 403 for PAST_DUE subscription", async () => {
    mockAuth.mockResolvedValueOnce(FREE_SESSION as never);
    mockSubscriptionFind.mockResolvedValueOnce({ status: "PAST_DUE" } as never);

    const res = await POST(makePostReq({ friendIds: ["f-1"] }), { params: PARAMS });
    expect(res.status).toBe(403);
  });

  it("returns 403 for CANCELED subscription", async () => {
    mockAuth.mockResolvedValueOnce(FREE_SESSION as never);
    mockSubscriptionFind.mockResolvedValueOnce({ status: "CANCELED" } as never);

    const res = await POST(makePostReq({ friendIds: ["f-1"] }), { params: PARAMS });
    expect(res.status).toBe(403);
  });

  it("returns 403 when subscription row is null", async () => {
    mockAuth.mockResolvedValueOnce(FREE_SESSION as never);
    mockSubscriptionFind.mockResolvedValueOnce(null as never);

    const res = await POST(makePostReq({ friendIds: ["f-1"] }), { params: PARAMS });
    expect(res.status).toBe(403);
  });

  it("returns 500 when NEXTAUTH_URL is unset", async () => {
    delete process.env.NEXTAUTH_URL;
    mockAuth.mockResolvedValueOnce(PRO_SESSION as never);
    setupProUser();

    const res = await POST(makePostReq({ friendIds: ["f-1"] }), { params: PARAMS });
    expect(res.status).toBe(500);
  });

  it("returns 400 when friendIds exceeds 20", async () => {
    mockAuth.mockResolvedValueOnce(PRO_SESSION as never);
    setupProUser();

    const friendIds = Array.from({ length: 21 }, (_, i) => `f-${i}`);
    const res = await POST(makePostReq({ friendIds }), { params: PARAMS });
    expect(res.status).toBe(400);
  });

  it("returns 404 when event does not exist", async () => {
    mockAuth.mockResolvedValueOnce(PRO_SESSION as never);
    setupProUser();
    mockUserFind.mockResolvedValueOnce({ name: "Pro User" } as never);
    mockEventFind.mockResolvedValueOnce(null as never);

    const res = await POST(makePostReq({ friendIds: ["f-1"] }), { params: PARAMS });
    expect(res.status).toBe(404);
  });

  it("returns 404 when event is inactive", async () => {
    mockAuth.mockResolvedValueOnce(PRO_SESSION as never);
    setupProUser();
    mockUserFind.mockResolvedValueOnce({ name: "Pro User" } as never);
    mockEventFind.mockResolvedValueOnce({ ...ACTIVE_EVENT, isActive: false } as never);

    const res = await POST(makePostReq({ friendIds: ["f-1"] }), { params: PARAMS });
    expect(res.status).toBe(404);
  });

  it("silently drops non-friends from the send list (single DB query)", async () => {
    mockAuth.mockResolvedValueOnce(PRO_SESSION as never);
    setupProUser();
    mockEventFind.mockResolvedValueOnce(ACTIVE_EVENT as never);
    mockUserFind.mockResolvedValueOnce({ name: "Pro User" } as never);
    // Only f-1 is a confirmed friend (pro-user < f-1 lexicographically)
    mockFriendshipFindMany.mockResolvedValueOnce([
      { userAId: "f-1", userBId: "pro-user" },
    ] as never);
    mockUserFindMany.mockResolvedValueOnce([
      { id: "f-1", email: "friend@example.com", name: "Alice" },
    ] as never);
    mockSendEmail.mockResolvedValueOnce(undefined);

    const res = await POST(makePostReq({ friendIds: ["f-1", "f-2"] }), { params: PARAMS });
    expect(res.status).toBe(200);
    const json = await res.json() as { sent: number; droppedNonFriend: number; droppedEmailFailure: number };
    expect(json.sent).toBe(1);
    expect(json.droppedNonFriend).toBe(1);
    expect(json.droppedEmailFailure).toBe(0);
    // Confirm only one friendship DB call was made (not N calls)
    expect(mockFriendshipFindMany).toHaveBeenCalledTimes(1);
  });

  it("returns { sent, droppedNonFriend, droppedEmailFailure } shape", async () => {
    mockAuth.mockResolvedValueOnce(PRO_SESSION as never);
    setupProUser();
    mockEventFind.mockResolvedValueOnce(ACTIVE_EVENT as never);
    mockUserFind.mockResolvedValueOnce({ name: "Pro User" } as never);
    mockFriendshipFindMany.mockResolvedValueOnce([
      { userAId: "f-1", userBId: "pro-user" },
      { userAId: "f-2", userBId: "pro-user" },
    ] as never);
    mockUserFindMany.mockResolvedValueOnce([
      { id: "f-1", email: "a@x.com", name: "Alice" },
      { id: "f-2", email: "b@x.com", name: "Bob" },
    ] as never);
    mockSendEmail.mockResolvedValue(undefined);

    const res = await POST(makePostReq({ friendIds: ["f-1", "f-2"] }), { params: PARAMS });
    expect(res.status).toBe(200);
    const json = await res.json() as { sent: number; droppedNonFriend: number; droppedEmailFailure: number };
    expect(json.sent).toBe(2);
    expect(json.droppedNonFriend).toBe(0);
    expect(json.droppedEmailFailure).toBe(0);
  });

  it("returns { sent: 0, droppedNonFriend: N } when all friendIds are non-friends", async () => {
    mockAuth.mockResolvedValueOnce(PRO_SESSION as never);
    setupProUser();
    mockEventFind.mockResolvedValueOnce(ACTIVE_EVENT as never);
    mockUserFind.mockResolvedValueOnce({ name: "Pro User" } as never);
    mockFriendshipFindMany.mockResolvedValueOnce([] as never);

    const res = await POST(makePostReq({ friendIds: ["stranger-1", "stranger-2"] }), { params: PARAMS });
    expect(res.status).toBe(200);
    const json = await res.json() as { sent: number; droppedNonFriend: number; droppedEmailFailure: number };
    expect(json.sent).toBe(0);
    expect(json.droppedNonFriend).toBe(2);
    expect(json.droppedEmailFailure).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("counts email failures separately from non-friend drops", async () => {
    mockAuth.mockResolvedValueOnce(PRO_SESSION as never);
    setupProUser();
    mockEventFind.mockResolvedValueOnce(ACTIVE_EVENT as never);
    mockUserFind.mockResolvedValueOnce({ name: "Pro User" } as never);
    mockFriendshipFindMany.mockResolvedValueOnce([
      { userAId: "f-1", userBId: "pro-user" },
      { userAId: "f-2", userBId: "pro-user" },
    ] as never);
    mockUserFindMany.mockResolvedValueOnce([
      { id: "f-1", email: "a@x.com", name: "Alice" },
      { id: "f-2", email: "b@x.com", name: "Bob" },
    ] as never);
    // f-1 succeeds, f-2 fails at email send
    mockSendEmail
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Resend outage"));

    const res = await POST(makePostReq({ friendIds: ["f-1", "f-2"] }), { params: PARAMS });
    expect(res.status).toBe(200);
    const json = await res.json() as { sent: number; droppedNonFriend: number; droppedEmailFailure: number };
    expect(json.sent).toBe(1);
    expect(json.droppedNonFriend).toBe(0);
    expect(json.droppedEmailFailure).toBe(1);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    mockAuth.mockResolvedValueOnce(PRO_SESSION as never);
    setupProUser();
    mockInviteLimiter.mockReturnValue({
      limit: vi.fn().mockResolvedValue({ success: false }),
    } as never);

    const res = await POST(makePostReq({ friendIds: ["f-1"] }), { params: PARAMS });
    expect(res.status).toBe(429);
  });
});
