# Feed — Iteration 7 Design Plan

Scope: `app/(main)/layout.tsx` (shared authed shell, deferred here from iteration 5), `/feed` page, `EventCard`, `EventDetailsPanel`, `FilterBar`, `SearchBar`, `LocationPermissionModal`, empty / loading / end-of-list states. Backend query + `/api/events` endpoint delivered in this same iteration by the `backend` agent; UI wires against it.

Stackable with iteration 4 (`auth-ui.md`) tokens and iteration 5 (`settings.md`) utility-surface tone. This surface is **product-first**, not brand-forward. No decorative visuals, no glassmorphism, no Instrument Serif accents (serif is landing-only).

---

## Design direction

**Register: product.** Feed is the primary daily surface. It has to feel calm at density, not shouty. The visual system stays warm-neutral and restrained; orange is an accent used in exactly three places: (1) filter chip active state, (2) primary CTA in details panel ("Get Tickets"), (3) filled Save heart when saved. Every other surface stays neutral.

**One structural decision that shapes the whole page:** cards are the interactive surface, not passive containers. Unlike `/settings` where cards are just section wrappers, feed cards *are* the product. That's the only place hover-lift and press-scale are earned; the rest of the surface stays flat.

**Copy tone:** plainspoken, direct, no salesmanship, no em dashes. Match `auth-ui.md`.

---

## Layout & structure

### `app/(main)/layout.tsx` — shared authed shell

```
<div class="min-h-svh flex flex-col">
  <header (sticky top-0 z-40 bg-background border-b border-border/70)>
    <div (mx-auto max-w-7xl px-4 md:px-6 h-14 flex items-center justify-between)>
      <Link href="/feed"> Logo mark + "Event Atlas" wordmark
      <UserMenu />  ← avatar/initial button → Popover with Settings + Sign out
  <main class="flex-1"> {children}
</div>
```

