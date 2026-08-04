"use client";

import { FilterChip } from "./filter-chip";
import { CategoryPopover } from "./filter-popover-category";
import { DistancePopover } from "./filter-popover-distance";
import { DateRangePopover } from "./filter-popover-date-range";
import { PricePopover } from "./filter-popover-price";
import { ExperiencePopover } from "./filter-popover-experience";
import { FamilyPopover } from "./filter-popover-family";
import { FreePopover } from "./filter-popover-free";
import { TimePopover } from "./filter-popover-time";
import { VenuePopover } from "./filter-popover-venue";
import { ResetFiltersButton } from "./reset-filters-button";
import { FilterOverrides } from "@/lib/filters/url-params";
import { EffectiveFilters } from "@/lib/filters/defaults";

interface FilterBarProps {
  overrides: FilterOverrides;
  effective: EffectiveFilters;
  isPro: boolean;
  onOverrideChange: (next: FilterOverrides) => void;
}

function priceChipLabel(
  priceMin: number | null,
  priceMax: number | null,
  isFreeOnly: boolean
): string {
  if (isFreeOnly) return "Free only";
  if (priceMin !== null && priceMax !== null) return `$${priceMin} – $${priceMax}`;
  if (priceMin !== null) return `$${priceMin}+`;
  if (priceMax !== null) return `Up to $${priceMax}`;
  return "Price";
}

export function FilterBar({ overrides, effective, isPro, onOverrideChange }: FilterBarProps) {
  const hasOverrides = Object.keys(overrides).length > 0;

  const catCount = overrides.categories?.length ?? 0;
  const catActive =
    overrides.categories !== undefined && overrides.categories.length > 0;
  const distActive = overrides.distanceMi !== undefined;
  const dateActive = overrides.dateRangeDays !== undefined;
  const priceActive =
    overrides.priceMin !== undefined ||
    overrides.priceMax !== undefined ||
    overrides.freeOnly === true;

  return (
    <div
      className="flex gap-2 overflow-x-auto md:flex-wrap md:overflow-visible py-2 -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label="Event filters"
    >
      <FilterChip
        label={catActive ? `Category (${catCount})` : "Category"}
        isActive={catActive}
        count={catCount > 0 ? catCount : undefined}
      >
        <CategoryPopover
          selected={effective.categories}
          onChange={(cats) => {
            onOverrideChange({ ...overrides, categories: cats.length > 0 ? cats : undefined });
          }}
        />
      </FilterChip>

      <FilterChip
        label={distActive ? `${effective.distanceMi} mi` : "Distance"}
        isActive={distActive}
      >
        <DistancePopover
          value={effective.distanceMi}
          onChange={(v) => onOverrideChange({ ...overrides, distanceMi: v })}
        />
      </FilterChip>

      <FilterChip
        label={dateActive ? `${effective.dateRangeDays} days` : "Date"}
        isActive={dateActive}
      >
        <DateRangePopover
          value={effective.dateRangeDays}
          onChange={(v) => onOverrideChange({ ...overrides, dateRangeDays: v })}
        />
      </FilterChip>

      <FilterChip
        label={priceChipLabel(effective.priceMin, effective.priceMax, effective.freeOnly)}
        isActive={priceActive}
      >
        <PricePopover
          priceMin={effective.priceMin}
          priceMax={effective.priceMax}
          onChange={(min, max) =>
            onOverrideChange({ ...overrides, priceMin: min ?? undefined, priceMax: max ?? undefined })
          }
        />
      </FilterChip>

      <FilterChip
        label="Experience"
        isActive={isPro && overrides.experienceType !== undefined}
        proLocked={!isPro}
      >
        <ExperiencePopover
          value={effective.experienceType}
          onChange={(v) => onOverrideChange({ ...overrides, experienceType: v })}
        />
      </FilterChip>

      <FilterChip
        label="Family friendly"
        isActive={isPro && overrides.familyFriendly === true}
        proLocked={!isPro}
      >
        <FamilyPopover
          value={effective.familyFriendly}
          onChange={(v) =>
            onOverrideChange({ ...overrides, familyFriendly: v || undefined })
          }
        />
      </FilterChip>

      <FilterChip
        label="Free only"
        isActive={isPro && overrides.freeOnly === true}
        proLocked={!isPro}
      >
        <FreePopover
          value={effective.freeOnly}
          onChange={(v) =>
            onOverrideChange({ ...overrides, freeOnly: v || undefined })
          }
        />
      </FilterChip>

      <FilterChip
        label="Time of day"
        isActive={isPro && overrides.timeOfDay !== undefined}
        proLocked={!isPro}
      >
        <TimePopover
          value={effective.timeOfDay}
          onChange={(v) => onOverrideChange({ ...overrides, timeOfDay: v })}
        />
      </FilterChip>

      <FilterChip
        label="Venue"
        isActive={isPro && overrides.venue !== undefined}
        proLocked={!isPro}
      >
        <VenuePopover
          value={effective.venue}
          onChange={(v) => onOverrideChange({ ...overrides, venue: v })}
        />
      </FilterChip>

      <ResetFiltersButton
        hasOverrides={hasOverrides}
        onReset={() => onOverrideChange({})}
      />
    </div>
  );
}
