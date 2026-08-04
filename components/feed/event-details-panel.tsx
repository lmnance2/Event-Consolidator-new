"use client";

import { useState, useLayoutEffect, useRef } from "react";
import Image from "next/image";
import { Category } from "@prisma/client";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { buttonVariants } from "@/components/ui/button";
import { formatFullDate, formatTime, priceLabel, distanceLabel } from "@/lib/events/format";
import { googleMapsUrl, appleMapsUrl } from "@/lib/events/maps";
import { CategoryPlaceholder } from "./category-placeholder";
import { cn } from "@/lib/utils";

const CATEGORY_DISPLAY: Record<Category, string> = {
  MUSIC: "Music",
  SPORTS: "Sports",
  ARTS_THEATER: "Arts & Theater",
  FOOD_DRINK: "Food & Drink",
  NETWORKING: "Networking",
  HEALTH_WELLNESS: "Health & Wellness",
  OUTDOOR_ADVENTURE: "Outdoor & Adventure",
  FAMILY_FRIENDLY: "Family Friendly",
  COMMUNITY_CULTURE: "Community & Culture",
  NIGHTLIFE: "Nightlife",
  EDUCATION: "Education",
  OTHER: "Other",
};

export interface PanelEvent {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  startTime: string;
  endTime: string | null;
  venueName: string;
  venueAddress: string;
  distanceMi: number;
  category: Category;
  priceMin: number | null;
  isFree: boolean;
  performerName: string | null;
  ticketUrl: string;
}

interface EventDetailsPanelProps {
  event: PanelEvent | null;
  onClose: () => void;
}

export function EventDetailsPanel({ event, onClose }: EventDetailsPanelProps) {
  const [descExpanded, setDescExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    setDescExpanded(false);
    setIsTruncated(false);
    if (!event?.description) return;
    const el = descRef.current;
    if (el) setIsTruncated(el.scrollHeight > el.clientHeight);
  }, [event?.id, event?.description]);

  if (!event) return null;

  const categoryLabel = CATEGORY_DISPLAY[event.category] ?? event.category;
  const venueDisplay = event.venueAddress
    ? event.venueAddress
    : event.venueName;
  const googleUrl = googleMapsUrl(venueDisplay);
  const appleUrl = appleMapsUrl(venueDisplay);
  const price = priceLabel(event.isFree, event.priceMin);
  const distance = distanceLabel(event.distanceMi);

  const timeLabel = event.endTime
    ? `${formatTime(event.startTime)} – ${formatTime(event.endTime)}`
    : formatTime(event.startTime);

  return (
    <Sheet open={event !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        showCloseButton
        className={cn(
          "p-0 overflow-y-auto",
          "w-full sm:max-w-lg",
          "data-[side=right]:w-full data-[side=right]:sm:max-w-lg",
        )}
      >
        <div className="relative -mt-0">
          <div className="relative aspect-[16/10] overflow-hidden bg-brand-soft">
            {event.imageUrl ? (
              <Image
                src={event.imageUrl}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 512px"
              />
            ) : (
              <CategoryPlaceholder category={event.category} />
            )}
            <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/60 to-transparent" />
            <span className="absolute bottom-4 left-6 text-white text-xs uppercase tracking-wide font-medium">
              {categoryLabel}
            </span>
          </div>
        </div>

        <div className="px-6 pb-32 space-y-6 mt-4">
          <div className="space-y-2">
            <SheetTitle className="text-2xl font-semibold tracking-tight leading-tight">
              {event.title}
            </SheetTitle>
            <p className="text-sm text-muted-foreground tabular-nums">
              {formatFullDate(event.startTime)} · {timeLabel}
            </p>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm tabular-nums">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Price</div>
              <div>{price}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Distance</div>
              <div>{distance}</div>
            </div>
            {event.performerName && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Performer</div>
                <div>{event.performerName}</div>
              </div>
            )}
          </div>

          <Separator />

          {event.description && (
            <>
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">About</div>
                <p
                  ref={descRef}
                  className={cn(
                    "text-sm leading-relaxed whitespace-pre-line",
                    descExpanded ? "" : "line-clamp-8"
                  )}
                >
                  {event.description}
                </p>
                {!descExpanded && isTruncated && (
                  <button
                    onClick={() => setDescExpanded(true)}
                    className="text-sm text-brand hover:underline"
                  >
                    Show more
                  </button>
                )}
              </div>
              <Separator />
            </>
          )}

          <div className="space-y-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Venue</div>
            <div className="text-sm font-medium">{venueDisplay}</div>
            <div className="flex flex-wrap gap-2 pt-1">
              <a
                href={googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Open in Google Maps
              </a>
              <a
                href={appleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Open in Apple Maps
              </a>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 border-t border-border bg-background/95 px-6 py-4 flex gap-3 items-center">
          <a
            href={event.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "brand", size: "lg" }), "flex-1 text-center")}
          >
            Get Tickets
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}