- Header is **solid**. No `backdrop-blur`. No scroll-state flip (that's landing's move; product surface doesn't get it).
- `UserMenu` uses `image` field if Google user; otherwise a monogram from the user's first initial in a `bg-brand-soft text-brand` circle.
- Settings page (iteration 5) currently uses only root layout — after this iteration it uses this shell too. **Frontend agent must migrate `/settings` under `(main)` group so both routes share this layout.**

### `/feed` page

```
<main class="mx-auto max-w-7xl px-4 md:px-6 pt-6 md:pt-8 pb-24">
  <h1 class="sr-only"> Discover events
  <SearchAndFilterBar />                ← client component
    ┌── mobile ─────────────────────────┐
    │ SearchBar (full-width row)        │
    │ FilterBar (horizontal scroll)     │
    │ ResetAll (chip button, right)     │
    └───────────────────────────────────┘
    ┌── desktop (md+) ──────────────────┐
    │ SearchBar (max-w-md left)  ┆ ResetAll │
    │ FilterBar (chip strip, wraps)     │
    └───────────────────────────────────┘
  <EventGrid />                         ← Server Component receives page 1
  <InfiniteScrollSentinel />            ← client, IntersectionObserver + fallback "Load more"
  <BackToTopButton />                   ← client, appears after 2 screens
</main>
<EventDetailsPanel />                   ← Sheet, rendered at root of client tree
<LocationPermissionModal />             ← Dialog
```

**SSR contract:** the page's Server Component calls `getFeedPage({ ...defaults, cursor: null, limit: 20 })` from `lib/events/feed-query.ts` and passes the initial rows + next cursor to the client `<EventGrid>`. Client takes over from there.

---

## EventCard

**Structure (vertical, image-on-top):**

```
<article class="group relative overflow-hidden rounded-xl border border-border bg-card
                transition [transition-duration:200ms] ease-out
                hover:-translate-y-px hover:border-border-strong hover:shadow-sm
                focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2
                active:translate-y-0 active:scale-[.995]">
  <div class="relative aspect-[16/10] overflow-hidden bg-brand-soft">
    <Image />  or  <CategoryPlaceholder />       ← Lucide category icon centered, muted-foreground
    <!-- bottom scrim: 40% black gradient, 40% height -->
    <div class="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/50 to-transparent" />
    <span class="absolute bottom-3 left-3 text-white text-xs font-medium tracking-wide uppercase">
      {category}
    </span>
    <!-- (no Save heart in iteration 7 — see "Action stubs" below) -->
  </div>
  <div class="p-4 space-y-2">
    <h2 class="text-base font-medium leading-snug tracking-tight line-clamp-2">
      {title}
    </h2>
    <div class="text-xs text-muted-foreground tabular-nums">
      {formatDayTime(startTime)} · {venueName} · {distanceMi}mi · {priceLabel}
    </div>
  </div>
  <!-- entire card = one <button aria-label="View details for {title}"> overlay, absolute inset-0, z-0 above image -->
  <button class="absolute inset-0" aria-label={`View details for ${title}`} />
</article>
```

**Interaction:**
- Hover: `-translate-y-px` + `hover:border-border-strong` + tiny `shadow-sm`. 200ms ease-out.
- Active/press: `active:scale-[.995]`. Feels tactile without moving layout.
- Focus: the invisible button carries focus; `focus-within` on the article renders a `ring-2 ring-brand ring-offset-2` on the whole card.
- Click: opens `EventDetailsPanel` populated with this event's full data (fetched from local state; no re-fetch — grid rows already have everything needed).

**Placeholder image:** when `imageUrl == null`, render the `CategoryPlaceholder` — `bg-brand-soft` + the category's Lucide icon at 48×48 centered, `text-muted-foreground/60`. Icons:
- Music → `Music4`, Sports → `Trophy`, Arts & Theater → `Drama`, Food & Drink → `UtensilsCrossed`, Networking → `Users`, Health & Wellness → `HeartPulse`, Outdoor & Adventure → `Trees`, Family Friendly → `Baby`, Community & Culture → `Landmark`, Nightlife → `Sparkles`, Education → `GraduationCap`, Other → `CalendarDays`.

**Grid:**
```
grid grid-cols-1 gap-4
sm:grid-cols-2 sm:gap-4
lg:grid-cols-3 lg:gap-6
```

**Meta row format:**
- `{formatDayTime(startTime)}` → `"Sat, Jul 12 · 8:00 PM"` (short weekday + short month + numeric day, then dot, then time). Uses user's browser locale.
- `distanceMi` → integer for `>= 10 mi`, one decimal for `< 10 mi`. Suffix `" mi"`.
- `priceLabel` → `"Free"` if `isFree`; else `"$" + price` if `price` present; else `"Price not listed"`.
- `venue` → single string (e.g., `"Madison Square Garden, NYC, NY"`). The Prisma schema stores venue as one field, not name+address split. Display as one truncating line.

**No action buttons on the card in iteration 7.** Save + Going + Calendar all defer to iteration 8. Rendering them as disabled stubs is user-hostile (three broken affordances per card). The card in iteration 7 is a pure discovery surface; iteration 8 will add a compact action row (Save · Going icons on card, no Calendar on card) without disturbing the visual balance already established.

---

## EventDetailsPanel

**Pattern: Sheet** (shadcn `sheet`). Right-side drawer on `md+` (width `w-full sm:max-w-lg` ≈ 480px). Bottom sheet on mobile (`h-[90dvh]`). Sheet backdrop dims the grid to `bg-black/40`; content = `bg-background`.

**Content order:**

```
<SheetHeader>
  <SheetClose />  ← X button top-right, 44×44 hit
  <!-- hero image: 16:10 aspect, spans full width, no padding above -->
  <div class="relative -mt-6 mb-4 aspect-[16/10] overflow-hidden bg-brand-soft">
    <Image /> or <CategoryPlaceholder />
    <div class="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/60 to-transparent" />
    <span class="absolute bottom-4 left-6 text-white text-xs uppercase tracking-wide font-medium">
      {category}
    </span>
  </div>
</SheetHeader>

<div class="px-6 pb-32 space-y-6">  ← pb-32 leaves room for sticky footer
  <!-- Title block -->
  <div class="space-y-2">
    <SheetTitle class="text-2xl font-semibold tracking-tight leading-tight">
      {title}
    </SheetTitle>
    <p class="text-sm text-muted-foreground tabular-nums">
      {formatFullDate(startTime)} · {formatTime(startTime)}{endTime ? ` – ${formatTime(endTime)}` : ""}
    </p>
  </div>

  <!-- Price + distance summary strip -->
  <div class="flex flex-wrap gap-x-8 gap-y-4 text-sm tabular-nums">
    <div>
      <div class="text-xs uppercase tracking-wide text-muted-foreground">Price</div>
      <div>{priceLabel}</div>
    </div>
    <div>
      <div class="text-xs uppercase tracking-wide text-muted-foreground">Distance</div>
      <div>{distanceMi} mi</div>
    </div>
    {performerName && (
      <div>
        <div class="text-xs uppercase tracking-wide text-muted-foreground">Performer</div>
        <div>{performerName}</div>
      </div>
    )}
  </div>

  <Separator />

  <!-- Description -->
  {description && (
    <div class="space-y-2">
      <div class="text-xs uppercase tracking-wide text-muted-foreground">About</div>
      <p class="text-sm leading-relaxed whitespace-pre-line line-clamp-8 group-[.expanded]:line-clamp-none">
        {description}
      </p>
      <button class="text-sm text-brand hover:underline"> Show more </button>  ← only if truncated
    </div>
  )}

  <Separator />

  <!-- Venue + maps -->
  <div class="space-y-3">
    <div class="text-xs uppercase tracking-wide text-muted-foreground">Venue</div>
    <div class="text-sm font-medium">{venue}</div>
    <div class="flex gap-2 pt-1">
      <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer"
         class={buttonVariants({ variant: "outline", size: "sm" })}>
        Open in Google Maps ↗
      </a>
      <a href={appleMapsUrl} target="_blank" rel="noopener noreferrer"
         class={buttonVariants({ variant: "outline", size: "sm" })}>
        Open in Apple Maps ↗
      </a>
    </div>
  </div>
</div>

<!-- Sticky footer -->
<div class="absolute inset-x-0 bottom-0 border-t border-border bg-background/95
            px-6 py-4 flex gap-3 items-center">
  <a href={ticketUrl} target="_blank" rel="noopener noreferrer"
     class={buttonVariants({ variant: "brand", size: "lg" }) + " flex-1"}>
    Get Tickets ↗
  </a>
</div>
```

**Only real actions in iteration 7:** Maps deep-links + Get Tickets. No Save, no Going, no Add to Calendar (all iteration 8).

**Maps URL generation** (single `venue` string; both providers accept a free-text query):
- Google: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}`
- Apple: `https://maps.apple.com/?q=${encodeURIComponent(venue)}`

