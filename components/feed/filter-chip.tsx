"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface FilterChipProps {
  label: string;
  isActive?: boolean;
  proLocked?: boolean;
  count?: number;
  children?: React.ReactNode;
}

export function FilterChip({
  label,
  isActive = false,
  proLocked = false,
  count,
  children,
}: FilterChipProps) {
  const [open, setOpen] = useState(false);

  if (proLocked) {
    return (
      <Popover>
        <PopoverTrigger
          aria-label={`${label} (Pro feature)`}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm text-foreground",
            "opacity-70"
          )}
        >
          <Lock className="size-3 text-muted-foreground" aria-hidden />
          {label}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-4">
          <p className="text-sm font-medium">This is a Pro filter.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Upgrade to Pro to unlock advanced filters like {label.toLowerCase()}.
          </p>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-pressed={isActive}
        aria-expanded={open}
        className={cn(
          "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-sm transition-colors ease-out [transition-duration:150ms]",
          isActive
            ? "border-brand bg-brand-soft text-brand"
            : "border-border bg-background text-foreground hover:border-[var(--border-strong)]"
        )}
      >
        {label}
        {count !== undefined && count > 0 && (
          <span className="ml-1 rounded-full bg-brand text-brand-foreground text-[10px] px-1.5 py-0.5 tabular-nums font-medium leading-none">
            {count}
          </span>
        )}
      </PopoverTrigger>
      {children && (
        <PopoverContent align="start" className="p-3">
          {children}
        </PopoverContent>
      )}
    </Popover>
  );
}
