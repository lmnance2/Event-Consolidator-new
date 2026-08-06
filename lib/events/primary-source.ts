import { prisma } from "@/lib/db/client";

// Returns the ticket URL for the first-registered source of an event.
// "First-registered" = lowest createdAt, which is stable across sync runs
// (ingestion order is deterministic per provider). Falls back to null when no
// sources exist yet (newly-created event mid-sync, or test fixture without sources).
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
