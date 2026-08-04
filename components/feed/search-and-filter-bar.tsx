"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchBar } from "./search-bar";
import { FilterBar } from "./filter-bar";
import {
  parseFilterParams,
  serializeFilterParams,
  FilterOverrides,
} from "@/lib/filters/url-params";
import { effectiveFilters, UserPreferencesDefaults } from "@/lib/filters/defaults";

interface SearchAndFilterBarProps {
  prefs: UserPreferencesDefaults;
  isPro: boolean;
}

export function SearchAndFilterBar({ prefs, isPro }: SearchAndFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const overrides = parseFilterParams(searchParams);
  const effective = effectiveFilters(overrides, prefs);

  const applyOverrides = useCallback(
    (next: FilterOverrides) => {
      const params = serializeFilterParams(next, { disabledCategories: prefs.disabledCategories });
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router, prefs.disabledCategories]
  );

  const handleSearchChange = (q: string) => {
    const next: FilterOverrides = { ...overrides };
    if (q) {
      next.q = q;
    } else {
      delete next.q;
    }
    applyOverrides(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <SearchBar value={overrides.q ?? ""} onChange={handleSearchChange} />
      </div>
      <FilterBar
        overrides={overrides}
        effective={effective}
        isPro={isPro}
        onOverrideChange={applyOverrides}
      />
    </div>
  );
}
