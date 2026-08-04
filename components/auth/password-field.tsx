"use client";

import * as React from "react";
import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PasswordFieldProps
  extends Omit<React.ComponentProps<"input">, "type"> {
  label: string;
  error?: string;
  helper?: string;
  rightAdornment?: React.ReactNode;
}

export function PasswordField({
  label,
  error,
  helper,
  rightAdornment,
  id: providedId,
  name,
  className,
  ...props
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const id = providedId ?? name ?? generatedId;
  const helpId = `${id}-help`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={id}>{label}</Label>
        {rightAdornment}
      </div>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          aria-invalid={!!error || undefined}
          aria-describedby={helper || error ? helpId : undefined}
          className={`h-10 pr-10 ${className ?? ""}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-sm"
          tabIndex={-1}
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden />
          ) : (
            <Eye className="size-4" aria-hidden />
          )}
        </button>
      </div>
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
