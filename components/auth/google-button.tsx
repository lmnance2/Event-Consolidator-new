"use client";

import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/brand/google-icon";

interface GoogleButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function GoogleButton({ onClick, disabled }: GoogleButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="w-full gap-3"
      onClick={onClick}
      disabled={disabled}
    >
      <GoogleIcon className="size-4 shrink-0" />
      Continue with Google
    </Button>
  );
}
