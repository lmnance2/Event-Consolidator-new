import Image from "next/image";
import { Category } from "@prisma/client";
import { cn } from "@/lib/utils";
import { formatDayTime, priceLabel, distanceLabel } from "@/lib/events/format";
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

export function EventCard({ event, onOpen }: EventCardProps) {
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

      <button
        className="absolute inset-0 z-10"
        aria-label={`View details for ${event.title}`}
        onClick={() => onOpen(event.id)}
      />
    </article>
  );
}
