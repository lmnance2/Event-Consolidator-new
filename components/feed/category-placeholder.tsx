import {
  Music4,
  Trophy,
  Drama,
  UtensilsCrossed,
  Users,
  HeartPulse,
  Trees,
  Baby,
  Landmark,
  Sparkles,
  GraduationCap,
  CalendarDays,
} from "lucide-react";
import { Category } from "@prisma/client";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<Category, React.ComponentType<{ className?: string }>> = {
  MUSIC: Music4,
  SPORTS: Trophy,
  ARTS_THEATER: Drama,
  FOOD_DRINK: UtensilsCrossed,
  NETWORKING: Users,
  HEALTH_WELLNESS: HeartPulse,
  OUTDOOR_ADVENTURE: Trees,
  FAMILY_FRIENDLY: Baby,
  COMMUNITY_CULTURE: Landmark,
  NIGHTLIFE: Sparkles,
  EDUCATION: GraduationCap,
  OTHER: CalendarDays,
};

interface CategoryPlaceholderProps {
  category: Category;
  className?: string;
}

export function CategoryPlaceholder({ category, className }: CategoryPlaceholderProps) {
  const Icon = CATEGORY_ICONS[category] ?? CalendarDays;
  return (
    <div className={cn("flex h-full w-full items-center justify-center bg-brand-soft", className)}>
      <Icon className="size-12 text-muted-foreground/60" aria-hidden />
    </div>
  );
}
