import { ArrowUpRight } from "lucide-react";

const filterChips = [
  { label: "Music", selected: true },
  { label: "This weekend", selected: false },
  { label: "< 10 mi", selected: false },
];

const events = [
  {
    id: 1,
    title: "Chappell Roan",
    detail: "Fri Aug 8 · 3.2 mi",
    category: "Music",
    gradientFrom: "from-violet-200",
    gradientTo: "to-purple-300",
  },
  {
    id: 2,
    title: "Sourdough Meetup at Tartine",
    detail: "Sat Aug 9 · 1.4 mi",
    category: "Food & Drink",
    gradientFrom: "from-amber-100",
    gradientTo: "to-orange-200",
  },
  {
    id: 3,
    title: "Hamilton (matinee)",
    detail: "Sun Aug 10 · 5.1 mi",
    category: "Arts & Theater",
    gradientFrom: "from-sky-100",
    gradientTo: "to-blue-200",
  },
];

export function FeedPreview() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 -z-10 bg-[radial-gradient(60%_50%_at_70%_20%,var(--brand-soft),transparent_70%)]"
      />
      <div className="relative rounded-2xl border border-border bg-card p-4 shadow-[0_1px_0_var(--border),0_20px_60px_-30px_rgba(15,23,42,0.25)]">
        <div
          className="flex gap-2 mb-3 overflow-x-auto scrollbar-none pb-0.5"
          aria-label="Event filters"
          role="list"
        >
          {filterChips.map((chip) => (
            <div
              key={chip.label}
              role="listitem"
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                chip.selected
                  ? "motion-safe:animate-[pulse_3s_ease-in-out_infinite] bg-brand text-brand-foreground border-transparent"
                  : "bg-card border-border text-muted-foreground"
              }`}
            >
              {chip.label}
            </div>
          ))}
        </div>

        <ul className="space-y-2" aria-label="Upcoming events">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex items-center gap-3 rounded-xl border border-border p-3"
            >
              <div
                className={`size-10 shrink-0 rounded-lg bg-gradient-to-br ${event.gradientFrom} ${event.gradientTo}`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight truncate">
                  {event.title}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    {event.detail}
                  </span>
                  <span className="text-[10px] rounded-full border border-border px-1.5 py-0.5 text-muted-foreground">
                    {event.category}
                  </span>
                </div>
              </div>
              <span aria-hidden="true" className="shrink-0">
                <ArrowUpRight className="size-4 text-muted-foreground" />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
