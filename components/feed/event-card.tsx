"use client";

import { useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Category } from "@prisma/client";
import { CalendarCheck, Heart, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDayTime, priceLabel, distanceLabel } from "@/lib/events/format";
import { useEventState } from "@/components/providers/event-state-provider";
import { CategoryPlaceholder } from "./category-placeholder";

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

export interface EventCardData {
  id: string;
  title: string;
  imageUrl: string | null;
  startTime: string;
  venueName: string;
  distanceMi: number;
  category: Category;
  priceMin: number | null;
  isFree: boolean;
}

interface EventCardProps {
  event: EventCardData;
  onOpen: (id: string) => void;
}

interface SaveToggleProps {
  title: string;
  pressed: boolean;
  loading: boolean;
  onToggle: () => Promise<{ success: boolean }>;
}

function SaveToggle({ title, pressed, loading, onToggle }: SaveToggleProps) {
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const wasSaved = pressed;
      onToggle().then(({ success }) => {
        if (success && !wasSaved) {
          btnRef.current?.setAttribute("data-just-saved", "true");
          setTimeout(() => {
            btnRef.current?.removeAttribute("data-just-saved");
          }, 200);
        }
      });
    },
    [pressed, onToggle]
  );

  return (
    <button
      ref={btnRef}
      type="button"
      aria-pressed={pressed}
      aria-label={pressed ? `Unsave ${title}` : `Save ${title}`}
      onClick={handleClick}
      className={cn(
        "h-9 w-9 grid place-items-center rounded-full",
        "shadow-sm border",
        "transition ease-out [transition-duration:160ms]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
        "active:scale-90",
        loading && "pointer-events-none opacity-70",
        pressed
          ? "bg-brand/8 border-brand/40 text-brand"
          : "bg-background border-border/60 text-foreground/70 hover:text-foreground hover:border-[var(--border-strong)]"
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Heart
          className={cn(
            "h-4 w-4",
            pressed && "fill-brand"
          )}
        />
      )}
    </button>
  );
}

interface GoingToggleProps {
  title: string;
  pressed: boolean;
  loading: boolean;
  onToggle: (e: React.MouseEvent) => void;
}

function GoingToggle({ title, pressed, loading, onToggle }: GoingToggleProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onToggle(e);
    },
    [onToggle]
  );

  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={pressed ? `Remove going for ${title}` : `Mark going for ${title}`}
      onClick={handleClick}
      className={cn(
        "h-9 w-9 grid place-items-center rounded-full",
        "shadow-sm border",
        "transition ease-out [transition-duration:160ms]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
        "active:scale-90",
        loading && "pointer-events-none opacity-70",
        pressed
          ? "bg-foreground/5 border-foreground/25 text-foreground"
          : "bg-background border-border/60 text-foreground/70 hover:text-foreground hover:border-[var(--border-strong)]"
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <CalendarCheck className="h-4 w-4" />
      )}
    </button>
  );
}

export function EventCard({ event, onOpen }: EventCardProps) {
  const { savedIds, goingIds, isLoading, toggleSave, toggleGoing, isSavePending, isGoingPending } = useEventState();

  const isSaved = savedIds.has(event.id);
  const isGoing = goingIds.has(event.id);
  const savePending = isSavePending(event.id);
  const goingPending = isGoingPending(event.id);

  const handleSave = useCallback(
    (): Promise<{ success: boolean }> => {
      return toggleSave(event.id);
    },
    [toggleSave, event.id]
  );

  const handleGoing = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      toggleGoing(event.id);
    },
    [toggleGoing, event.id]
  );

  const categoryLabel = CATEGORY_DISPLAY[event.category] ?? event.category;
  const meta = [
    formatDayTime(event.startTime),
    event.venueName,
    distanceLabel(event.distanceMi),
    priceLabel(event.isFree, event.priceMin),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card",
        "transition ease-out [transition-duration:200ms]",
        "hover:-translate-y-px hover:border-[var(--border-strong)] hover:shadow-sm",
        "focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2",
        "active:translate-y-0 active:scale-[.995]"
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-brand-soft">
        {event.imageUrl ? (
          <Image
            src={event.imageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <CategoryPlaceholder category={event.category} />
        )}
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/50 to-transparent" />
        <span className="absolute bottom-3 left-3 text-white text-xs font-medium tracking-wide uppercase">
          {categoryLabel}
        </span>
      </div>

      <div className="p-4 space-y-2">
        <h2 className="text-base font-medium leading-snug tracking-tight line-clamp-2">
          {event.title}
        </h2>
        <div className="text-xs text-muted-foreground tabular-nums truncate">
          {meta}
        </div>
      </div>

      <div className="absolute top-2 right-2 z-20 flex gap-1.5">
        <SaveToggle
          title={event.title}
          pressed={!isLoading && isSaved}
          loading={isLoading || savePending}
          onToggle={handleSave}
        />
        <GoingToggle
          title={event.title}
          pressed={!isLoading && isGoing}
          loading={isLoading || goingPending}
          onToggle={handleGoing}
        />
      </div>

      <Link
        href={`/feed?event=${event.id}`}
        scroll={false}
        className="absolute inset-0 z-10"
        aria-label={`View details for ${event.title}`}
        onClick={(e) => {
          e.preventDefault();
          onOpen(event.id);
        }}
      />
    </article>
  );
}