**Provider label** (small "via Ticketmaster" text next to Get Tickets) omitted — the ticket click will make provenance obvious via domain.

**Motion:** Sheet enters 300ms ease-out, exits 250ms ease-out (exit faster per shared laws). Backdrop crossfade in sync. Respect `prefers-reduced-motion` → instant.

**Close affordances:** X button, click on backdrop, Escape key, and (mobile only) swipe-down. shadcn `Sheet` handles all four.

---

## SearchBar

**Structure:**
```
<div class="relative w-full md:max-w-md">
  <Search icon absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground />
  <input type="search" placeholder="Search events or performers" aria-label="Search events"
         class="h-10 w-full pl-9 pr-9 rounded-md border border-input bg-background
                text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
  {query && (
    <button aria-label="Clear search" class="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6
                                             rounded-md text-muted-foreground hover:text-foreground">
      <X className="w-4 h-4" />
    </button>
  )}
</div>
```

**Behavior:**
- Debounce **300ms**. On debounce fire → update URL `?q=` query param (via `router.replace`, not `push`, to avoid history spam) → triggers re-fetch.
- Empty query → remove `?q=` from URL.
- Enter key → force immediate submission (skip debounce).
- Escape → clear query.
- On mount, initialize from `?q=` URL param.

---

## FilterBar

**Structure:** horizontal chip strip. Each chip = a filter with a Popover.

