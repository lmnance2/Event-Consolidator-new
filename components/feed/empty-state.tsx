"use client";

import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

interface EmptyStateProps {
  onResetFilters: () => void;
}

export function EmptyState({ onResetFilters }: EmptyStateProps) {
  return (
    <div className="mx-auto max-w-md py-24 text-center space-y-4">
      <SearchX className="mx-auto size-12 text-muted-foreground/50" aria-hidden />
      <h2 className="text-lg font-medium">Nothing here yet.</h2>
      <p className="text-sm text-muted-foreground">
        Try widening your filters, or check back after the next sync.
      </p>
      <div className="flex gap-2 justify-center pt-2">
        <Button variant="brand" onClick={onResetFilters}>
          Reset filters
        </Button>
        <Link href="/settings" className={buttonVariants({ variant: "ghost" })}>
          Update ZIP
        </Link>
      </div>
    </div>
  );
}
