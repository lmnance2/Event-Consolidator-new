"use client";

import { Switch } from "@/components/ui/switch";

interface FamilyPopoverProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

export function FamilyPopover({ value, onChange }: FamilyPopoverProps) {
  return (
    <div className="w-44">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
        Family friendly
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">Show family-friendly only</span>
        <Switch
          checked={value}
          onCheckedChange={onChange}
          aria-label="Family friendly filter"
        />
      </div>
    </div>
  );
}