```
<div class="flex gap-2 overflow-x-auto md:flex-wrap md:overflow-visible py-2 -mx-4 px-4 md:mx-0 md:px-0
            [scrollbar-width:none] [-webkit-scrollbar]:hidden">
  <FilterChip name="Category"    value={selectedCategories.length ? `Category`  : `Category`}
              count={selectedCategories.length}  popover={<CategoryPopover />} />
  <FilterChip name="Distance"    value={`${distanceMi} mi`}                    popover={<DistancePopover />} />
  <FilterChip name="Date"        value={`${dateRangeDays} days`}                popover={<DateRangePopover />} />
  <FilterChip name="Price"       value={priceLabel}                             popover={<PricePopover />} />
  <!-- Pro chips: rendered, disabled with lock badge for FREE users -->
  <FilterChip name="Experience"  proLocked={!isPro} popover={<ExperiencePopover />} />
  <FilterChip name="Family friendly" proLocked={!isPro} popover={<FamilyPopover />} />
  <FilterChip name="Free only"   proLocked={!isPro} popover={<FreeOnlyPopover />} />
  <FilterChip name="Time of day" proLocked={!isPro} popover={<TimeOfDayPopover />} />
  <FilterChip name="Venue"       proLocked={!isPro} popover={<VenuePopover />} />
  <!-- Reset all: only visible if any filter differs from user preferences -->
  <button class="ml-auto text-xs text-muted-foreground hover:text-foreground underline underline-offset-4">
    Reset filters
  </button>
</div>
```

**FilterChip visual:**
- **Idle:** `h-8 px-3 rounded-full border border-border bg-background text-sm text-foreground hover:border-border-strong`
- **Active (has non-default value):** `border-brand bg-brand-soft text-brand`
- **Pro-locked:** `opacity-70 cursor-not-allowed` + small lock icon; clicking opens a mini Popover with "Upgrade to Pro" copy (not a full modal — cheap).
- **Count badge** (Category, Venue): small `ml-1 rounded-full bg-brand text-brand-foreground text-[10px] px-1.5 py-0.5 tabular-nums font-medium`

**Popover contents (compact — no page-shifting)):**

- **Category:** grid of 12 checkbox chips (2 col in popover, w-72). Selected = `bg-brand-soft border-brand text-brand`. Apply on close.
- **Distance:** single number input, `1–500`, suffix `mi`. Apply on blur/enter.
- **Date range:** number input, `1–365`, suffix `days`. Apply on blur/enter.
- **Price:** two number inputs (min / max) side by side + a "Free only" toggle. Apply on blur/enter.
- **Experience type:** three-state radio (Indoor / Outdoor / Both).
- **Family friendly:** switch.
- **Free only:** switch.
- **Time of day:** four-state radio (Morning / Afternoon / Evening / Any).
- **Venue:** text input `contains` match.

**State model:** URL query params are the source of truth. Missing param = fall back to `UserPreferences` default. FilterChip labels show current effective value regardless of source (default or override). On change, the effective value is written to URL — but only if it differs from the preference default (keeps URLs clean). Reset button removes all filter params.

**URL param names** (short, stable):
`?q=search&cat=MUSIC,SPORTS&dist=25&days=30&pmin=0&pmax=100&exp=INDOOR&family=1&free=1&time=EVENING&venue=Radio+City&cursor=<opaque>`

---

## LocationPermissionModal

**Dialog** (shadcn `dialog`). Shown on first mount of `/feed` if `sessionStorage.getItem("geo.answered") == null`.

