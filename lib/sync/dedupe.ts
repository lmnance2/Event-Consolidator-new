import "server-only";
import type { Event, EventSource, Provider } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { haversineMeters } from "@/lib/geo/haversine";

const TITLE_SIMILARITY_THRESHOLD = 0.85;
const TIME_WINDOW_MS = 2 * 60 * 60 * 1000;
const VENUE_RADIUS_METERS = 500;

const PROVIDER_PRIORITY: Record<Provider, number> = {
  TICKETMASTER: 0,
  EVENTBRITE: 1,
  MEETUP: 2,
};

// ── Jaro-Winkler ──────────────────────────────────────────────────────────────

function jaroSimilarity(s1: string, t1: string): number {
  const s = s1.toLowerCase();
  const t = t1.toLowerCase();

  if (s === t) return 1;
  if (!s.length || !t.length) return 0;

  const matchWindow = Math.max(Math.floor(Math.max(s.length, t.length) / 2) - 1, 0);

  const sMatches = new Array<boolean>(s.length).fill(false);
  const tMatches = new Array<boolean>(t.length).fill(false);
  let matchCount = 0;
  let transpositions = 0;

  for (let i = 0; i < s.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, t.length);
    for (let j = start; j < end; j++) {
      if (tMatches[j] || s[i] !== t[j]) continue;
      sMatches[i] = true;
      tMatches[j] = true;
      matchCount++;
      break;
    }
  }

  if (!matchCount) return 0;

  let k = 0;
  for (let i = 0; i < s.length; i++) {
    if (!sMatches[i]) continue;
    while (!tMatches[k]) k++;
    if (s[i] !== t[k]) transpositions++;
    k++;
  }

  return (
    (matchCount / s.length +
      matchCount / t.length +
      (matchCount - transpositions / 2) / matchCount) /
    3
  );
}

export function jaroWinkler(s1: string, s2: string, p = 0.1): number {
  const jaro = jaroSimilarity(s1, s2);
  const s = s1.toLowerCase();
  const t = s2.toLowerCase();

  let prefixLen = 0;
  for (let i = 0; i < Math.min(s.length, t.length, 4); i++) {
    if (s[i] === t[i]) prefixLen++;
    else break;
  }

  return jaro + prefixLen * p * (1 - jaro);
}

// ── Dedupe matching predicates ─────────────────────────────────────────────────

export function isTitleMatch(a: string, b: string): boolean {
  return jaroWinkler(a, b) >= TITLE_SIMILARITY_THRESHOLD;
}

export function isTimeMatch(a: Date, b: Date): boolean {
  return Math.abs(a.getTime() - b.getTime()) <= TIME_WINDOW_MS;
}

export function isVenueMatch(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): boolean {
  return haversineMeters(aLat, aLng, bLat, bLng) <= VENUE_RADIUS_METERS;
}

export function isCrossProviderDuplicate(
  a: { title: string; startTime: Date; latitude: number; longitude: number },
  b: { title: string; startTime: Date; latitude: number; longitude: number }
): boolean {
  return (
    isTitleMatch(a.title, b.title) &&
    isTimeMatch(a.startTime, b.startTime) &&
    isVenueMatch(a.latitude, a.longitude, b.latitude, b.longitude)
  );
}

// ── Canonical winner selection ─────────────────────────────────────────────────

type EventWithSources = Event & { sources: EventSource[] };

export function pickCanonical(
  a: EventWithSources,
  b: EventWithSources
): { canonical: EventWithSources; loser: EventWithSources } {
  const aPriority = Math.min(
    ...a.sources.map((s) => PROVIDER_PRIORITY[s.provider])
  );
  const bPriority = Math.min(
    ...b.sources.map((s) => PROVIDER_PRIORITY[s.provider])
  );
  if (aPriority <= bPriority) return { canonical: a, loser: b };
  return { canonical: b, loser: a };
}

// ── Cross-run merge ────────────────────────────────────────────────────────────

