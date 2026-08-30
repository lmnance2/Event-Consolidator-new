# Friends / Social — Iteration 9 Design Plan

Scope: the `/friends` page (four-tab surface), the "Friends going" section added to `EventDetailsPanel`, the "Invite friends" menu item (Pro-locked), the pending-request badge on `UserMenu`, and the public share page `/e/[id]`. Design decisions locked here; the frontend agent builds against this file. Light mode only. No em dashes anywhere.

Stackable with iterations 4/7/8 — inherits the warm-neutral tokens, the brand orange restraint ("orange in exactly three places" per feed.md), and the product-first flat register. Instrument Serif italic is reserved for one accent word max across this iteration ("your" in the empty state on Friends). The share page `/e/[id]` sits in the **brand** register because it's the first surface an unsigned-in guest sees; slightly warmer treatment there.

---

## 0. Tokens & primitives inherited

- Colors: `--background`, `--foreground`, `--muted`, `--muted-foreground`, `--border`, `--border-strong`, `--brand` (`oklch(0.54 0.18 39)`), `--brand-foreground`.
- Type: system sans for UI, Instrument Serif for the single italic accent.
- Radius: `rounded-md` (buttons/inputs) · `rounded-lg` (cards) · `rounded-full` (avatars, pending dot).
- Spacing rhythm: `p-4 / p-6 / p-8` and `gap-2 / gap-3 / gap-4 / gap-6`.
- Primitives available (all base-ui, not Radix): `Button`, `Input`, `Card`, `Badge`, `Dialog`, `DropdownMenu` (iter 8), `Popover`, `Sheet`, `Skeleton`, `Separator`, `Label`, `Switch`. Missing → author (see §7).
- Focus ring: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2` — reuse across every interactive element.

---

## 1. `/friends` page — layout & tabs

**Route:** `app/(main)/friends/page.tsx`, SSR Server Component, `auth()`-gated (redirects to `/login` via middleware, but also asserts session in-page for the direct-nav case).

**Shell:** inherits `app/(main)/layout.tsx` — Header + UserMenu. The page body lives in a `max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10` container. Narrower than `/feed` because rows are text-heavy; 3xl keeps line length in the readable band (55–75 chars).

**Page header block:**
```
<header className="mb-8">
  <h1 className="text-3xl font-semibold tracking-tight">Friends</h1>
  <p className="mt-1 text-sm text-muted-foreground">
    See what your friends are going to and share events with them.
  </p>
</header>
```

No serif italic here — reserved for the Friends-tab empty state (below).

### Tabs

Four tabs, sticky under the header. Uses a **new** `Tabs` primitive at `components/ui/tabs.tsx` wrapping `@base-ui-components/react/tabs` (frontend agent authors it; parallels the iter-8 `dropdown-menu.tsx` wrapper — one `data-slot` pattern, no Radix). Tab list is a horizontal row, `gap-6`, underline indicator (2px `bg-brand`, `transition-all 200ms`) for the active tab. On mobile (< 640px), the tab list scrolls horizontally with `overflow-x-auto snap-x`.

```
Friends   Requests (2)   Add   Activity ✦
```

- Numeric count next to Requests when > 0 (rendered as `<Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[11px]">2</Badge>`).
- `✦` next to Activity = the small brand-tinted lock glyph reused from Pro filter chips (see `components/feed/filter-chip.tsx` pattern). Free users see the glyph regardless of pending activity; Pro users see it plain ("Activity", no glyph).

