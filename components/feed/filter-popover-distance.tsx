"use client";

import { useState } from "react";

interface DistancePopoverProps {
  value: number;
  onChange: (value: number) => void;
}

export function DistancePopover({ value, onChange }: DistancePopoverProps) {
  const [local, setLocal] = useState(String(value));

  const commit = () => {
    const n = parseInt(local, 10);
    if (!isNaN(n) && n >= 1 && n <= 500) {
      onChange(n);
    } else {
      setLocal(String(value));
    }
  };

  return (
    <div className="w-48">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
        Max distance
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={500}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
          className="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          aria-label="Distance in miles"
        />
        <span className="text-sm text-muted-foreground">mi</span>
      </div>
    </div>
  );
}