/**
 * Merges loser into canonical in a single transaction:
 *  1. Re-parent loser's EventSource rows to canonical
 *  2. Re-parent SavedEvent rows (skip on (userId, eventId) collision)
 *  3. Re-parent GoingEvent rows (skip on (userId, eventId) collision)
 *  4. Re-parent EventReminder rows (skip on same logic)
 *  5. Delete the loser Event row
 *
 * GoingEvent has onDelete: Restrict on Event, so step 5 is only safe after
 * all GoingEvent rows are either moved or the event has no GoingEvent rows.
 */
export async function mergeIntoCanonical(
  canonicalId: string,
  loserId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const [canonicalSaved, canonicalGoing, canonicalReminders] =
      await Promise.all([
        tx.savedEvent.findMany({
          where: { eventId: canonicalId },
          select: { userId: true },
        }),
        tx.goingEvent.findMany({
          where: { eventId: canonicalId },
          select: { userId: true },
        }),
        tx.eventReminder.findMany({
          where: { eventId: canonicalId },
          select: { userId: true },
        }),
      ]);

    const canonicalSavedUsers = new Set(canonicalSaved.map((r) => r.userId));
    const canonicalGoingUsers = new Set(canonicalGoing.map((r) => r.userId));
    const canonicalReminderUsers = new Set(
      canonicalReminders.map((r) => r.userId)
    );

    const [loserSaved, loserGoing, loserReminders] = await Promise.all([
      tx.savedEvent.findMany({
        where: { eventId: loserId },
        select: { id: true, userId: true },
      }),
      tx.goingEvent.findMany({
        where: { eventId: loserId },
        select: { id: true, userId: true },
      }),
      tx.eventReminder.findMany({
        where: { eventId: loserId },
        select: { id: true, userId: true },
      }),
    ]);

    const savedToMove = loserSaved
      .filter((r) => !canonicalSavedUsers.has(r.userId))
      .map((r) => r.id);
    const savedToDelete = loserSaved
      .filter((r) => canonicalSavedUsers.has(r.userId))
      .map((r) => r.id);

    const goingToMove = loserGoing
      .filter((r) => !canonicalGoingUsers.has(r.userId))
      .map((r) => r.id);
    const goingToDelete = loserGoing
      .filter((r) => canonicalGoingUsers.has(r.userId))
      .map((r) => r.id);

    const remindersToMove = loserReminders
      .filter((r) => !canonicalReminderUsers.has(r.userId))
      .map((r) => r.id);
    const remindersToDelete = loserReminders
      .filter((r) => canonicalReminderUsers.has(r.userId))
      .map((r) => r.id);

    const ops: Promise<unknown>[] = [];
    if (savedToMove.length > 0) {
      ops.push(
        tx.savedEvent.updateMany({
          where: { id: { in: savedToMove } },
          data: { eventId: canonicalId },
        })
      );
    }
    if (savedToDelete.length > 0) {
      ops.push(tx.savedEvent.deleteMany({ where: { id: { in: savedToDelete } } }));
    }
    if (goingToMove.length > 0) {
      ops.push(
        tx.goingEvent.updateMany({
          where: { id: { in: goingToMove } },
          data: { eventId: canonicalId },
        })
      );
    }
    if (goingToDelete.length > 0) {
      ops.push(tx.goingEvent.deleteMany({ where: { id: { in: goingToDelete } } }));
    }
    if (remindersToMove.length > 0) {
      ops.push(
        tx.eventReminder.updateMany({
          where: { id: { in: remindersToMove } },
          data: { eventId: canonicalId },
        })
      );
    }
    if (remindersToDelete.length > 0) {
      ops.push(
        tx.eventReminder.deleteMany({ where: { id: { in: remindersToDelete } } })
      );
    }
    await Promise.all(ops);

    await tx.eventSource.updateMany({
      where: { eventId: loserId },
      data: { eventId: canonicalId },
    });

    await tx.event.delete({ where: { id: loserId } });
  });
}

