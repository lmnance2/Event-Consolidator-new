import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FeedPreview } from "./feed-preview";

export function Hero() {
  return (
    <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 md:pt-32 md:pb-24">
      <div className="grid gap-12 md:gap-16 md:grid-cols-[1.1fr_1fr] items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-brand" aria-hidden />
            Every event, one feed
          </span>

          <h1 className="mt-6 text-[clamp(2.75rem,7vw,5rem)] font-bold sm:font-extrabold tracking-[-0.035em] leading-[1.02]">
            Find the events you&apos;d{" "}
            <span className="font-serif italic font-normal text-brand">
              actually
            </span>{" "}
            go to.
          </h1>

          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
            Ticketmaster, Eventbrite, and Meetup in one feed. Filtered by what
            you like, sorted by what&apos;s nearby. Buy tickets on the source
            site.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href="/signup"
              className={cn(buttonVariants({ variant: "brand", size: "lg" }), "active:scale-[0.98]")}
            >
              Sign up free
            </Link>
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "active:scale-[0.98]")}
            >
              I have an account
            </Link>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Free account. Email or Google.
          </p>
        </div>

        <div>
          <FeedPreview />
        </div>
      </div>
    </section>
  );
}