```
<Dialog>
  <DialogContent class="max-w-sm">
    <DialogTitle>Where should we look?</DialogTitle>
    <DialogDescription class="text-sm text-muted-foreground">
      Precise location gives you the tightest matches. If you'd rather not share,
      we'll use the ZIP code you signed up with.
    </DialogDescription>
    <div class="flex flex-col gap-2 pt-4">
      <Button variant="brand" onClick={requestPreciseLocation}>
        Use precise location
      </Button>
      <Button variant="outline" onClick={skipToZip}>
        Use ZIP code instead
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

**Behavior:**
- "Use precise location" → `navigator.geolocation.getCurrentPosition()` → on success, cache `{lat, lng, ts}` to `sessionStorage["geo.coords"]`, set `sessionStorage["geo.answered"] = "granted"`, close modal, trigger feed re-fetch with the fresh coords. On error/denial → fall through to ZIP behavior + set `sessionStorage["geo.answered"] = "denied"`.
- "Use ZIP code instead" → set `sessionStorage["geo.answered"] = "skipped"`, close modal, feed uses `user.lat/lng` (already in the SSR payload).
- Feed queries always accept `(lat, lng)` as arguments. Client reads `sessionStorage["geo.coords"]` (if present) and passes it to `/api/events`. Server never trusts client-supplied coords for anything other than the feed query (they never overwrite `user.lat/lng`).

**Not shown after answered:** `sessionStorage` is per-tab. Fresh tab = re-prompt. Acceptable trade-off — matches SA §Location behavior.

---

## States

### Loading skeleton

Only shown on **client** filter/search re-fetch. SSR renders real data on first paint. Skeleton = 6 card-shaped shimmering blocks:

```
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6" aria-busy="true">
  {[...Array(6)].map(i => (
    <div class="rounded-xl border border-border bg-card overflow-hidden animate-pulse">
      <div class="aspect-[16/10] bg-muted" />
      <div class="p-4 space-y-2">
        <div class="h-4 bg-muted rounded w-3/4" />
        <div class="h-3 bg-muted rounded w-1/2" />
      </div>
    </div>
  ))}
</div>
```

### Empty state (zero results)

```
<div class="mx-auto max-w-md py-24 text-center space-y-4">
  <SearchX class="mx-auto w-12 h-12 text-muted-foreground/50" />
  <h2 class="text-lg font-medium">Nothing here yet.</h2>
  <p class="text-sm text-muted-foreground">
    Try widening your filters, or check back after the next sync.
  </p>
  <div class="flex gap-2 justify-center pt-2">
    <Button variant="brand" onClick={resetFilters}>Reset filters</Button>
    <Button variant="ghost" asChild><Link href="/settings">Update ZIP</Link></Button>
  </div>
</div>
```

### End of list

After the last cursor page returns fewer than `limit` rows:

```
<div class="py-12 text-center text-sm text-muted-foreground">
  You've seen every match for these filters.
</div>
```

Plainspoken, no em dash.

### Error

Client fetch failure banner **at the bottom of the grid**, non-blocking:

```
<div class="mx-4 md:mx-0 my-6 rounded-md border border-border bg-muted px-4 py-3
            flex items-center justify-between text-sm">
  <span>We couldn't load more events. Check your connection.</span>
  <Button size="sm" variant="outline" onClick={retry}>Retry</Button>
