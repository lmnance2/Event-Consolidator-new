"use client";

import { useState, useLayoutEffect, useRef, useCallback, forwardRef } from "react";
import Image from "next/image";
import { Category } from "@prisma/client";
import {
  CalendarCheck,
  CalendarPlus,
  ChevronDown,
  Heart,
  Loader2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { formatFullDate, formatTime, priceLabel, distanceLabel } from "@/lib/events/format";
import { googleMapsUrl, appleMapsUrl } from "@/lib/events/maps";
import { googleCalendarUrl, appleCalendarUrl } from "@/lib/calendar/deep-links";
import { useEventState } from "@/components/providers/event-state-provider";
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

interface PanelToggleProps {
  variant: "save" | "going";
  pressed: boolean;
  loading: boolean;
  onClick: () => void;
  eventTitle: string;
}

const PanelToggle = forwardRef<HTMLButtonElement, PanelToggleProps>(
  function PanelToggle({ variant, pressed, loading, onClick, eventTitle }, ref) {
    const isSave = variant === "save";
    const label = isSave ? (pressed ? "Saved" : "Save") : "Going";
    const ariaLabel = isSave
      ? pressed
        ? `Unsave ${eventTitle}`
        : `Save ${eventTitle}`
      : pressed
      ? `Remove going for ${eventTitle}`
      : `Mark going for ${eventTitle}`;

    const handleClick = useCallback(() => {
      onClick();
    }, [onClick]);

    const Icon = isSave ? Heart : CalendarCheck;

    return (
      <button
        ref={ref}
        type="button"
        aria-pressed={pressed}
        aria-label={ariaLabel}
        disabled={loading}
        onClick={handleClick}
        className={cn(
          buttonVariants({ variant: pressed ? "brand" : "outline", size: "sm" }),
          "gap-1.5 active:scale-95"
        )}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Icon className={cn("h-3.5 w-3.5", pressed && isSave && "fill-current")} />
        )}
        {label}
      </button>
    );
  }
);

interface AddToCalendarMenuProps {
  event: PanelEvent;
}

function AddToCalendarMenu({ event }: AddToCalendarMenuProps) {
  const calendarEvent = {
    id: event.id,
    title: event.title,
    description: event.description,
    startTime: new Date(event.startTime),
    endTime: event.endTime ? new Date(event.endTime) : null,
    venue: event.venueName,
  };

  const openGoogleCalendar = () => {
    window.open(googleCalendarUrl(calendarEvent), "_blank", "noopener");
  };

  const openAppleCalendar = () => {
    window.open(appleCalendarUrl(calendarEvent), "_blank", "noopener");
  };

  const downloadIcs = () => {
    window.location.href = `/api/events/${event.id}/ics`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <CalendarPlus className="h-3.5 w-3.5" />
            <span>Add to calendar</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={4}>
        <DropdownMenuItem onClick={openGoogleCalendar}>
          Google Calendar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openAppleCalendar}>
          Apple Calendar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={downloadIcs}>
          Download .ics
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function EventDetailsPanel({ event, onClose }: EventDetailsPanelProps) {
  const [descExpanded, setDescExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);

  const { savedIds, goingIds, isLoading, toggleSave, toggleGoing, isSavePending, isGoingPending } = useEventState();

  const saveBtnRef = useRef<HTMLButtonElement>(null);

  const isSaved = event ? savedIds.has(event.id) : false;
  const isGoing = event ? goingIds.has(event.id) : false;
  const savePending = event ? isSavePending(event.id) : false;
  const goingPending = event ? isGoingPending(event.id) : false;

  useLayoutEffect(() => {
    setDescExpanded(false);
    setIsTruncated(false);
    if (!event?.description) return;
    const el = descRef.current;
    if (el) setIsTruncated(el.scrollHeight > el.clientHeight);
  }, [event?.id, event?.description]);

  const handleSave = useCallback(() => {
    if (!event) return;
    const wasSaved = savedIds.has(event.id);
    toggleSave(event.id).then(({ success }) => {
      if (success && !wasSaved) {
        saveBtnRef.current?.setAttribute("data-just-saved", "true");
        setTimeout(() => {
          saveBtnRef.current?.removeAttribute("data-just-saved");
        }, 200);
      }
    });
  }, [event, savedIds, toggleSave]);

  const handleGoing = useCallback(() => {
    if (!event) return;
    toggleGoing(event.id);
  }, [event, toggleGoing]);

  if (!event) return null;

  const categoryLabel = CATEGORY_DISPLAY[event.category] ?? event.category;
  const venueDisplay = event.venueAddress ? event.venueAddress : event.venueName;
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

        <div className="px-6 pb-40 space-y-6 mt-4">
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

        <div className="absolute inset-x-0 bottom-0 border-t border-border bg-background/95 px-6 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <PanelToggle
              ref={saveBtnRef}
              variant="save"
              pressed={!isLoading && isSaved}
              loading={isLoading || savePending}
              onClick={handleSave}
              eventTitle={event.title}
            />
            <PanelToggle
              variant="going"
              pressed={!isLoading && isGoing}
              loading={isLoading || goingPending}
              onClick={handleGoing}
              eventTitle={event.title}
            />
            <AddToCalendarMenu event={event} />
          </div>

          <a
            href={event.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "brand", size: "lg" }), "w-full text-center")}
          >
            Get Tickets
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}
