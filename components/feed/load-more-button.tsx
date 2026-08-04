"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface LoadMoreButtonProps {
  onLoadMore: () => void;
  isLoading: boolean;
}

export function LoadMoreButton({ onLoadMore, isLoading }: LoadMoreButtonProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [showFallback, setShowFallback] = useState(false);
  const observerFiredRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    observerFiredRef.current = false;
    setShowFallback(false);

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    timeoutRef.current = setTimeout(() => {
      if (!observerFiredRef.current) {
        setShowFallback(true);
      }
    }, 5000);

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && !isLoading) {
          observerFiredRef.current = true;
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          onLoadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [onLoadMore, isLoading]);

  return (
    <>
      <div ref={sentinelRef} aria-hidden className="h-1" />
      {showFallback && (
        <div className="flex justify-center py-4">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </>
  );
}
