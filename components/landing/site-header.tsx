"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-all duration-200 ease-out",
        scrolled
          ? "bg-background/85 backdrop-blur border-b border-border"
          : "bg-transparent border-b border-transparent"
      )}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Logo />

        <nav className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden sm:inline-flex text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className={cn(buttonVariants({ variant: "brand", size: "lg" }))}
          >
            Sign up free
          </Link>
        </nav>
      </div>
    </header>
  );
}
