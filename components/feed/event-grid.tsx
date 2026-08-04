"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FeedRow } from "@/lib/events/feed-query";
import { parseGeoCoords } from "@/lib/filters/url-params";
import { EventCard } from "./event-card";
import { EventDetailsPanel, PanelEvent } from "./event-details-panel";
import { LoadMoreButton } from "./load-more-button";
import { FeedSkeleton } from "./feed-skeleton";
import { EmptyState } from "./empty-state";
import { EndOfList } from "./end-of-list";
import { ErrorBanner } from "./error-banner";
import { BackToTopButton } from "./back-to-top-button";
import { LocationPermissionModal } from "./location-permission-modal";

interface EventGridProps {
  initialRows: FeedRow[];
  initialNextCursor: string | null;
  ssrFailed?: boolean;
  userLat: number;
  userLng: number;
}

interface FeedPage {
  rows: FeedRow[];
  nextCursor: string | null;
}

export function EventGrid({
  initialRows,
  initialNextCursor,
  ssrFailed = false,
  userLat,
  userLng,
}: EventGridProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<FeedRow[]>(initialRows);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationMissing, setLocationMissing] = useState(false);
  const locationMissingRef = useRef(false);
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [liveMessage, setLiveMessage] = useState("");

  const searchParamsString = searchParams.toString();
  const prevParamsRef = useRef(searchParamsString);

  const getOrigin = useCallback(() => {
    const raw = sessionStorage.getItem("geo.coords");
    if (raw) {
      const parsed = parseGeoCoords(raw);
      if (parsed) return { lat: parsed.lat, lng: parsed.lng };
    }
    if (geoCoords) return geoCoords;
    return { lat: userLat, lng: userLng };
  }, [geoCoords, userLat, userLng]);

  const fetchPage = useCallback(
    async (cursor: string | null, append: boolean) => {
      if (locationMissingRef.current) return;

      const origin = getOrigin();
      const params = new URLSearchParams(searchParamsString);
      params.set("lat", String(origin.lat));
      params.set("lng", String(origin.lng));
      params.set("limit", "20");
      if (cursor) params.set("cursor", cursor);
      else params.delete("cursor");

      setLiveMessage("");

      const resp = await fetch(`/api/events?${params.toString()}`);

      if (resp.status === 400) {
        const body = (await resp.json()) as { error?: string };
        if (body.error === "Location required") {
          locationMissingRef.current = true;
          setLocationMissing(true);
          return;
        }
      }

      if (!resp.ok) throw new Error("fetch failed");
      const data = (await resp.json()) as FeedPage;

      if (append) {
        setRows((prev) => {
          const next = [...prev, ...data.rows];
          setLiveMessage(`Loaded ${data.rows.length} more events.`);
          return next;
        });
      } else {
        setRows(data.rows);
      }
      setNextCursor(data.nextCursor);
    },
    [searchParamsString, getOrigin]
  );

  useEffect(() => {
    if (prevParamsRef.current === searchParamsString) return;
    prevParamsRef.current = searchParamsString;

    let cancelled = false;
    setIsRefetching(true);
    setError(null);

    fetchPage(null, false)
      .catch(() => {
        if (!cancelled) setError("fetch");
      })
      .finally(() => {
        if (!cancelled) setIsRefetching(false);
      });

    return () => { cancelled = true; };
  }, [searchParamsString, fetchPage]);

  // M5: on first mount, if sessionStorage has fresh coords that differ meaningfully
  // from the SSR origin, re-fetch page 1 with the client coords so page 1 and page 2+
  // use the same location origin and avoid the "NYC on page 1" visual jump.
  useEffect(() => {
    const raw = sessionStorage.getItem("geo.coords");
    if (!raw) return;
    const parsed = parseGeoCoords(raw);
    if (!parsed) return;

    const distDeg = Math.abs(parsed.lat - userLat) + Math.abs(parsed.lng - userLng);
    if (distDeg < 0.01) return;

    let cancelled = false;
    setIsRefetching(true);
    setError(null);

    const params = new URLSearchParams(searchParamsString);
    params.set("lat", String(parsed.lat));
    params.set("lng", String(parsed.lng));
    params.set("limit", "20");
    params.delete("cursor");

    fetch(`/api/events?${params.toString()}`)
      .then(async (resp) => {
        if (!resp.ok) throw new Error("fetch failed");
        const data = (await resp.json()) as FeedPage;
        if (!cancelled) {
          setRows(data.rows);
          setNextCursor(data.nextCursor);
        }
      })
      .catch(() => {
        if (!cancelled) setError("fetch");
      })
      .finally(() => {
        if (!cancelled) setIsRefetching(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = useCallback(() => {
    if (isLoading || nextCursor === null) return;
    setIsLoading(true);
    setError(null);

    fetchPage(nextCursor, true)
      .catch(() => setError("loadmore"))
      .finally(() => setIsLoading(false));
  }, [isLoading, nextCursor, fetchPage]);

  const handleGeoGranted = (lat: number, lng: number) => {
    setGeoCoords({ lat, lng });
  };

  const handleResetFilters = useCallback(() => {
    router.replace("?", { scroll: false });
  }, [router]);

  const openEvent = rows.find((r) => r.id === openEventId) ?? null;

  const panelEvent: PanelEvent | null = openEvent
    ? {
        id: openEvent.id,
        title: openEvent.title,
        description: openEvent.description,
        imageUrl: openEvent.imageUrl,
        startTime: openEvent.startTime,
        endTime: openEvent.endTime,
        venueName: openEvent.venueName,
        venueAddress: openEvent.venueAddress,
        distanceMi: openEvent.distanceMi,
        category: openEvent.category,
        priceMin: openEvent.priceMin,
        isFree: openEvent.isFree,
        performerName: openEvent.performerName,
        ticketUrl: openEvent.ticketUrl,
      }
    : null;

  return (
    <>
      <LocationPermissionModal onGranted={handleGeoGranted} />

      {locationMissing && (
        <Alert className="mb-6 border-amber-300 bg-amber-50 text-amber-900 [&>svg]:text-amber-600">
          <TriangleAlert className="size-4" aria-hidden />
          <AlertDescription>
            We couldn&apos;t figure out where to look.{" "}
            <Link href="/settings" className="font-medium underline underline-offset-2 hover:no-underline">
              Update your ZIP &rarr;
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {isRefetching ? (
        <FeedSkeleton />
      ) : locationMissing ? null : rows.length === 0 && !ssrFailed ? (
        <EmptyState onResetFilters={handleResetFilters} />
      ) : (
        <>
          <div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6"
            aria-label="Events"
          >
            {rows.map((row) => (
              <EventCard
                key={row.id}
                event={{
                  id: row.id,
                  title: row.title,
                  imageUrl: row.imageUrl,
                  startTime: row.startTime,
                  venueName: row.venueName,
                  distanceMi: row.distanceMi,
                  category: row.category,
                  priceMin: row.priceMin,
                  isFree: row.isFree,
                }}
                onOpen={setOpenEventId}
              />
            ))}
          </div>

          <div aria-live="polite" aria-atomic className="sr-only">
            {liveMessage}
          </div>

          {error && <ErrorBanner onRetry={loadMore} />}

          {nextCursor === null ? (
            rows.length > 0 && <EndOfList />
          ) : (
            <LoadMoreButton onLoadMore={loadMore} isLoading={isLoading} />
          )}
        </>
      )}

      <BackToTopButton />

      <EventDetailsPanel
        event={panelEvent}
        onClose={() => setOpenEventId(null)}
      />
    </>
  );
}
