import { Sliders, ExternalLink } from "lucide-react";

const filterChips = ["Music", "< 10 mi", "Free"];

export function FeatureGrid() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 md:py-28">
      <p className="text-sm font-medium text-brand mb-3">
        Built to help you find
      </p>
      <h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.1] max-w-3xl">
        Not another place to{" "}
        <span className="font-serif italic font-normal">find</span> new hobbies.
      </h2>

      <div className="mt-16 grid gap-6 grid-cols-1 md:grid-cols-[1.3fr_1fr_1fr]">
        <div
          className="rounded-2xl border border-border bg-card p-7 md:p-8 transition-all duration-200 motion-safe:hover:-translate-y-0.5 hover:shadow-[0_1px_0_var(--border),0_10px_30px_-15px_rgba(15,23,42,0.15)] hover:border-foreground/15"
        >
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground opacity-70">
              ticketmaster
            </span>
            <span className="text-muted-foreground/50 text-sm">+</span>
            <span className="text-xs font-medium text-muted-foreground opacity-70">
              eventbrite
            </span>
            <span className="text-muted-foreground/50 text-sm">+</span>
            <span className="text-xs font-medium text-muted-foreground opacity-70">
              Meetup
            </span>
            <span className="text-muted-foreground/50 text-sm">&#8594;</span>
            <span className="rounded-full border border-brand/30 bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">
              Feed
            </span>
          </div>

          <h3 className="mt-6 text-xl font-semibold">
            Ticketmaster + Eventbrite + Meetup, in one list
          </h3>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            The same concert on three sites shows up once. We match by title,
            time, and venue, then keep the earliest source&apos;s ticket link.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 transition-all duration-200 motion-safe:hover:-translate-y-0.5 hover:shadow-[0_1px_0_var(--border),0_10px_30px_-15px_rgba(15,23,42,0.15)] hover:border-foreground/15">
          <div className="size-8 rounded-md bg-brand-soft grid place-items-center">
            <Sliders className="size-4 text-brand" aria-hidden />
          </div>
          <h3 className="mt-5 text-lg font-semibold">
            Filters set once, not every scroll
          </h3>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Pick your categories, distance, and price range in settings. The
            feed applies them every time.
          </p>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {filterChips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 transition-all duration-200 motion-safe:hover:-translate-y-0.5 hover:shadow-[0_1px_0_var(--border),0_10px_30px_-15px_rgba(15,23,42,0.15)] hover:border-foreground/15">
          <div className="size-8 rounded-md bg-brand-soft grid place-items-center">
            <ExternalLink className="size-4 text-brand" aria-hidden />
          </div>
          <h3 className="mt-5 text-lg font-semibold">Tickets stay on the source.</h3>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Every ticket link points back to the original provider. No middleman,
            no markup, no new account to buy from.
          </p>
        </div>
      </div>
    </section>
  );
}
