"use client";

import { cn } from "@/lib/utils";

type TimeOfDay = "MORNING" | "AFTERNOON" | "EVENING";

interface TimePopoverProps {
  value?: TimeOfDay;
  onChange: (value: TimeOfDay | undefined) => void;
}

const OPTIONS: { value: TimeOfDay; label: string }[] = [
  { value: "MORNING", label: "Morning" },
  { value: "AFTERNOON", label: "Afternoon" },
  { value: "EVENING", label: "Evening" },
];

export function TimePopover({ value, onChange }: TimePopoverProps) {
  return (
    <div className="w-44">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
        Time of day
      </div>
      <div className="flex flex-col gap-1">
        <label
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
            value === undefined
              ? "border-brand bg-brand-soft text-brand"
              : "border-border bg-background text-foreground hover:border-[var(--border-strong)]"
          )}
        >
          <input
            type="radio"
            name="time-of-day"
            checked={value === undefined}
            onChange={() => onChange(undefined)}
            className="sr-only"
          />
          Any time
        </label>
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
              value === opt.value
                ? "border-brand bg-brand-soft text-brand"
                : "border-border bg-background text-foreground hover:border-[var(--border-strong)]"
            )}
          >
            <input
              type="radio"
              name="time-of-day"
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}
