import type { Category, Provider } from "@prisma/client";

/**
 * The canonical normalized shape every provider adapter must produce.
 * The orchestrator in lib/sync/run.ts owns all DB writes; adapters never
 * touch the database — they stream NormalizedEventInput values only.
 */
export interface NormalizedEventInput {
  provider: Provider;
  externalId: string;

  title: string;
  description?: string;
  imageUrl?: string;

  startTime: Date;
  endTime?: Date;

  venue: string;
  latitude: number;
  longitude: number;

  price?: number;
  isFree: boolean;

  category: Category;
  performerName?: string;

  ticketUrl: string;
}

/**
 * Contract every provider adapter must implement.
 * Adapters stream normalized events and never touch the DB.
 * metroFailures is a module-singleton array populated during fetchEvents;
 * the orchestrator resets it per run and reads it after the generator ends,
 * so adapters MUST only be invoked serially — concurrent runs will race.
 */
export interface ProviderAdapter {
  provider: Provider;
  fetchEvents(): AsyncGenerator<NormalizedEventInput, void, undefined>;
  metroFailures: string[];
}
