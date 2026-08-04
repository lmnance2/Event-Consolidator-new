"use client";

import { useState } from "react";

interface PricePopoverProps {
  priceMin: number | null;
  priceMax: number | null;
  onChange: (min: number | null, max: number | null) => void;
}

export function PricePopover({ priceMin, priceMax, onChange }: PricePopoverProps) {
  const [localMin, setLocalMin] = useState(priceMin !== null ? String(priceMin) : "");
  const [localMax, setLocalMax] = useState(priceMax !== null ? String(priceMax) : "");

  const commit = () => {
    const minN = localMin !== "" ? parseInt(localMin, 10) : null;
    const maxN = localMax !== "" ? parseInt(localMax, 10) : null;
    const validMin = minN !== null && !isNaN(minN) && minN >= 0 ? minN : null;
    const validMax = maxN !== null && !isNaN(maxN) && maxN >= 0 ? maxN : null;
    onChange(validMin, validMax);
  };

  return (
    <div className="w-52">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
        Price range
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
          <input
            type="number"
            min={0}
            value={localMin}
            placeholder="Min"
            onChange={(e) => setLocalMin(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
            className="h-8 w-20 rounded-md border border-input bg-background pl-5 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            aria-label="Minimum price"
          />
        </div>
        <span className="text-sm text-muted-foreground">to</span>
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
          <input
            type="number"
            min={0}
            value={localMax}
            placeholder="Max"
            onChange={(e) => setLocalMax(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
            className="h-8 w-20 rounded-md border border-input bg-background pl-5 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            aria-label="Maximum price"
          />
        </div>
      </div>
    </div>
  );
}
