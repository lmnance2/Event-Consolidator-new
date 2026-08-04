"use client";

import { Category } from "@prisma/client";
import { cn } from "@/lib/utils";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: Category.MUSIC, label: "Music" },
  { value: Category.SPORTS, label: "Sports" },
  { value: Category.ARTS_THEATER, label: "Arts & Theater" },
  { value: Category.FOOD_DRINK, label: "Food & Drink" },
  { value: Category.NETWORKING, label: "Networking" },
  { value: Category.HEALTH_WELLNESS, label: "Health & Wellness" },
  { value: Category.OUTDOOR_ADVENTURE, label: "Outdoor & Adventure" },
  { value: Category.FAMILY_FRIENDLY, label: "Family Friendly" },
  { value: Category.COMMUNITY_CULTURE, label: "Community & Culture" },
  { value: Category.NIGHTLIFE, label: "Nightlife" },
  { value: Category.EDUCATION, label: "Education" },
  { value: Category.OTHER, label: "Other" },
];

interface CategoryPopoverProps {
  selected: Category[];
  onChange: (categories: Category[]) => void;
}

export function CategoryPopover({ selected, onChange }: CategoryPopoverProps) {
  const toggle = (cat: Category) => {
    if (selected.includes(cat)) {
      onChange(selected.filter((c) => c !== cat));
    } else {
      onChange([...selected, cat]);
    }
  };

  return (
    <div className="w-64">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
        Category
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {CATEGORIES.map(({ value, label }) => {
          const isSelected = selected.includes(value);
          return (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors",
                isSelected
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-border bg-background text-foreground hover:border-[var(--border-strong)]"
              )}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(value)}
                className="sr-only"
              />
              {label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
