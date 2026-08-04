"use client";

import { Button } from "@/components/ui/button";

interface ErrorBannerProps {
  onRetry: () => void;
}

export function ErrorBanner({ onRetry }: ErrorBannerProps) {
  return (
    <div className="mx-4 md:mx-0 my-6 rounded-md border border-border bg-muted px-4 py-3 flex items-center justify-between text-sm">
      <span>We couldn&apos;t load more events. Check your connection.</span>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