// ── Cross-run cross-provider dedupe ───────────────────────────────────────────

const BOUNDING_BOX_LAT_DEG = 0.005;
const BOUNDING_BOX_LNG_DEG = 0.007;

/**
 * For each newly-created event, queries prior-run canonical Events within the
 * ±2h time window and 500m bounding box that do NOT already share a provider
 * with the new event. Merges any matching pair via mergeIntoCanonical.
 *
 * This handles the case where a prior run ingested event X from provider A and
 * this run pulls the same event from provider B. deduplicateNewEvents only
 * compares events within the same run's new-event set, so cross-run matches
 * require this second pass.
 */
export async function deduplicateCrossRun(
  newEventIds: string[]
): Promise<number> {
  if (newEventIds.length === 0) return 0;

  const newEvents = await prisma.event.findMany({
    where: { id: { in: newEventIds }, isActive: true },
    include: { sources: true },
  });

  const mergedNewIds = new Set<string>();
  let mergeCount = 0;

  for (const newEvent of newEvents) {
    if (mergedNewIds.has(newEvent.id)) continue;

    const newProviders = new Set(newEvent.sources.map((s) => s.provider));
    const startMin = new Date(newEvent.startTime.getTime() - TIME_WINDOW_MS);
    const startMax = new Date(newEvent.startTime.getTime() + TIME_WINDOW_MS);

    const priorCandidates = await prisma.event.findMany({
      where: {
        isActive: true,
        id: { notIn: newEventIds },
        startTime: { gte: startMin, lte: startMax },
        latitude: {
          gte: newEvent.latitude - BOUNDING_BOX_LAT_DEG,
          lte: newEvent.latitude + BOUNDING_BOX_LAT_DEG,
        },
        longitude: {
          gte: newEvent.longitude - BOUNDING_BOX_LNG_DEG,
          lte: newEvent.longitude + BOUNDING_BOX_LNG_DEG,
        },
        sources: { none: { provider: { in: Array.from(newProviders) } } },
      },
      include: { sources: true },
    });

    for (const prior of priorCandidates) {
      if (isCrossProviderDuplicate(newEvent, prior)) {
        const { canonical, loser } = pickCanonical(newEvent, prior);
        await mergeIntoCanonical(canonical.id, loser.id);
        mergedNewIds.add(loser.id === newEvent.id ? newEvent.id : prior.id);
        mergeCount++;
        break;
      }
    }
  }

  return mergeCount;
}

// ── In-run cross-provider dedupe ───────────────────────────────────────────────

/**
 * Given a list of newly upserted Event IDs from this run, finds cross-provider
 * duplicate pairs and merges them. Returns the count of merges performed.
 *
 * This is O(n²) in the number of events per run, which is acceptable for the
 * volumes we expect (hundreds to low thousands per 6h window).
 */
export async function deduplicateNewEvents(
  newEventIds: string[]
): Promise<number> {
  if (newEventIds.length === 0) return 0;

  const events = await prisma.event.findMany({
    where: { id: { in: newEventIds }, isActive: true },
    include: { sources: true },
  });

  const mergedSet = new Set<string>();
  let mergeCount = 0;

  for (let i = 0; i < events.length; i++) {
    const a = events[i];
    if (mergedSet.has(a.id)) continue;

    for (let j = i + 1; j < events.length; j++) {
      const b = events[j];
      if (mergedSet.has(b.id)) continue;

      const aProviders = new Set(a.sources.map((s) => s.provider));
      if (b.sources.some((s) => aProviders.has(s.provider))) continue;

      if (isCrossProviderDuplicate(a, b)) {
        const { canonical, loser } = pickCanonical(a, b);
        await mergeIntoCanonical(canonical.id, loser.id);
        mergedSet.add(loser.id);
        mergeCount++;
      }
    }
  }

  return mergeCount;
}
