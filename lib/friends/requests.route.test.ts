import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    friendship: { findUnique: vi.fn() },
    friendRequest: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Rate limiters: allow by default, can override per test
vi.mock("@/lib/auth/rate-limit", () => ({
  createFriendRequestTupleRateLimiter: vi.fn(() => ({
    limit: vi.fn().mockResolvedValue({ success: true }),
  })),
  createFriendRequestSenderRateLimiter: vi.fn(() => ({
    limit: vi.fn().mockResolvedValue({ success: true }),
  })),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { createFriendRequestTupleRateLimiter } from "@/lib/auth/rate-limit";
import { POST, GET } from "@/app/api/friends/requests/route";

const mockAuth = vi.mocked(auth);
const mockUserFind = vi.mocked(prisma.user.findUnique);
const mockFriendshipFind = vi.mocked(prisma.friendship.findUnique);
const mockRequestFindFirst = vi.mocked(prisma.friendRequest.findFirst);
const mockRequestCreate = vi.mocked(prisma.friendRequest.create);
const mockRequestFindMany = vi.mocked(prisma.friendRequest.findMany);
const mockTupleLimiter = vi.mocked(createFriendRequestTupleRateLimiter);

const SESSION = { user: { id: "sender-1" } };

function makePostReq(email: string): Request {
  return new Request("http://localhost/api/friends/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

const SILENT_OK = { ok: true };

beforeEach(() => {
  vi.resetAllMocks();
  // Restore default allow
  mockTupleLimiter.mockReturnValue({
    limit: vi.fn().mockResolvedValue({ success: true }),
  } as never);
});

describe("POST /api/friends/requests", () => {
  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await POST(makePostReq("a@b.com"));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid email", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    const res = await POST(
      new Request("http://localhost/api/friends/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 429 with silent body when rate limit is hit", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockTupleLimiter.mockReturnValue({
      limit: vi.fn().mockResolvedValue({ success: false }),
    } as never);

    const res = await POST(makePostReq("a@b.com"));
    expect(res.status).toBe(429);
    const json = await res.json() as typeof SILENT_OK;
    expect(json).toEqual(SILENT_OK);
    expect(mockRequestCreate).not.toHaveBeenCalled();
  });

  it("returns silent 200 for unknown email", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockUserFind.mockResolvedValueOnce(null as never);

    const res = await POST(makePostReq("unknown@example.com"));
    expect(res.status).toBe(200);
    const json = await res.json() as typeof SILENT_OK;
    expect(json).toEqual(SILENT_OK);
    expect(mockRequestCreate).not.toHaveBeenCalled();
  });

  it("returns silent 200 for self-request", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockUserFind.mockResolvedValueOnce({ id: "sender-1" } as never);

    const res = await POST(makePostReq("self@example.com"));
    expect(res.status).toBe(200);
    const json = await res.json() as typeof SILENT_OK;
    expect(json).toEqual(SILENT_OK);
    expect(mockRequestCreate).not.toHaveBeenCalled();
  });

  it("returns silent 200 for existing friendship", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockUserFind.mockResolvedValueOnce({ id: "other-1" } as never);
    mockFriendshipFind.mockResolvedValueOnce({ id: "fs-1" } as never);

    const res = await POST(makePostReq("friend@example.com"));
    expect(res.status).toBe(200);
    const json = await res.json() as typeof SILENT_OK;
    expect(json).toEqual(SILENT_OK);
    expect(mockRequestCreate).not.toHaveBeenCalled();
  });

  it("returns silent 200 for existing PENDING request (sender → recipient)", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockUserFind.mockResolvedValueOnce({ id: "other-1" } as never);
    mockFriendshipFind.mockResolvedValueOnce(null as never);
    mockRequestFindFirst.mockResolvedValueOnce({ id: "req-1" } as never);

    const res = await POST(makePostReq("pending@example.com"));
    expect(res.status).toBe(200);
    const json = await res.json() as typeof SILENT_OK;
    expect(json).toEqual(SILENT_OK);
    expect(mockRequestCreate).not.toHaveBeenCalled();
  });

  it("returns silent 200 for existing PENDING request (recipient → sender)", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockUserFind.mockResolvedValueOnce({ id: "other-1" } as never);
    mockFriendshipFind.mockResolvedValueOnce(null as never);
    // Simulates the reverse-direction pending request
    mockRequestFindFirst.mockResolvedValueOnce({ id: "req-reverse" } as never);

    const res = await POST(makePostReq("reverse@example.com"));
    expect(res.status).toBe(200);
    const json = await res.json() as typeof SILENT_OK;
    expect(json).toEqual(SILENT_OK);
    expect(mockRequestCreate).not.toHaveBeenCalled();
  });

  it("response body is identical across all silent paths", async () => {
    // Collect the bodies for: unknown email, self, existing friendship, existing pending
    const bodies: unknown[] = [];

    // unknown email
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockUserFind.mockResolvedValueOnce(null as never);
    bodies.push(await (await POST(makePostReq("a@b.com"))).json());

    // self
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockUserFind.mockResolvedValueOnce({ id: "sender-1" } as never);
    bodies.push(await (await POST(makePostReq("b@b.com"))).json());

    // existing friendship
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockUserFind.mockResolvedValueOnce({ id: "other-2" } as never);
    mockFriendshipFind.mockResolvedValueOnce({ id: "fs-2" } as never);
    bodies.push(await (await POST(makePostReq("c@b.com"))).json());

    // existing pending
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockUserFind.mockResolvedValueOnce({ id: "other-3" } as never);
    mockFriendshipFind.mockResolvedValueOnce(null as never);
    mockRequestFindFirst.mockResolvedValueOnce({ id: "req-2" } as never);
    bodies.push(await (await POST(makePostReq("d@b.com"))).json());

    // All four should be identical
    for (const body of bodies) {
      expect(body).toEqual(SILENT_OK);
    }
  });

  it("creates a friend request when all guards pass", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockUserFind.mockResolvedValueOnce({ id: "other-99" } as never);
    mockFriendshipFind.mockResolvedValueOnce(null as never);
    mockRequestFindFirst.mockResolvedValueOnce(null as never);
    mockRequestCreate.mockResolvedValueOnce({ id: "new-req" } as never);

    const res = await POST(makePostReq("new@example.com"));
    expect(res.status).toBe(200);
    expect(mockRequestCreate).toHaveBeenCalledWith({
      data: { fromUserId: "sender-1", toUserId: "other-99" },
    });
  });
});

describe("GET /api/friends/requests", () => {
  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns incoming and outgoing arrays", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockRequestFindMany
      .mockResolvedValueOnce([
        {
          id: "req-in-1",
          createdAt: new Date("2026-01-01T10:00:00Z"),
          fromUser: { id: "from-1", name: "Alice", image: null, email: "alice@example.com" },
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          id: "req-out-1",
          createdAt: new Date("2026-01-02T10:00:00Z"),
          toUser: { id: "to-1", name: "Bob", image: null, email: "bob@example.com" },
        },
      ] as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json() as { incoming: unknown[]; outgoing: unknown[] };
    expect(json.incoming).toHaveLength(1);
    expect(json.outgoing).toHaveLength(1);
    expect((json.incoming[0] as { user: { email: string } }).user.email).toBe("alice@example.com");
  });
});
