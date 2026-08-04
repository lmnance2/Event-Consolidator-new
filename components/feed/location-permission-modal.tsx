"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const GEO_ANSWERED_KEY = "geo.answered";
const GEO_COORDS_KEY = "geo.coords";

interface LocationPermissionModalProps {
  onGranted: (lat: number, lng: number) => void;
}

export function LocationPermissionModal({ onGranted }: LocationPermissionModalProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const answered = sessionStorage.getItem(GEO_ANSWERED_KEY);
    if (answered === null) {
      setOpen(true);
    }
  }, []);

  const requestPreciseLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const payload = { lat: latitude, lng: longitude, ts: Date.now() };
        sessionStorage.setItem(GEO_COORDS_KEY, JSON.stringify(payload));
        sessionStorage.setItem(GEO_ANSWERED_KEY, "granted");
        setOpen(false);
        onGranted(latitude, longitude);
      },
      () => {
        sessionStorage.setItem(GEO_ANSWERED_KEY, "denied");
        setOpen(false);
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  const skipToZip = () => {
    sessionStorage.setItem(GEO_ANSWERED_KEY, "skipped");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) skipToZip(); }}>
      <DialogContent showCloseButton={false} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Where should we look?</DialogTitle>
          <DialogDescription>
            Precise location gives you the tightest matches. If you&apos;d rather not share,
            we&apos;ll use the ZIP code you signed up with.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 pt-2">
          <Button variant="brand" onClick={requestPreciseLocation}>
            Use precise location
          </Button>
          <Button variant="outline" onClick={skipToZip}>
            Use ZIP code instead
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
