import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    goingEvent: { findMany: vi.fn() },
    savedEvent: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/friends/queries", () => ({
  listFriendIds: vi.fn(),
}));

import { prisma } from "@/lib/db/client";
import { listFriendIds } from "@/lib/friends/queries";
import {
  getFriendActivityPage,
  encodeActivityCursor,
  decodeActivityCursor,
} from "@/lib/friends/activity";

const mockGoingFindMany = vi.mocked(prisma.goingEvent.findMany);
const mockSavedFindMany = vi.mocked(prisma.savedEvent.findMany);
const mockListFriendIds = vi.mocked(listFriendIds);

const ACTOR = { id: "friend-1", name: "Alice", image: null };
const EVENT = {
  id: "evt-1",
  title: "Test Event",
  imageUrl: null,
  startTime: new Date("2026-09-01T18:00:00Z"),
  category: "MUSIC",
};

function makeGoingRow(id: string, createdAt: Date) {
  return { id, createdAt, user: ACTOR, event: EVENT };
}

function makeSavedRow(id: string, createdAt: Date) {
  return { id, createdAt, user: ACTOR, event: EVENT };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("decodeActivityCursor / encodeActivityCursor", () => {
  it("round-trips a valid payload", () => {
    const payload = { createdAt: "2026-07-01T10:00:00.000Z", id: "abc", kind: "GOING" as const };
    const encoded = encodeActivityCursor(payload);
    expect(decodeActivityCursor(encoded)).toEqual(payload);
  });

  it("returns null for garbage input", () => {
    expect(decodeActivityCursor("not-valid!!!")).toBeNull();
  });

  it("returns null when kind is missing", () => {
    const bad = Buffer.from(JSON.stringify({ createdAt: "2026-01-01T00:00:00Z", id: "x" })).toString("base64url");
    expect(decodeActivityCursor(bad)).toBeNull();
  });

  it("returns null when createdAt is not a valid ISO date", () => {
    const bad = Buffer.from(JSON.stringify({ createdAt: "not-a-date", id: "x", kind: "GOING" })).toString("base64url");
    expect(decodeActivityCursor(bad)).toBeNull();
  });
});

describe("getFriendActivityPage", () => {
  it("returns empty items when user has no friends", async () => {
    mockListFriendIds.mockResolvedValueOnce([]);

    const result = await getFriendActivityPage({ userId: "u-1", cursor: null });
    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeNull();
    expect(mockGoingFindMany).not.toHaveBeenCalled();
    expect(mockSavedFindMany).not.toHaveBeenCalled();
  });

  it("sorts items by createdAt desc, then id desc for tie-breaking", async () => {
    mockListFriendIds.mockResolvedValueOnce(["friend-1"]);

    const t1 = new Date("2026-07-01T10:00:00Z");
    const t2 = new Date("2026-07-02T10:00:00Z");

    mockGoingFindMany.mockResolvedValueOnce([makeGoingRow("going-old", t1)] as never);
    mockSavedFindMany.mockResolvedValueOnce([makeSavedRow("saved-new", t2)] as never);

    const result = await getFriendActivityPage({ userId: "u-1", cursor: null });
    expect(result.items[0].id).toBe("saved-new");
    expect(result.items[1].id).toBe("going-old");
  });

  it("tie-breaks on id desc when createdAt is equal", async () => {
    mockListFriendIds.mockResolvedValueOnce(["friend-1"]);

    const t = new Date("2026-07-01T10:00:00Z");

    // "zzz-going" > "aaa-saved" lexicographically, so zzz should come first
    mockGoingFindMany.mockResolvedValueOnce([makeGoingRow("aaa-going", t)] as never);
    mockSavedFindMany.mockResolvedValueOnce([makeSavedRow("zzz-saved", t)] as never);

    const result = await getFriendActivityPage({ userId: "u-1", cursor: null });
    expect(result.items[0].id).toBe("zzz-saved");
    expect(result.items[1].id).toBe("aaa-going");
  });

  it("cursor filter includes items strictly before cursorCreatedAt", async () => {
    mockListFriendIds.mockResolvedValueOnce(["friend-1"]);

    const cursorTime = new Date("2026-07-05T10:00:00Z");
    const before = new Date("2026-07-04T10:00:00Z");
    const same = new Date("2026-07-05T10:00:00Z");

    const cursor = { createdAt: cursorTime.toISOString(), id: "cursor-id", kind: "GOING" as const };

    mockGoingFindMany.mockResolvedValueOnce([
      makeGoingRow("before-item", before),
    ] as never);
    mockSavedFindMany.mockResolvedValueOnce([
      makeSavedRow("same-time-higher-id", same),
    ] as never);

    const result = await getFriendActivityPage({ userId: "u-1", cursor });
    const ids = result.items.map((i) => i.id);
    expect(ids).toContain("before-item");
    expect(ids).not.toContain("same-time-higher-id");
  });

  it("cursor boundary: includes item with same time and id < cursor.id", async () => {
    mockListFriendIds.mockResolvedValueOnce(["friend-1"]);

    const cursorTime = new Date("2026-07-05T10:00:00Z");
    const cursor = { createdAt: cursorTime.toISOString(), id: "mmm-cursor", kind: "GOING" as const };

    mockGoingFindMany.mockResolvedValueOnce([
      makeGoingRow("aaa-before-id", cursorTime),
    ] as never);
    mockSavedFindMany.mockResolvedValueOnce([] as never);

    const result = await getFriendActivityPage({ userId: "u-1", cursor });
    expect(result.items[0].id).toBe("aaa-before-id");
  });

  it("cursor boundary: excludes item with same time and id >= cursor.id", async () => {
    mockListFriendIds.mockResolvedValueOnce(["friend-1"]);

    const cursorTime = new Date("2026-07-05T10:00:00Z");
    const cursor = { createdAt: cursorTime.toISOString(), id: "aaa-cursor", kind: "GOING" as const };

    mockGoingFindMany.mockResolvedValueOnce([
      makeGoingRow("zzz-after-id", cursorTime),
    ] as never);
    mockSavedFindMany.mockResolvedValueOnce([] as never);

    const result = await getFriendActivityPage({ userId: "u-1", cursor });
    expect(result.items).toHaveLength(0);
  });

  it("sets nextCursor when there are more than PAGE_SIZE items", async () => {
    mockListFriendIds.mockResolvedValueOnce(["friend-1"]);

    const items = Array.from({ length: 21 }, (_, i) =>
      makeGoingRow(`going-${String(i).padStart(3, "0")}`, new Date(Date.now() - i * 1000))
    );

    mockGoingFindMany.mockResolvedValueOnce(items as never);
    mockSavedFindMany.mockResolvedValueOnce([] as never);

    const result = await getFriendActivityPage({ userId: "u-1", cursor: null });
    expect(result.items).toHaveLength(20);
    expect(result.nextCursor).not.toBeNull();
  });

  it("nextCursor is null when items fit within PAGE_SIZE", async () => {
    mockListFriendIds.mockResolvedValueOnce(["friend-1"]);

    const items = Array.from({ length: 5 }, (_, i) =>
      makeGoingRow(`going-${i}`, new Date(Date.now() - i * 1000))
    );

    mockGoingFindMany.mockResolvedValueOnce(items as never);
    mockSavedFindMany.mockResolvedValueOnce([] as never);

    const result = await getFriendActivityPage({ userId: "u-1", cursor: null });
    expect(result.items).toHaveLength(5);
    expect(result.nextCursor).toBeNull();
  });

  it("filters queries with event.isActive: true", async () => {
    mockListFriendIds.mockResolvedValueOnce(["friend-1"]);
    mockGoingFindMany.mockResolvedValueOnce([] as never);
    mockSavedFindMany.mockResolvedValueOnce([] as never);

    await getFriendActivityPage({ userId: "u-1", cursor: null });

    expect(mockGoingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ event: { isActive: true } }),
      })
    );
    expect(mockSavedFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ event: { isActive: true } }),
      })
    );
  });

  it("output item shape includes all required fields as ISO strings", async () => {
    mockListFriendIds.mockResolvedValueOnce(["friend-1"]);
    mockGoingFindMany.mockResolvedValueOnce([makeGoingRow("going-1", new Date("2026-07-01T10:00:00Z"))] as never);
    mockSavedFindMany.mockResolvedValueOnce([] as never);

    const result = await getFriendActivityPage({ userId: "u-1", cursor: null });
    const item = result.items[0];
    expect(item.id).toBe("going-1");
    expect(item.kind).toBe("GOING");
    expect(typeof item.createdAt).toBe("string");
    expect(item.actor.id).toBe("friend-1");
    expect(typeof item.event.startTime).toBe("string");
  });
});
