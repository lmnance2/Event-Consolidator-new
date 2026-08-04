import "server-only";
import { prisma } from "@/lib/db/client";

export interface CleanupResult {
  softDeleted: number;
  hardDeleted: number;
}

/**
 * Two-step attendance-history-safe cleanup:
 *
 * Expired = endTime < now (fall back to startTime when endTime is null,
 *           so in-progress and multi-day events survive the run).
 *
 * Step 1 — soft delete: set isActive = false on all expired events.
 *           Feed queries filter isActive = true, so they vanish from the feed.
 *
 * Step 2 — hard delete: delete expired events ONLY where no GoingEvent rows
 *           exist. Events with Going references are attendance history and must
 *           never be hard-deleted.
 *
 * GoingEvent has onDelete: Restrict on Event, so a hard-delete that still has
 * GoingEvent rows would throw a foreign-key violation — this is belt-and-
 * suspenders on top of the NOT EXISTS filter.
 */
export async function runCleanup(): Promise<CleanupResult> {
  const now = new Date();

  const { count: softDeleted } = await prisma.event.updateMany({
    where: {
      isActive: true,
      OR: [
        { endTime: { lt: now } },
        { endTime: null, startTime: { lt: now } },
      ],
    },
    data: { isActive: false },
  });

  const { count: hardDeleted } = await prisma.event.deleteMany({
    where: {
      OR: [
        { endTime: { lt: now } },
        { endTime: null, startTime: { lt: now } },
      ],
      goingUsers: { none: {} },
    },
  });

  console.log(
    JSON.stringify({
      event: "cleanup.complete",
      softDeleted,
      hardDeleted,
    })
  );

  return { softDeleted, hardDeleted };
}
