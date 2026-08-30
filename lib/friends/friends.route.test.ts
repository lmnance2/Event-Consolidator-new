import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    friendship: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { GET } from "@/app/api/friends/route";
import { DELETE } from "@/app/api/friends/[otherUserId]/route";

const mockAuth = vi.mocked(auth);
const mockFriendshipFindMany = vi.mocked(prisma.friendship.findMany);
const mockFriendshipDeleteMany = vi.mocked(prisma.friendship.deleteMany);

const SESSION = { user: { id: "user-1" } };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/friends", () => {
  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns list of accepted friends from both A and B positions", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockFriendshipFindMany.mockResolvedValueOnce([
      {
        id: "fs-1",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        userA: { id: "user-1", name: "Me", image: null },
        userB: { id: "user-2", name: "Alice", image: null },
      },
      {
        id: "fs-2",
        createdAt: new Date("2026-01-02T00:00:00Z"),
        userA: { id: "user-0", name: "Bob", image: null },
        userB: { id: "user-1", name: "Me", image: null },
      },
    ] as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json() as Array<{ id: string; name: string | null; friendsSince: string }>;
    expect(json).toHaveLength(2);
    // First friendship: user-1 is A, so other = user-2
    expect(json[0].id).toBe("user-2");
    expect(json[0].name).toBe("Alice");
    // Second friendship: user-1 is B, so other = user-0
    expect(json[1].id).toBe("user-0");
    expect(json[1].name).toBe("Bob");
    expect(json[0].friendsSince).toBe("2026-01-01T00:00:00.000Z");
  });

  it("returns empty array when user has no friends", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockFriendshipFindMany.mockResolvedValueOnce([] as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json() as unknown[];
    expect(json).toEqual([]);
  });
});

describe("DELETE /api/friends/[otherUserId]", () => {
  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await DELETE(
      new Request("http://localhost/api/friends/other-1", { method: "DELETE" }),
      { params: Promise.resolve({ otherUserId: "other-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("deletes the friendship using orderedPair and returns 200", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockFriendshipDeleteMany.mockResolvedValueOnce({ count: 1 } as never);

    const res = await DELETE(
      new Request("http://localhost/api/friends/zzz-user", { method: "DELETE" }),
      { params: Promise.resolve({ otherUserId: "zzz-user" }) }
    );
    expect(res.status).toBe(200);
    // user-1 < zzz-user lexicographically
    expect(mockFriendshipDeleteMany).toHaveBeenCalledWith({
      where: { userAId: "user-1", userBId: "zzz-user" },
    });
  });

  it("is idempotent: returns 200 even when no row was deleted", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockFriendshipDeleteMany.mockResolvedValueOnce({ count: 0 } as never);

    const res = await DELETE(
      new Request("http://localhost/api/friends/other-1", { method: "DELETE" }),
      { params: Promise.resolve({ otherUserId: "other-1" }) }
    );
    expect(res.status).toBe(200);
  });

  it("self-unfriend (userId === otherUserId): is a no-op 200 (deleteMany matches 0 rows)", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockFriendshipDeleteMany.mockResolvedValueOnce({ count: 0 } as never);

    const res = await DELETE(
      new Request("http://localhost/api/friends/user-1", { method: "DELETE" }),
      { params: Promise.resolve({ otherUserId: "user-1" }) }
    );
    expect(res.status).toBe(200);
  });
});
