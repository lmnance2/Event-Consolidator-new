import "server-only";
import type { Provider, Category } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { ticketmasterAdapter } from "@/lib/providers/ticketmaster";
import { eventbriteAdapter } from "@/lib/providers/eventbrite";
import { meetupAdapter } from "@/lib/providers/meetup";
import type { ProviderAdapter, NormalizedEventInput } from "@/lib/providers/types";
import { deduplicateNewEvents, deduplicateCrossRun } from "./dedupe";
import { runCleanup } from "./cleanup";
import type { CleanupResult } from "./cleanup";

export interface ProviderSyncCounts {
  status: "ok" | "aborted" | "all_metros_failed";
  fetched: number;
  normalized: number;
  upserted: number;
  skipped: number;
  metroFailures: string[];
}

export interface SyncSummary {
  providers: Record<Provider, ProviderSyncCounts>;
  crossProviderDeduped: number;
  cleanup: CleanupResult;
  durationMs: number;
}

const ADAPTERS: ProviderAdapter[] = [
  ticketmasterAdapter,
  eventbriteAdapter,
  meetupAdapter,
];

async function upsertEvent(
  input: NormalizedEventInput
): Promise<{ eventId: string; wasCreated: boolean }> {
  const existing = await prisma.eventSource.findUnique({
    where: { provider_externalId: { provider: input.provider, externalId: input.externalId } },
    select: { eventId: true },
  });

  if (existing) {
    await prisma.event.update({
      where: { id: existing.eventId },
      data: {
        title: input.title,
        description: input.description,
        imageUrl: input.imageUrl,
        startTime: input.startTime,
        endTime: input.endTime,
        venue: input.venue,
        latitude: input.latitude,
        longitude: input.longitude,
        price: input.price,
        isFree: input.isFree,
        category: input.category as Category,
        performerName: input.performerName,
        isActive: true,
      },
    });
    await prisma.eventSource.update({
      where: { provider_externalId: { provider: input.provider, externalId: input.externalId } },
      data: { ticketUrl: input.ticketUrl },
    });
    return { eventId: existing.eventId, wasCreated: false };
  }

  const event = await prisma.event.create({
    data: {
      title: input.title,
      description: input.description,
      imageUrl: input.imageUrl,
      startTime: input.startTime,
      endTime: input.endTime,
      venue: input.venue,
      latitude: input.latitude,
      longitude: input.longitude,
      price: input.price,
      isFree: input.isFree,
      category: input.category as Category,
      performerName: input.performerName,
      isActive: true,
      sources: {
        create: {
          provider: input.provider,
          externalId: input.externalId,
          ticketUrl: input.ticketUrl,
        },
      },
    },
    select: { id: true },
  });

  return { eventId: event.id, wasCreated: true };
}

export async function runSync(): Promise<SyncSummary> {
  const startMs = Date.now();

  const providerCounts = {} as Record<Provider, ProviderSyncCounts>;
  const allNewEventIds: string[] = [];
  const allUpsertedEventIds: string[] = [];

  for (const adapter of ADAPTERS) {
    adapter.metroFailures = [];

    const counts: ProviderSyncCounts = {
      status: "ok",
      fetched: 0,
      normalized: 0,
      upserted: 0,
      skipped: 0,
      metroFailures: [],
    };
    providerCounts[adapter.provider] = counts;

    const t0 = Date.now();

    try {
      for await (const event of adapter.fetchEvents()) {
        counts.fetched++;
        counts.normalized++;

        try {
          const { eventId, wasCreated } = await upsertEvent(event);
          counts.upserted++;
          allUpsertedEventIds.push(eventId);
          if (wasCreated) {
            allNewEventIds.push(eventId);
          }
        } catch (err) {
          counts.skipped++;
          console.error(
            JSON.stringify({
              event: "sync.upsert_error",
              provider: adapter.provider,
              externalId: event.externalId,
              error: String(err),
              action: "skip",
            })
          );
        }
      }
    } catch (err) {
      counts.status = "aborted";
      console.error(
        JSON.stringify({
          event: "sync.provider_error",
          provider: adapter.provider,
          error: String(err),
          status: "aborted",
          action: "continue_other_providers",
        })
      );
    }

    counts.metroFailures = adapter.metroFailures;
    if (
      counts.status === "ok" &&
      counts.fetched === 0 &&
      counts.metroFailures.length > 0
    ) {
      counts.status = "all_metros_failed";
    }

    console.log(
      JSON.stringify({
        event: "sync.provider_complete",
        provider: adapter.provider,
        ...counts,
        durationMs: Date.now() - t0,
      })
    );
  }

  const inRunDeduped = await deduplicateNewEvents(allNewEventIds);
  const crossRunDeduped = await deduplicateCrossRun(allUpsertedEventIds);
  const crossProviderDeduped = inRunDeduped + crossRunDeduped;

  const cleanup = await runCleanup();

  const durationMs = Date.now() - startMs;

  console.log(
    JSON.stringify({
      event: "sync.complete",
      providers: providerCounts,
      crossProviderDeduped,
      cleanup,
      durationMs,
    })
  );

  return {
    providers: providerCounts,
    crossProviderDeduped,
    cleanup,
    durationMs,
  };
}