**Selected-tab persistence:** URL param `?tab=friends|requests|add|activity`. Deep-linkable + back-nav preserves state (per iter 7's URL-as-state principle). When no `tab` param is present, the SSR page picks the default intelligently: `requests` when incoming pending > 0, else `add` when friends.length === 0, else `friends`. Explicit URL always wins.

**Underline color:** `bg-foreground` (not `bg-brand`) — orange is reserved for Save, Get Tickets, primary brand buttons per feed.md's "orange in exactly three places" commitment. The active tab's *text* can be `text-foreground` (weight bump to `font-medium`); no brand tint needed to signal selected.

**Keyboard:** tab list is a proper roving-focus tablist (Base UI handles this); Left/Right arrows move focus, Enter/Space activates. Content region has `tabindex="0"` so screen readers land on the new content after selection.

---

## 2. Tab 1 — Friends

**Populated state:**

```
<ul className="divide-y divide-border">
  {friends.map(f => (
    <li key={f.id} className="flex items-center gap-4 py-4">
      <Avatar user={f} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{f.name ?? "Unnamed friend"}</p>
        <p className="truncate text-xs text-muted-foreground">Friends since {formatMonthYear(f.friendsSince)}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={() => setUnfriending(f)}>
        Remove
      </Button>
    </li>
  ))}
</ul>
```

- `Avatar` (§7) shows Google image if present, else initial-in-monogram. 40×40. `alt` = the name (falls back to `""` when Unnamed, which is the a11y-correct treatment for decorative fallback).
- "Remove" is intentionally ghost + small; destructive but not visually loud (matches Settings' delete-account placement).
- Row hover: `bg-muted/40 transition-colors 150ms`. Whole row not clickable — no profile pages in v1.

**Unfriend confirmation** — `Dialog` (reuses shadcn/base-ui dialog from iter 5 Settings):
- Title: "Remove {name}?"
- Body: "You'll no longer see each other's Going events. You can send a new friend request anytime."
- Actions: `Cancel` (ghost) · `Remove` (destructive — solid, `bg-red-600 hover:bg-red-700 text-white`). No brand orange on destructive.

**Empty state (zero friends):**

```
<div className="rounded-lg border border-dashed border-border p-8 text-center">
  <UsersIcon className="mx-auto h-8 w-8 text-muted-foreground" />
  <p className="mt-3 text-base">
    Discover events with <span className="font-serif italic text-foreground">your</span> people.
  </p>
  <p className="mt-1 text-sm text-muted-foreground">
    Send a friend request to see what they're going to.
  </p>
  <Button asChild variant="brand" size="sm" className="mt-5">
    <Link href="/friends?tab=add">Add a friend</Link>
  </Button>
</div>
```

This is the one Instrument Serif italic word for the iteration ("your").

---

## 3. Tab 2 — Requests

Two subsections stacked. No secondary tab — a single scroll with `<h2>` section headers keeps it scannable at typical inbox sizes (< 10 pending each way).

```
<section>
  <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
    Incoming
  </h2>
  {/* IncomingRequestRow[] or empty state */}
</section>

<Separator className="my-8" />

<section>
  <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
    Sent
  </h2>
  {/* OutgoingRequestRow[] or empty state */}
</section>
```

**IncomingRequestRow:**
```
<li className="flex items-center gap-4 py-3">
  <Avatar user={from} size={40} />
  <div className="min-w-0 flex-1">
    <p className="truncate text-sm font-medium">{from.name ?? from.email}</p>
    <p className="text-xs text-muted-foreground">Sent {relativeTime(createdAt)}</p>
  </div>
  <div className="flex items-center gap-2">
    <Button variant="brand" size="sm" onClick={accept}>Accept</Button>
    <Button variant="ghost" size="sm" onClick={decline}>Decline</Button>
  </div>
</li>
```

Optimistic UI: on Accept, row animates to `opacity-0 -translate-x-2` over 200ms, then reflows into the Friends tab silently (`router.refresh()` after the API returns; count in tab-bar re-derives).

**OutgoingRequestRow:**
```
<li className="flex items-center gap-4 py-3">
  <Avatar user={to} size={40} />
  <div className="min-w-0 flex-1">
    <p className="truncate text-sm font-medium">{to.name ?? to.email}</p>
    <p className="text-xs text-muted-foreground">Sent {relativeTime(createdAt)}</p>
  </div>
  <Button variant="ghost" size="sm" onClick={cancel}>Cancel</Button>
</li>
```

**Empty states:**
- Incoming: `<p className="text-sm text-muted-foreground py-2">No new requests.</p>` (subtle; not a boxed placeholder — the Sent section still has content potentially).
- Sent: `<p className="text-sm text-muted-foreground py-2">You haven't sent any requests yet.</p>`.
- Both empty: single centered card matching the Friends-tab empty state, minus the italic accent (used only once per iteration).

---

## 4. Tab 3 — Add

Minimal form. **Enumeration-safe** — see §11. No card wrapper — a lone form doesn't need a bordered container.

```
<div className="max-w-md">
  <h2 className="text-lg font-semibold">Send a friend request</h2>
  <p className="mt-1 text-sm text-muted-foreground">
    Enter your friend's Event Atlas email address.
  </p>

  <form className="mt-5 space-y-4" onSubmit={submit}>
    <div>
      <Label htmlFor="friend-email">Email</Label>
      <Input
        id="friend-email"
        type="email"
        autoComplete="email"
        placeholder="friend@example.com"
        {...register("email")}
      />
    </div>

    <Button type="submit" variant="brand" disabled={isSubmitting} className="w-full">
      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send request"}
    </Button>
  </form>
</div>
```

**Success state (always identical regardless of outcome):**

After the server responds 200, render a small `Alert` under the button and clear the form. Copy:

> Request sent. If they have an account, they'll see it in their requests.

Auto-dismiss the alert after 6s or on next submit. Never say "not found" or "already friends" — those leak existence per §11.

**Validation errors** (Zod, client-side only): standard field errors under Input. Server errors (400/500/rate-limit) surface as a red banner above the button with generic copy: "Something went wrong. Try again." (Rate-limit reads exactly the same copy — no "too many requests" hint that could be used for enumeration timing.)

---

## 5. Tab 4 — Activity (Pro)

**Pro users (`isPro === true`):**

Chronological grouped list of friends' Save + Going events over the last 30 days. Grouped by day header (`Today` / `Yesterday` / `Mar 12`). Cursor pagination on scroll (reuses the iter 7 IntersectionObserver + fallback button pattern from `components/feed/load-more.tsx`).

```
<section>
  <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide sticky top-16 bg-background py-2">
    Today
  </h2>
  <ul className="divide-y divide-border">
    {items.map(item => (
      <li key={item.id} className="flex items-center gap-4 py-3">
        <Avatar user={item.actor} size={36} />
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-medium">{item.actor.name}</span>
            <span className="text-muted-foreground"> is going to </span>
            <Link href={`/feed?event=${item.event.id}`} className="font-medium hover:underline">
              {item.event.title}
            </Link>
          </p>
          <p className="text-xs text-muted-foreground">{relativeTime(item.createdAt)} · {formatDay(item.event.startTime)}</p>
        </div>
        <Image src={item.event.imageUrl} alt="" width={48} height={48} className="rounded-md object-cover shrink-0" />
      </li>
    ))}
  </ul>
</section>
```

Verbs: "is going to" (GoingEvent) / "saved" (SavedEvent). Past-tense on saved reads more naturally in a feed than "is saving." The link opens `/feed?event=<id>` in a new tab — a soft deep link to the feed with the panel auto-open param (this deep-link is aspirational per iter 8; falling back to `/feed` if the param isn't wired yet is fine).

**Free users (upsell placeholder):**

```
<div className="rounded-lg border border-border p-8 text-center">
  <SparklesIcon className="mx-auto h-8 w-8 text-brand" />
  <p className="mt-3 text-base font-medium">Activity is a Pro feature</p>
  <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
    See what your friends are saving and going to as it happens.
  </p>
  <Button variant="brand" size="sm" className="mt-5" disabled title="Coming soon">
    Upgrade to Pro
  </Button>
</div>
```

Upgrade button is `disabled` with tooltip because Stripe is post-MVP (per PRD). The visual promise is there without a broken click.

**Empty (Pro user, no friend activity):**

```
<p className="text-sm text-muted-foreground py-6 text-center">
  Nothing new from your friends yet.
</p>
```

---

## 6. `EventDetailsPanel` — Friends going + Invite menu item

### Friends going section

**Placement:** Insert as a new section **between the description and the venue block** in `components/feed/event-details-panel.tsx`. Only rendered when the fetched list length > 0 (empty case is hidden entirely — no visual noise for the common case).

**Fetch:** on panel open, `useEffect` calls `GET /api/events/[id]/friends-going`. Loading state shows a single skeleton row for 300ms+; the request is expected to be fast (small union query).

**Density decision:** avatars are visual noise here — the names carry all the information and the panel is already dense (~10 informational blocks). Default to **text-only**; avatars only appear when count ≥ 3, without names, capped at 4 + overflow "+N".

```
<section className="mt-6">
  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
    Friends going
  </h3>
  {friends.length < 3 ? (
    <p className="mt-2 text-sm text-foreground">
      {namesSummary(friends)}
    </p>
  ) : (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex -space-x-2">
        {friends.slice(0, 4).map(f => (
          <Avatar key={f.id} user={f} size={28} className="ring-2 ring-background" />
        ))}
      </div>
      <p className="text-sm text-foreground">
        {friends.length > 4
          ? `${friends[0].name}, ${friends[1].name}, and ${friends.length - 2} others`
          : namesSummary(friends)}
      </p>
    </div>
  )}
</section>
```

`namesSummary`:
- 1 friend: `"Alex is going"`
- 2 friends: `"Alex and Sam are going"`

### Panel actions menu (renamed from AddToCalendarMenu)

The existing `AddToCalendarMenu` is repurposed into a general **actions menu** for the event, keeping the panel footer at four controls (Save · Going · Actions · Get Tickets) rather than growing to five. Menu items in order:

1. **Copy link** — writes `${origin}/e/${event.id}` to clipboard. Success toast "Link copied."
2. `<Separator />`
3. **Google Calendar** — existing behavior.
4. **Apple Calendar** — existing behavior.
5. **Download .ics** — existing behavior.
6. `<Separator />`
7. **Invite friends** — Pro-gated (see below).

Trigger button label: "Share" (with a small chevron). This reframes the menu around the visitor's most likely intent (Copy link — the share flow) while keeping calendar exports discoverable inside.

**Free-tier interaction on "Invite friends":** clicking the item closes the menu and opens a small `Popover` anchored to the actions trigger, containing:

```
Invite friends is a Pro feature.
Upgrade to send this event to specific friends.
[Upgrade to Pro]  ← disabled + `title="Coming soon"` until Stripe lands
```

The item itself renders enabled with a small `Pro` tag on the right:

```
<DropdownMenuItem onSelect={() => setUpsellOpen(true)}>
  <UserPlusIcon className="h-3.5 w-3.5 mr-2 shrink-0" />
  Invite friends
  <span className="ml-auto text-[10px] font-medium text-brand uppercase tracking-wide">Pro</span>
</DropdownMenuItem>
```

Enabled + clickable is the correct affordance for a permission gate (vs. `disabled` which reads as a bug on touch/keyboard). The upsell popover is reachable by every input mode.

**Pro-tier interaction:** clicking opens `<InviteFriendsDialog eventId={id} />`:
- Short blurb: "Invite friends to {eventTitle}"
- Fetches `/api/friends` on open (live list). Checklist of friends w/ avatar + name, `max-h-80 overflow-y-auto`, label wraps the checkbox for full-row tap target.
- Selection counter: `{n} selected`.
- Actions: `Cancel` (ghost) · `Send invites` (brand, disabled until ≥1 checked).
- On success: server returns `{ sent: number, dropped: number }`. Toast reads:
  - `dropped === 0` → "Invites sent to {sent} friend{s}."
  - `dropped > 0` → "Sent to {sent} of {sent+dropped} friends." (Silent-drop covers unfriended-between-fetch-and-send; user learns their state is stale without a hard error.)
- Empty (no friends): checklist replaced with "Add friends first" state linking to `/friends?tab=add`.

Rate-limit copy on the 429: "You're inviting a lot of people right now. Try again in a bit."

---

## 7. Missing primitives (frontend agent authors)

- `components/ui/avatar.tsx` — thin wrapper around Base UI's `AvatarPrimitive` (`@base-ui-components/react/avatar`) following the project's `data-slot` pattern. Props: `{ user: { name?: string | null; image?: string | null }, size?: number, className?: string }`. Renders `<img>` when `user.image` is present, else a `<div>` monogram with initial (first letter of name, uppercase; "?" if no name). Deterministic background derived from a hash of `user.id` mapped to a small palette of muted tints (5 colors, no brand orange). Falls back to `<div>` on `<img>` load failure via Base UI's built-in error state.
- `components/ui/tabs.tsx` — wrapper around `@base-ui-components/react/tabs`. `TabsRoot`, `TabsList`, `TabsTab`, `TabsPanel` re-exports with tokens applied. Underline indicator handled by the styling.

Both follow the same shape as `components/ui/dropdown-menu.tsx` from iter 8. If Base UI does not ship an `Avatar` primitive, write the fallback logic inline in the wrapper — no external dep.

---

## 8. `UserMenu` — pending-request badge + Friends link

**Badge on trigger avatar** (in `components/main/user-menu.tsx`):

```
<button className="relative ...">
  <Avatar user={session.user} size={32} />
  {pendingFriendRequests > 0 && (
    <span
      aria-label={`${pendingFriendRequests} pending friend request${pendingFriendRequests === 1 ? "" : "s"}`}
      className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-background"
    />
  )}
</button>
```

Solid dot (no number) — the count is on the tab inside `/friends`. This keeps the header quiet.

**Popover contents** — new "Friends" link above "Settings":

```
<PopoverLink href="/friends">
  <UsersIcon className="h-4 w-4" />
  Friends
  {pendingFriendRequests > 0 && (
    <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-[11px]">
      {pendingFriendRequests}
    </Badge>
  )}
</PopoverLink>
```

`pendingFriendRequests` comes from `EventStateProvider` (extended per the plan file). Not shown when 0.

---

## 9. Public share page — `/e/[id]`

**Route:** `app/(public)/events/[id]/page.tsx` (new `(public)` group; no auth). Middleware matcher must exclude `/e/` — frontend agent updates `middleware.ts`.

**URL shape:** the shareable URL is `${origin}/e/${eventId}`. Yes, `/e/` and `/events/` both work — a `rewrites` entry in `next.config.ts` maps `/e/:id` → `/events/:id`. Short URL for share, long URL for the actual page. The Share button in the details panel writes the short form to clipboard.

**Active event layout** (mobile-first, `max-w-2xl mx-auto px-4 py-8`):

```
<div className="min-h-dvh flex flex-col">
  <header className="border-b border-border">
    <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
      <Link href="/" className="font-semibold">Event Atlas</Link>
      <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
    </div>
  </header>

  <main className="max-w-2xl mx-auto px-4 py-8 flex-1">
    <div className="aspect-[16/9] overflow-hidden rounded-lg bg-muted">
      <Image src={event.imageUrl} alt={event.title} width={800} height={450} className="w-full h-full object-cover" />
    </div>

    <span className="mt-6 inline-flex text-xs font-medium uppercase tracking-wide text-brand">
      {categoryLabel(event.category)}
    </span>

    <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight">{event.title}</h1>

    <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
      <div><dt className="text-muted-foreground">When</dt><dd>{formatFullDate(event.startTime)}</dd></div>
      <div><dt className="text-muted-foreground">Where</dt><dd>{event.venue}</dd></div>
      <div><dt className="text-muted-foreground">Price</dt><dd>{priceLabel(event)}</dd></div>
      {event.performerName && <div><dt className="text-muted-foreground">Performer</dt><dd>{event.performerName}</dd></div>}
    </dl>

    {event.description && (
      <p className="mt-6 text-sm text-foreground/80 whitespace-pre-line">{event.description}</p>
    )}

    <div className="mt-8 flex flex-col sm:flex-row gap-3">
      <Button asChild variant="brand" size="lg" className="flex-1">
        <a href={primarySource.ticketUrl} target="_blank" rel="noopener noreferrer">
          Get tickets <ExternalLinkIcon className="ml-2 h-4 w-4" />
        </a>
      </Button>
    </div>

    <div className="mt-10 rounded-lg border border-border bg-muted/40 p-5 text-center">
      <p className="text-sm font-medium">Never miss an event.</p>
      <p className="mt-1 text-xs text-muted-foreground">Sign up for reminders 24 hours before and see what your friends are going to.</p>
      <Button asChild size="sm" variant="outline" className="mt-4">
        <Link href="/signup">Try Event Atlas free</Link>
      </Button>
    </div>
  </main>
</div>
```

**Expired/inactive layout:**

```
<main className="max-w-md mx-auto px-4 py-16 text-center">
  <ClockIcon className="mx-auto h-10 w-10 text-muted-foreground" />
  <h1 className="mt-4 text-2xl font-semibold">This event has ended.</h1>
  <Button asChild variant="brand" size="sm" className="mt-6">
    <Link href="/feed">Discover events</Link>
  </Button>
</main>
```

Same header. `notFound()` for a genuinely missing id (Event doesn't exist), producing the standard 404 page.

**Metadata:**
```ts
export async function generateMetadata({ params }): Promise<Metadata> {
  const { id } = await params;
  const event = await getShareEvent(id); // isActive-agnostic — even ended events need metadata for link previews
  if (!event) return { title: "Event Atlas", robots: { index: false } };
  return {
    title: `${event.title} — Event Atlas`,
    description: event.description?.slice(0, 160) ?? `${event.title} on ${formatFullDate(event.startTime)}`,
    openGraph: {
      title: event.title,
      description: event.description?.slice(0, 160) ?? "",
      images: event.imageUrl ? [event.imageUrl] : [],
      type: "website",
    },
    robots: { index: false, follow: true }, // noindex for now — see §12
  };
}
```

Runtime dynamic (no `force-static`) because `isActive` toggles at cron time and we must show the expired state promptly.

---

## 10. Motion

- Tab underline: `translate + width` transition, `200ms ease-out`. Respects `prefers-reduced-motion` (falls back to instant swap).
- Row hover: `bg` transition `150ms ease-out`.
- Row remove (unfriend / decline): `opacity → 0, translate-x → -8px, height → 0` sequenced over `220ms`. Framer-motion NOT introduced for this — use plain CSS `transition` on a wrapper `div` with inline height measurement or the simpler approach of `router.refresh()` and letting SSR redraw. The frontend agent picks; the simpler path is preferred.
- Save/Going pulse from iter 8 is unchanged. No new keyframes here.

---

## 11. Anti-enumeration rules (locked)

The Add tab MUST NOT reveal whether an email is registered, has a pending request, is already a friend, or blocked. All four cases return the same success alert copy. This mirrors iter 3's signup and iter 4's forgot-password treatment; rate-limit response body is byte-identical to the success body (only status differs, which is unavoidable) and the client renders the same alert on any 2xx or 429.

Server never varies the response body between "unknown email" and "sent successfully." Timing risk is bounded by rate limit (5/hour per email:sender tuple, 30/hour per sender fallback) — good enough for v1; not attempting constant-time equality here.

---

## 12. Accessibility notes

- Tabs are a proper `<TabList>` with roving tabindex; content panels have `role="tabpanel"` and `aria-labelledby` linked to the tab. Base UI handles the wiring — the wrapper just applies tokens.
- Avatars: `alt` = the user's display name for informative avatars (Friends list, Requests list). `alt=""` for the overlapping avatar stack in the "Friends going" section because the names are read as text right next to it (avoids doubled announcement).
- Pending-badge dot: `aria-label` on the parent button reads "N pending friend requests". The visual dot itself has `aria-hidden="true"` (implicit via `<span>` with no text).
- Empty-state italics: Instrument Serif on "your" does NOT change screen-reader output — SR reads "your" identically. Purely visual.
- Focus order on Requests tab: Avatar (not focusable — just visual) → name link (not linked in v1, so just text) → Accept → Decline. Then Sent section → Cancel per row. All in visual order.
- Public share page: skip-link at the top (reuses `SkipLink` from `(auth)` — hoist to `components/skip-link.tsx` if not already there).
- All destructive actions (Remove friend, Decline, Cancel request) trigger via Enter/Space on the ghost button; Remove additionally requires the Dialog confirmation.
- `robots: { index: false }` on the public share page in v1 because we haven't decided whether search indexing is desirable and premature indexing of soft-deleted events would erode SEO trust. Explicit product decision to revisit before v2.

---

## 13. Data flow contracts (client ↔ server)

- `EventStateProvider` (extended in iter 9): now exposes `{ savedIds: string[], goingIds: string[], isPro: boolean, pendingFriendRequests: number }`. UserMenu and the Requests-tab badge count both read from this single source (avoids double-fetch).
- `/friends` page: SSR fetches Friends + IncomingRequests + OutgoingRequests + Activity(first page) in one composed server call; passes to client tabs as initial data. Client tab components refetch only when a mutation happens (Accept/Decline/Cancel/Remove/SendRequest).
- `EventDetailsPanel`: `friendsGoing` is fetched client-side when the panel opens (skips fetch if the user has zero friends per `EventStateProvider` — treats 0-friends as an implicit "no fetch needed"). If we don't know friend count client-side, always fetch — the query is cheap. Frontend agent picks.
- `InviteFriendsDialog`: fetches `/api/friends` on open (fresh list); does not rely on any global cache.

---

## 14. What's NOT in this iteration

- Profile pages for friends (iter 10 `/profile` tabs).
- Block/report/mute controls.
- Search friends by name — email only (per plan §12 non-goals; prevents scraping).
- Push notifications for new requests / accepted requests.
- Invite non-users (would require an unauthenticated invite landing page — v2).
- Persistent `EventInvite` records — invites are email-only.
- SEO indexing of `/e/[id]` — explicit `noindex` for v1.
- Full Pro upsell modal — free-tier "Invite friends" and Activity use inline disabled/upsell placeholders; iter 10 or the Stripe-landing iteration builds the shared upsell modal.
- Deep-linked `/feed?event=<id>` — still aspirational from iter 8; Activity links to it optimistically.
