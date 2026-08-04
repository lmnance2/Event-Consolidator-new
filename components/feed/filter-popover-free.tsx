"use client";

import { Switch } from "@/components/ui/switch";

interface FreePopoverProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

export function FreePopover({ value, onChange }: FreePopoverProps) {
  return (
    <div className="w-44">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
        Free events
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">Free events only</span>
        <Switch
          checked={value}
          onCheckedChange={onChange}
          aria-label="Free events only filter"
        />
      </div>
    </div>
  );
}