</div>
```

---

## Motion

- Card hover: 200ms ease-out (`--tw-transition-duration` = 200ms).
- Card active/press: 100ms scale-99 in, immediate release.
- FilterChip toggle: 150ms ease-out.
- Sheet enter: 300ms; exit: 250ms. Both ease-out (`ease-[cubic-bezier(0.22,1,0.36,1)]` — quart out, per shared laws).
- Dialog enter: 200ms; exit: 150ms.
- Popover: 150ms.
- All motion respects `prefers-reduced-motion: reduce` — durations collapse to 0.
- **Never animate `width` / `height` / `top` / `left`.** Only `transform` and `opacity`.

---

## Tokens

**Reuse from iteration 4** (`globals.css`):
- `--background`, `--foreground`, `--card`, `--muted`, `--muted-foreground`, `--border`, `--input`
- `--brand`, `--brand-hover`, `--brand-active`, `--brand-foreground`, `--brand-soft`

**Add** (small additions to `globals.css`):
```css
:root {
  --border-strong: oklch(0.86 0.008 41);   /* card hover border */
}
```

Add matching `border-border-strong` utility in `tailwind.config` or use `border-[var(--border-strong)]` inline.

No new brand tokens. Orange remains the accent, used only in: active FilterChip, "Get Tickets" primary CTA, focus rings, small badges.

---

## Typography scale

Reuses iteration 4's Geist Sans setup. Explicit sizes on this surface:

| Role | Size | Weight | Notes |
|---|---|---|---|
| Card title | `text-base` (16px) | 500 | `tracking-tight leading-snug line-clamp-2` |
| Card meta | `text-xs` (12px) | 400 | `tabular-nums text-muted-foreground` |
| Panel title | `text-2xl` (24px) | 600 | `tracking-tight leading-tight` |
| Panel labels | `text-xs uppercase` | 500 | `tracking-wide text-muted-foreground` |
| Panel body | `text-sm` (14px) | 400 | `leading-relaxed` |
| Filter chip | `text-sm` (14px) | 400 | brand when active |
| Empty state h2 | `text-lg` | 500 | — |
| Numbers everywhere | — | — | `tabular-nums` (prices, distances, dates) |

No Instrument Serif on this surface. Serif is landing-only per iteration 4.

---

## Accessibility

- **h1** on `/feed`: `<h1 class="sr-only">Discover events</h1>`. Cards use **h2** for titles (semantic outline: Feed page > cards).
- **Card overlay button**: `<button aria-label="View details for {title}">` covers the article via `absolute inset-0`. Save/Going icons (iteration 8) will sit above with `z-10` + `stopPropagation`.
- **Keyboard**: Tab reaches every card in visual order. Enter/Space on the focused card opens the panel. Escape closes the panel.
- **FilterChip**: `<button aria-pressed={hasNonDefaultValue} aria-expanded={popoverOpen}>`.
- **Category multi-select popover**: each option is a `<label><input type="checkbox"></label>` — real form semantics, not fake toggles.
- **Sheet / Dialog**: shadcn primitives handle focus trap, `aria-modal`, restore focus on close.
- **Infinite scroll**:
  - `aria-live="polite"` region at end of grid announces "Loaded 20 more events" (or the actual count).
  - Fallback `<button>Load more</button>` renders if IntersectionObserver isn't triggering (SSR / no-JS fallback).
  - "Back to top" fixed button (`bottom-6 right-6`, `z-30`) appears after scroll > `2 * window.innerHeight`.
- **Reduced motion**: shadcn `Sheet`/`Dialog` already respect it; verify our custom hover/press don't override.
- **Color contrast**: reuse iteration 4's verified `--brand` at 5.42:1. New `--border-strong` must measure ≥3:1 against `--background`.
- **Focus rings**: 2px `ring-brand` + 2px offset. Match iteration 4.

---

## shadcn components to install

Not yet installed:
- `sheet` — details panel
- `popover` — filter chips
- `badge` — small count badges on Category / Venue chips
- `separator` — panel dividers
- `skeleton` — loading state

Already installed: `button`, `card`, `input`, `label`, `dialog`, `switch`. The `Button` `brand` variant must be re-verified after any `pnpm dlx shadcn add` invocation (installer has overwritten it before — iteration 5 report).

**Icons:** `lucide-react` already a transitive dep via shadcn. Use for category placeholders + all icon-only buttons.

---

## Component tree summary

```
app/(main)/
  layout.tsx                          ← authed shell (Header + UserMenu)
  feed/
    page.tsx                          ← Server Component: auth check, SSR getFeedPage()
components/
  main/
    header.tsx                        ← Logo + UserMenu container
    user-menu.tsx                     ← Popover, avatar/initial, Settings + Sign out
  feed/
    search-and-filter-bar.tsx         ← client wrapper, holds URL param sync logic
    search-bar.tsx                    ← client, debounced
    filter-bar.tsx                    ← client, chip strip
    filter-chip.tsx                   ← primitive chip component
    filter-popover-category.tsx
    filter-popover-distance.tsx
    filter-popover-date-range.tsx
    filter-popover-price.tsx
    filter-popover-experience.tsx     ← Pro
    filter-popover-family.tsx         ← Pro
    filter-popover-free.tsx           ← Pro
    filter-popover-time.tsx           ← Pro
    filter-popover-venue.tsx          ← Pro
    pro-lock-badge.tsx                ← reused from iteration 5
    reset-filters-button.tsx
    event-grid.tsx                    ← client, holds page-1 SSR data + client-fetched pages
    event-card.tsx                    ← server-safe pure render; parent binds onClick
    event-details-panel.tsx           ← client, Sheet
    location-permission-modal.tsx     ← client, Dialog
    empty-state.tsx
    end-of-list.tsx
    error-banner.tsx
    load-more-button.tsx              ← IntersectionObserver + fallback
    back-to-top-button.tsx
    category-placeholder.tsx          ← Lucide icon per category
