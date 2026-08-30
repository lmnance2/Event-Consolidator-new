import { prisma } from "@/lib/db/client";
import { Provider } from "@prisma/client";

const PROVIDER_PRIORITY: Record<Provider, number> = {
  TICKETMASTER: 0,
  EVENTBRITE: 1,
  MEETUP: 2,
};

export function pickPrimarySource<T extends { provider: Provider }>(
  sources: T[]
): T | null {
  if (sources.length === 0) return null;
  return [...sources].sort(
    (a, b) => PROVIDER_PRIORITY[a.provider] - PROVIDER_PRIORITY[b.provider]
  )[0] ?? null;
}

// Returns the ticket URL for the first-registered source of an event.
// "First-registered" = lowest createdAt, which is stable across sync runs
// (ingestion order is deterministic per provider). Falls back to null when no
// sources exist yet (newly-created event mid-sync, or test fixture without sources).
// Note: this uses createdAt ordering (not PROVIDER_PRIORITY) intentionally --
// the reminder cron documents this as its own stable ordering per iteration 8.
export async function getPrimaryTicketUrl(
  eventId: string
): Promise<string | null> {
  const source = await prisma.eventSource.findFirst({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    select: { ticketUrl: true },
  });
  return source?.ticketUrl ?? null;
}
