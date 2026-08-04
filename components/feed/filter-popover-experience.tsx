"use client";

import { ExperienceType } from "@prisma/client";
import { cn } from "@/lib/utils";

interface ExperiencePopoverProps {
  value: ExperienceType;
  onChange: (value: ExperienceType) => void;
}

const OPTIONS: { value: ExperienceType; label: string }[] = [
  { value: ExperienceType.INDOOR, label: "Indoor" },
  { value: ExperienceType.OUTDOOR, label: "Outdoor" },
  { value: ExperienceType.BOTH, label: "Both" },
];

export function ExperiencePopover({ value, onChange }: ExperiencePopoverProps) {
  return (
    <div className="w-44">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
        Experience type
      </div>
      <div className="flex flex-col gap-1">
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
              name="experience"
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
