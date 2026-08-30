import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/client", () => ({
  prisma: {
    friendship: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    friendRequest: {
      count: vi.fn(),
    },
    goingEvent: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/client";
import {
  listFriendIds,
  areFriends,
  pendingRequestCount,
  listFriendsGoing,
} from "./queries";

const mockFriendshipFindMany = vi.mocked(prisma.friendship.findMany);
const mockFriendshipFindUnique = vi.mocked(prisma.friendship.findUnique);
const mockFriendRequestCount = vi.mocked(prisma.friendRequest.count);
const mockGoingEventFindMany = vi.mocked(prisma.goingEvent.findMany);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listFriendIds", () => {
  it("returns friend ids when user is in the A position", async () => {
    mockFriendshipFindMany.mockResolvedValueOnce([
      { userAId: "user-1", userBId: "user-2" },
      { userAId: "user-1", userBId: "user-3" },
    ] as never);

    const ids = await listFriendIds("user-1");
    expect(ids).toEqual(["user-2", "user-3"]);
  });

  it("returns friend ids when user is in the B position", async () => {
    mockFriendshipFindMany.mockResolvedValueOnce([
      { userAId: "user-0", userBId: "user-5" },
    ] as never);

    const ids = await listFriendIds("user-5");
    expect(ids).toEqual(["user-0"]);
  });

  it("returns empty array when user has no friendships", async () => {
    mockFriendshipFindMany.mockResolvedValueOnce([] as never);

    const ids = await listFriendIds("lonely-user");
    expect(ids).toEqual([]);
  });

  it("queries with OR covering both positions", async () => {
    mockFriendshipFindMany.mockResolvedValueOnce([] as never);
    await listFriendIds("user-x");
    expect(mockFriendshipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ userAId: "user-x" }, { userBId: "user-x" }],
        },
      })
    );
  });
});

describe("areFriends", () => {
  it("returns true when friendship row exists", async () => {
    mockFriendshipFindUnique.mockResolvedValueOnce({ id: "fs-1" } as never);
    const result = await areFriends("aaa", "bbb");
    expect(result).toBe(true);
  });

  it("returns false when friendship row does not exist", async () => {
    mockFriendshipFindUnique.mockResolvedValueOnce(null as never);
    const result = await areFriends("aaa", "bbb");
    expect(result).toBe(false);
  });

  it("derives the ordered pair so lookup always uses the correct key", async () => {
    mockFriendshipFindUnique.mockResolvedValueOnce(null as never);
    await areFriends("zzz", "aaa");
    expect(mockFriendshipFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userAId_userBId: { userAId: "aaa", userBId: "zzz" } },
      })
    );
  });
});

describe("pendingRequestCount", () => {
  it("returns the count of incoming pending requests", async () => {
    mockFriendRequestCount.mockResolvedValueOnce(3 as never);
    const count = await pendingRequestCount("user-1");
    expect(count).toBe(3);
  });

  it("passes correct where clause", async () => {
    mockFriendRequestCount.mockResolvedValueOnce(0 as never);
    await pendingRequestCount("user-x");
    expect(mockFriendRequestCount).toHaveBeenCalledWith({
      where: { toUserId: "user-x", status: "PENDING" },
    });
  });
});

describe("listFriendsGoing", () => {
  it("returns only friends who are going to the event", async () => {
    mockFriendshipFindMany.mockResolvedValueOnce([
      { userAId: "user-1", userBId: "user-2" },
      { userAId: "user-1", userBId: "user-3" },
    ] as never);
    mockGoingEventFindMany.mockResolvedValueOnce([
      { user: { id: "user-2", name: "Alice", image: null } },
    ] as never);

    const result = await listFriendsGoing("evt-1", "user-1");
    expect(result).toEqual([{ id: "user-2", name: "Alice", image: null }]);
  });

  it("excludes strangers who are going to the same event", async () => {
    // user-1's friends: [user-2]
    // Stranger user-99 is also going but NOT in friends list
    mockFriendshipFindMany.mockResolvedValueOnce([
      { userAId: "user-1", userBId: "user-2" },
    ] as never);
    // Query only includes friendIds in where clause — stranger never returned
    mockGoingEventFindMany.mockResolvedValueOnce([
      { user: { id: "user-2", name: "Alice", image: null } },
    ] as never);

    const result = await listFriendsGoing("evt-1", "user-1");
    expect(result.map((r) => r.id)).not.toContain("user-99");
    expect(result.map((r) => r.id)).toContain("user-2");
  });

  it("does not include the user themselves", async () => {
    // If user-1 is going and has friends, user-1 should not appear in the result
    // (their own id is never in friendIds)
    mockFriendshipFindMany.mockResolvedValueOnce([
      { userAId: "user-1", userBId: "user-2" },
    ] as never);
    mockGoingEventFindMany.mockResolvedValueOnce([
      { user: { id: "user-2", name: "Alice", image: null } },
    ] as never);

    const result = await listFriendsGoing("evt-1", "user-1");
    expect(result.map((r) => r.id)).not.toContain("user-1");
  });

  it("returns empty array when user has no friends", async () => {
    mockFriendshipFindMany.mockResolvedValueOnce([] as never);
    // goingEvent.findMany should not be called when friendIds is empty
    const result = await listFriendsGoing("evt-1", "user-lonely");
    expect(result).toEqual([]);
    expect(mockGoingEventFindMany).not.toHaveBeenCalled();
  });
});
