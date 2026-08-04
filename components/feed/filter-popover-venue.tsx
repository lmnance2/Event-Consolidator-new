"use client";

import { useState } from "react";

interface VenuePopoverProps {
  value?: string;
  onChange: (value: string | undefined) => void;
}

export function VenuePopover({ value, onChange }: VenuePopoverProps) {
  const [local, setLocal] = useState(value ?? "");

  const commit = () => {
    const trimmed = local.trim();
    onChange(trimmed.length > 0 ? trimmed : undefined);
  };

  return (
    <div className="w-52">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
        Venue contains
      </div>
      <input
        type="text"
        value={local}
        placeholder="e.g. Madison Square"
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
        className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        aria-label="Venue name filter"
      />
    </div>
  );
}
