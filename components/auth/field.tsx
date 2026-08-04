"use client";

import * as React from "react";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FieldProps extends React.ComponentProps<"input"> {
  label: string;
  error?: string;
  helper?: string;
  rightAdornment?: React.ReactNode;
}

export function Field({
  label,
  error,
  helper,
  rightAdornment,
  id: providedId,
  name,
  className,
  ...props
}: FieldProps) {
  const generatedId = useId();
  const id = providedId ?? name ?? generatedId;
  const helpId = `${id}-help`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={id}>{label}</Label>
        {rightAdornment}
      </div>
      <Input
        id={id}
        name={name}
        aria-invalid={!!error || undefined}
        aria-describedby={helper || error ? helpId : undefined}
        className={cn("h-10", className)}
        {...props}
      />
      {(helper || error) && (
        <p
          id={helpId}
          className={
            error
              ? "text-xs text-destructive"
              : "text-xs text-muted-foreground"
          }
        >
          {error ?? helper}
        </p>
      )}
    </div>
  );
}
