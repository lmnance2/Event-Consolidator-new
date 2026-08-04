"use client";

interface ResetFiltersButtonProps {
  hasOverrides: boolean;
  onReset: () => void;
}

export function ResetFiltersButton({ hasOverrides, onReset }: ResetFiltersButtonProps) {
  if (!hasOverrides) return null;

  return (
    <button
      onClick={onReset}
      className="ml-auto shrink-0 text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors duration-150"
    >
      Reset filters
    </button>
  );
}
