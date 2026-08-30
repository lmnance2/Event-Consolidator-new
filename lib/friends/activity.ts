import "server-only";
import { prisma } from "@/lib/db/client";
import { listFriendIds } from "@/lib/friends/queries";

const PAGE_SIZE = 20;
const LOOKBACK_DAYS = 30;

export interface ActivityCursorPayload {
  createdAt: string;
  id: string;
  kind: "GOING" | "SAVED";
}

export interface ActivityActor {
  id: string;
  name: string | null;
  image: string | null;
}

export interface ActivityEvent {
  id: string;
  title: string;
  imageUrl: string | null;
  startTime: string;
  category: string;
}

export interface ActivityItem {
  id: string;
  kind: "GOING" | "SAVED";
  createdAt: string;
  actor: ActivityActor;
  event: ActivityEvent;
}

export interface ActivityPage {
  items: ActivityItem[];
  nextCursor: string | null;
}

export function encodeActivityCursor(payload: ActivityCursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function decodeActivityCursor(raw: string): ActivityCursorPayload | null {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed: unknown = JSON.parse(json);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).createdAt !== "string" ||
      typeof (parsed as Record<string, unknown>).id !== "string" ||
      !["GOING", "SAVED"].includes(
        (parsed as Record<string, unknown>).kind as string
      )
    ) {
      return null;
    }
    const { createdAt, id, kind } = parsed as {
      createdAt: string;
      id: string;
      kind: "GOING" | "SAVED";
    };
    const ts = new Date(createdAt);
    if (isNaN(ts.getTime())) return null;
    return { createdAt, id, kind };
  } catch {
    return null;
  }
}

export async function getFriendActivityPage({
  userId,
  cursor,
}: {
  userId: string;
  cursor: ActivityCursorPayload | null;
}): Promise<ActivityPage> {
  const friendIds = await listFriendIds(userId);
  if (friendIds.length === 0) {
    return { items: [], nextCursor: null };
  }

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const fetchSize = PAGE_SIZE + 1;
  const cursorDate = cursor ? new Date(cursor.createdAt) : null;

  const [goingRows, savedRows] = await Promise.all([
    prisma.goingEvent.findMany({
      where: {
        userId: { in: friendIds },
        event: { isActive: true },
        createdAt: {
          gte: since,
          ...(cursorDate ? { lte: cursorDate } : {}),
        },
      },
      select: {
        id: true,
        createdAt: true,
        user: { select: { id: true, name: true, image: true } },
        event: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
            startTime: true,
            category: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: fetchSize,
    }),
    prisma.savedEvent.findMany({
      where: {
        userId: { in: friendIds },
        event: { isActive: true },
        createdAt: {
          gte: since,
          ...(cursorDate ? { lte: cursorDate } : {}),
        },
      },
      select: {
        id: true,
        createdAt: true,
        user: { select: { id: true, name: true, image: true } },
        event: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
            startTime: true,
            category: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: fetchSize,
    }),
  ]);

  type RawItem = {
    id: string;
    kind: "GOING" | "SAVED";
    createdAt: Date;
    actor: ActivityActor;
    event: {
      id: string;
      title: string;
      imageUrl: string | null;
      startTime: Date;
      category: string;
    };
  };

  const allItems: RawItem[] = [
    ...goingRows.map((r) => ({
      id: r.id,
      kind: "GOING" as const,
      createdAt: r.createdAt,
      actor: r.user,
      event: r.event,
    })),
    ...savedRows.map((r) => ({
      id: r.id,
      kind: "SAVED" as const,
      createdAt: r.createdAt,
      actor: r.user,
      event: r.event,
    })),
  ];

  allItems.sort((a, b) => {
    const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
    if (timeDiff !== 0) return timeDiff;
    return b.id < a.id ? -1 : b.id > a.id ? 1 : 0;
  });

  let items = allItems;
  if (cursor) {
    const cursorCreatedAt = new Date(cursor.createdAt).getTime();
    items = allItems.filter((item) => {
      const itemTime = item.createdAt.getTime();
      return itemTime < cursorCreatedAt || (itemTime === cursorCreatedAt && item.id < cursor.id);
    });
  }

  const hasMore = items.length > PAGE_SIZE;
  const page = items.slice(0, PAGE_SIZE);
  const lastItem = page[page.length - 1];

  const nextCursor =
    hasMore && lastItem
      ? encodeActivityCursor({
          createdAt: lastItem.createdAt.toISOString(),
          id: lastItem.id,
          kind: lastItem.kind,
        })
      : null;

  return {
    items: page.map((item) => ({
      id: item.id,
      kind: item.kind,
      createdAt: item.createdAt.toISOString(),
      actor: item.actor,
      event: {
        id: item.event.id,
        title: item.event.title,
        imageUrl: item.event.imageUrl,
        startTime: item.event.startTime.toISOString(),
        category: item.event.category,
      },
    })),
    nextCursor,
  };
}