lib/
  events/
    feed-query.ts                     ← shared query, owned by backend agent
    format.ts                         ← formatDayTime, formatFullDate, priceLabel, distanceLabel
    maps.ts                           ← googleMapsUrl, appleMapsUrl builders
  filters/
    url-params.ts                     ← parse + serialize URL filter state
    defaults.ts                       ← merge UserPreferences → effective filter values
```

The `/settings` page moves from `app/settings/page.tsx` under `app/(main)/settings/page.tsx` so both routes share the shell. Middleware config unchanged (already covers all routes).

---

## What's NOT in this iteration (explicit)

- **Save button** — iteration 8. No stub on card, no stub in panel.
- **Going button** — iteration 8. No stub.
- **Add to Calendar** — iteration 8. No stub.
- **`.ics` download / Google Calendar / Apple Calendar deep-links** — iteration 8.
- **Reminders** — iteration 8.
- **Friend badges on events ("3 friends going")** — iteration 9.
- **Share event link** — iteration 9.
- **Dark mode design polish** — deferred (tokens exist and shouldn't regress; only light mode is designed).
- **Right-rail persistent panel on wide screens** — Sheet is the pattern at all breakpoints.
- **Multiple saved locations** — Pro feature, out of scope for iteration 7.
- **A "Sort" control** — default sort is `startTime asc` per PRD, no user-facing sort in V1.

---

## Backend contract (what the frontend consumes)

The `backend` agent owns `lib/events/feed-query.ts` and `GET /api/events`. The frontend expects:

```ts
type FeedRow = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  startTime: string;          // ISO
  endTime: string | null;
  venueName: string;          // Prisma Event.venue is a single string today; backend forwards it as both venueName + venueAddress so a future schema split doesn't break UI callers
  venueAddress: string;       // same value as venueName in iteration 7; UI prefers venueAddress and falls back to venueName
  latitude: number;
  longitude: number;
  distanceMi: number;         // computed server-side, rounded to 1 dp
  category: Category;
  priceMin: number | null;    // = Event.price (schema has a single price field; range filters compare against this value)
  priceMax: number | null;    // reserved for a future price-range Event schema; iteration 7 leaves it null
  isFree: boolean;
  performerName: string | null;
  ticketUrl: string;          // from EventSource.ticketUrl (primary source, deterministic priority TM > EB > MU)
  provider: Provider;         // for provenance if needed
};

type FeedPage = {
  rows: FeedRow[];
  nextCursor: string | null;  // opaque base64 of (startTime, id)
};
```

`GET /api/events` accepts the URL query params listed above (`q`, `cat`, `dist`, `days`, `pmin`, `pmax`, `exp`, `family`, `free`, `time`, `venue`, `cursor`, `lat`, `lng`, `limit`). Returns `FeedPage` or `{ error }` with generic message on failure.

The Server Component on `/feed` calls the same underlying function directly (not through the API route) for SSR page 1, per CLAUDE.md's shared query rule.

---

## Anti-patterns to avoid (as a checklist for review)

- No `backdrop-blur` header (glassmorphism ban).
- No em dashes anywhere in copy.
- No emoji as icons.
- No gradient text.
- No side-stripe borders on cards or callouts.
- No skeleton on SSR initial paint — SSR renders real data.
- No stub buttons for iteration 8 features on the card or panel.
- No `<button>` inside `<button>` — use the overlay pattern for card clickability.
- No animating `width` / `height` / layout properties.
- No filter state hidden in JS — URL query params are the source of truth so filtered feeds are shareable.
- No `?cat=&dist=&days=...` bloat when user is on defaults — only serialize overrides.
