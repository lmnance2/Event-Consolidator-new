import type { Metadata } from "next";
import { SiteHeader } from "@/components/landing/site-header";
import { Hero } from "@/components/landing/hero";
import { TrustStrip } from "@/components/landing/trust-strip";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { FinalCTA } from "@/components/landing/final-cta";
import { SiteFooter } from "@/components/landing/site-footer";

export const metadata: Metadata = {
  title: "Event Atlas — Every event, one feed",
};

export default function LandingPage() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-background focus:border focus:border-border focus:rounded-md focus:px-3 focus:py-1.5 focus:text-sm"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">
        <Hero />
        <TrustStrip />
        <FeatureGrid />
        <FinalCTA />
      </main>
      <SiteFooter />
    </>
  );
}
