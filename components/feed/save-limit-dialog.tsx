"use client";

import { Bookmark } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEventState } from "@/components/providers/event-state-provider";

export function SaveLimitDialog() {
  const { showLimitDialog, setShowLimitDialog, savedCount } = useEventState();

  return (
    <Dialog open={showLimitDialog} onOpenChange={(open) => setShowLimitDialog(open)}>
      <DialogContent showCloseButton className="max-w-md">
        <DialogHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft mb-3">
            <Bookmark className="h-5 w-5 text-brand" />
          </div>
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Five saves is the free plan&apos;s limit
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            Unsave one to bookmark a new event. Unlimited saves ship with Pro.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Saved</span>
          <span className="tabular-nums font-medium">{savedCount} / 5</span>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" disabled>
            Pro upgrade, coming soon
          </Button>
          <Button
            variant="brand"
            size="sm"
            onClick={() => setShowLimitDialog(false)}
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
