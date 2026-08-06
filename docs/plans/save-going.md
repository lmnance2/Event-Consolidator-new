# Save + Going + Calendar + Reminder — Iteration 8 Design Plan

Scope: EventCard Save/Going toggles, EventDetailsPanel footer refresh, SaveLimitDialog, reminder email template. Design decisions are locked here; the frontend and sync agents build against this file. No em dashes anywhere. Light mode only.

Stackable with iteration 7 (`feed.md`) — inherits the "orange in exactly three places" commitment and the product-first flat register. The reminder email is the only surface in this iteration that lives in the **brand** register, so it gets slightly warmer treatment.

---

## 1. EventCard — Save + Going toggles

**Placement:** top-right corner of the image area, two individual round buttons, not a pill container. `absolute top-2 right-2 z-20`, `flex gap-1.5`.

**Structure per button:**
```
<button
  className="h-9 w-9 grid place-items-center rounded-full
             bg-background text-foreground/70 shadow-sm
             border border-border/60
             hover:text-foreground hover:border-border-strong
             active:scale-90
             transition [transition-duration:160ms] ease-out
             focus-visible:outline-none focus-visible:ring-2
             focus-visible:ring-brand focus-visible:ring-offset-2
             data-[pressed=true]:{state styles per icon below}"
  aria-pressed={pressed}
  aria-label={label}
  onClick={(e) => { e.preventDefault(); toggle(); }}>
  <Icon className="h-4 w-4" />
</button>
```

Solid `bg-background` (not blurred, not translucent — glassmorphism is banned). Shadow + subtle border provide contrast over any hero image without visual noise. Tap area 36×36 visual + 4px effective outside padding via the parent gap is comfortably above the 44px effective target when combined with the `focus-visible` ring extension.

### State styling per toggle

**Save (Heart, brand-active per feed.md commitment):**
| State | Icon fill | bg | border |
|---|---|---|---|
| Resting | `text-foreground/70`, outline stroke | `bg-background` | `border-border/60` |
| Hover | `text-foreground` | `bg-background` | `border-border-strong` |
| Pressed (saved) | `text-brand`, `fill-brand` | `bg-brand/8` | `border-brand/40` |
| Loading | replaced with `Loader2 animate-spin`, button `pointer-events-none opacity-70` | | |

**Going (CalendarCheck, neutral-active to avoid diluting orange):**
| State | Icon | bg | border |
|---|---|---|---|
| Resting | `text-foreground/70` | `bg-background` | `border-border/60` |
| Hover | `text-foreground` | `bg-background` | `border-border-strong` |
| Pressed (going) | `text-foreground` | `bg-foreground/5` | `border-foreground/25` |
| Loading | `Loader2 animate-spin`, `pointer-events-none opacity-70` | | |

**Why the asymmetry:** feed.md commits orange to Save (the bookmark-for-later signal) and Get Tickets. Going on the card gets neutral emphasis so orange stays scarce. The panel earns brand emphasis for Going once (see §2).

### Save-success pulse

On successful save (not unsave, not on error), the heart icon plays a single `scale(1) → 1.15 → 1` keyframe over 200ms `ease-out`. Uses CSS keyframe, triggered by adding a `data-just-saved` attribute for 200ms then removing.

```css
@keyframes save-pulse {
  0% { transform: scale(1); }
  40% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
[data-just-saved="true"] > svg {
  animation: save-pulse 200ms ease-out;
}
@media (prefers-reduced-motion: reduce) {
  [data-just-saved="true"] > svg { animation: none; }
}
```

No pulse on unsave; asymmetric feedback signals "you just did something worth remembering."

### Anti-clobber with iter 7's full-card overlay

**Fix the underlying overlay first.** The current `<button className="absolute inset-0 z-10">` in `components/feed/event-card.tsx:87` produces invalid nested-interactive HTML once we add two child buttons inside the same `<article>`. Frontend agent must convert the overlay to a `<Link>` (Next.js) with the same absolute positioning. Buttons nested inside a Link is valid HTML.

```
<article>
  {/* image + text content unchanged */}
  <div className="absolute top-2 right-2 z-20 flex gap-1.5">
    <SaveToggle ... />
    <GoingToggle ... />
  </div>
  <Link
    href={`/feed?event=${event.id}`}
    scroll={false}
    className="absolute inset-0 z-10"
    aria-label={`View details for ${event.title}`}
    onClick={(e) => { e.preventDefault(); onOpen(event.id); }}
  />
</article>
```

Toggles use `e.preventDefault()` on click; since they're not inside the link element (both are siblings under the article, toggles at z-20, link at z-10), click routing happens by z-order and no `stopPropagation` gymnastics are needed. `aria-pressed` on the toggles gives screen readers correct state.

---

## 2. EventDetailsPanel — footer refresh

The panel is where the user commits. Get Tickets stays the earned full-width primary. Save + Going + Calendar are secondary chips above it. Panel is right-drawer `sm:max-w-lg` (512px, 464px usable inside 24px padding).

### Layout

```
<div className="absolute inset-x-0 bottom-0 border-t border-border
                bg-background/95 px-6 py-4 space-y-3">

  {/* Row 1: three secondary actions */}
  <div className="flex items-center gap-2">
    <PanelToggle
      variant="save"
      pressed={saved}
      onClick={toggleSave}
    />
    <PanelToggle
      variant="going"
      pressed={going}
      onClick={toggleGoing}
    />
    <AddToCalendarMenu event={event} />
  </div>

  {/* Row 2: primary CTA, full-width */}
  <a
    href={event.ticketUrl}
    target="_blank" rel="noopener noreferrer"
    className={cn(buttonVariants({ variant: "brand", size: "lg" }), "w-full")}>
    Get Tickets
  </a>
</div>
```

### `PanelToggle` component

Outlined chip at rest, brand-filled when active — this is where Going *does* get brand emphasis (unlike the card). One panel is open at a time, so orange concentration stays low overall.

| Variant / State | Label | Icon | Class overrides |
|---|---|---|---|
| Save resting | "Save" | `Heart` outline | `variant="outline" size="sm"` |
| Save pressed | "Saved" | `Heart` filled | `variant="brand" size="sm"` |
| Going resting | "Going" | `CalendarCheck` outline | `variant="outline" size="sm"` |
| Going pressed | "Going" (unchanged) | `CalendarCheck` filled | `variant="brand" size="sm"` |

`aria-pressed`, `data-just-saved` pulse on Save success (same 200ms keyframe as card).

Copy note: Save flips to "Saved" (state confirmation). Going stays "Going" in both states (already reads as a claim; toggling changes the visual weight, not the label — "Going" as an active state is more decisive than "Attending").

### `AddToCalendarMenu`

Base UI DropdownMenu triggered by an outline button.

```
<DropdownMenu.Root>
  <DropdownMenu.Trigger asChild>
    <Button variant="outline" size="sm">
      <CalendarPlus className="h-4 w-4" />
      <span>Add to calendar</span>
    </Button>
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="end" className="w-56">
    <DropdownMenu.Item onSelect={openGoogleCalendar}>Google Calendar</DropdownMenu.Item>
    <DropdownMenu.Item onSelect={openAppleCalendar}>Apple Calendar</DropdownMenu.Item>
    <DropdownMenu.Separator />
    <DropdownMenu.Item onSelect={downloadIcs}>Download .ics</DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>
```

- `openGoogleCalendar`: `window.open(googleCalendarUrl(event), "_blank", "noopener")`
- `openAppleCalendar`: same, using the `webcal:` scheme URL builder — falls back to `.ics` download if the browser can't handle `webcal:`
- `downloadIcs`: `window.location.href = `/api/events/${event.id}/ics`` — server sets `Content-Disposition: attachment`

### Layout math at 400px width

At narrowest panel (mobile portrait), row 1 width is ~352px:
- `Save` chip: ~76px
- `Going` chip: ~82px
- `Add to calendar`: ~168px
- gaps: 2 × 8px = 16px
- Total: **342px** → fits with 10px slack.

At 320px (below the smallest supported), truncate `Add to calendar` to `Calendar` (150px total) before wrapping.

### Motion

- Toggle press: 160ms `ease-out` on colors + `active:scale-95`
- Save pulse: same 200ms keyframe as the card
- DropdownMenu open: rely on Base UI's default 150ms fade
- All motion respects `prefers-reduced-motion`

---

## 3. SaveLimitDialog

Fires when a free user tries to save a 6th event. Not a paywall. State-of-affairs, brief.

### Structure

```
<Dialog.Root open={open} onOpenChange={setOpen}>
  <Dialog.Content className="max-w-md">
    <Dialog.Header>
      <div className="flex h-10 w-10 items-center justify-center
                      rounded-full bg-brand-soft mb-3">
        <Bookmark className="h-5 w-5 text-brand" />
      </div>
      <Dialog.Title className="text-xl font-semibold tracking-tight">
        Five saves is the free plan's limit
      </Dialog.Title>
      <Dialog.Description className="text-sm text-muted-foreground leading-relaxed">
        Unsave one to bookmark a new event. Unlimited saves ship with Pro.
      </Dialog.Description>
    </Dialog.Header>

    <div className="rounded-lg border border-border bg-muted/50 px-4 py-3
                    flex items-center justify-between text-sm">
      <span className="text-muted-foreground">Saved</span>
      <span className="tabular-nums font-medium">5 / 5</span>
    </div>

    <Dialog.Footer className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button variant="ghost" size="sm" disabled>
        Pro upgrade, coming soon
      </Button>
      <Button variant="brand" size="sm" onClick={() => setOpen(false)}>
        Got it
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
```

### Copy (locked, exact)

| Element | Copy |
|---|---|
| Title | Five saves is the free plan's limit |
| Description | Unsave one to bookmark a new event. Unlimited saves ship with Pro. |
| Chip left | Saved |
| Chip right | 5 / 5 |
| Primary button | Got it |
| Secondary button | Pro upgrade, coming soon |

No em dashes (impeccable ban). No "reached your limit!" tone. The secondary button is disabled and communicates future availability via its label alone (no separate "Coming soon" badge — the label is the badge).

### Where to fire it

Two triggers, both client-side:
1. **Optimistic pre-check**: card `SaveToggle.onClick` reads `savedIds.size` from context; if 5 and event not already saved, open dialog and skip the network call.
2. **Server-authoritative**: if the server returns `409 { error: "SAVE_LIMIT_REACHED" }` (which happens under the TOCTOU race), the toggle's error handler opens the dialog. The optimistic UI reverts the heart fill without a toast.

Dialog state is component-local (`useState`), not context. Only one dialog can be open at a time.

---

## 4. Reminder email template

Register: **brand**. Warmer than the app but restrained (no drenched color, no gradients, no images). Table-based markup for email client compatibility (Outlook 2016 desktop still needs it).

### File

`lib/email/templates/reminder.tsx` — React component that returns JSX; Resend renders to HTML.

### Props

```ts
interface ReminderEmailProps {
  userName: string | null;          // may be null for legacy accounts; email falls back to "there"
  eventTitle: string;
  eventDate: string;                // pre-formatted "Friday, July 18"
  eventTime: string;                // pre-formatted "8:00 PM"
  venueName: string;
  eventUrl: string;                 // deep link back to /feed?event={id}
  ticketUrl: string;                // provider ticket link
  unsubscribeUrl: string;           // stub for now
}
```

Server pre-formats `eventDate` and `eventTime` using `toLocaleString(...)` with the same fixed `en-US` locale + UTC time zone as the feed (matches existing hydration policy). No client-side timezone conversion in email.

### Subject line and preheader

```
Subject:    Coming up: {eventTitle}
Preheader:  {eventDate} at {eventTime} · {venueName}
```

**"Coming up:" not "Tomorrow:"** — the cron fires 24h before start, which crosses date boundaries for evening events; "Tomorrow" would be wrong in ~1/3 of cases. "Coming up" is always true.

### Colors (inline hex; email clients drop oklch)

| Role | Hex | Notes |
|---|---|---|
| Brand | `#c96b2c` | approx `oklch(0.54 0.18 39)` |
| Foreground | `#2a1e15` | approx `oklch(0.16 0.008 41)` |
| Muted | `#8a7867` | approx `oklch(0.52 0.012 41)` |
| Border | `#e7ded4` | approx `oklch(0.918 0.006 41)` |
| Page bg | `#fafafa` | |
| Card bg | `#ffffff` | |
| Footer bg | `#faf6f0` | warm tint |

### Markup (skeleton — frontend agent implements final JSX)

```
<html>
<body style="margin:0;padding:0;background:#fafafa;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',
             Roboto,Helvetica,Arial,sans-serif;color:#2a1e15">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center" style="padding:32px 16px">

      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"
             style="max-width:560px;background:#ffffff;border:1px solid #e7ded4;
                    border-radius:16px;overflow:hidden">

        {/* Brand accent line */}
        <tr><td style="height:4px;background:#c96b2c;line-height:4px;font-size:4px">&nbsp;</td></tr>

        {/* Wordmark eyebrow */}
        <tr><td style="padding:24px 32px 0">
          <span style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;
                       color:#8a7867;font-weight:600">Event Atlas</span>
        </td></tr>

        {/* Context eyebrow */}
        <tr><td style="padding:20px 32px 8px">
          <span style="font-size:13px;color:#8a7867">Coming up in 24 hours</span>
        </td></tr>

        {/* Event title */}
        <tr><td style="padding:0 32px 12px">
          <h1 style="margin:0;font-size:24px;line-height:1.25;font-weight:600;
                     letter-spacing:-0.01em">{eventTitle}</h1>
        </td></tr>

        {/* Facts strip */}
        <tr><td style="padding:0 32px 24px">
          <p style="margin:0;font-size:14px;line-height:1.5;color:#4a3d31">
            {eventDate} · {eventTime}<br />
            {venueName}
          </p>
        </td></tr>

        {/* Primary CTA: View event details */}
        <tr><td style="padding:0 32px 12px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="background:#c96b2c;border-radius:8px">
              <a href="{eventUrl}"
                 style="display:inline-block;padding:12px 20px;font-size:14px;
                        font-weight:500;color:#ffffff;text-decoration:none">
                View event details
              </a>
            </td></tr>
          </table>
        </td></tr>

        {/* Secondary link: Get tickets on provider */}
        <tr><td style="padding:0 32px 32px">
          <a href="{ticketUrl}"
             style="font-size:13px;color:#8a7867;text-decoration:underline">
            Get tickets on the provider site
          </a>
        </td></tr>

        {/* Footer */}
        <tr><td style="padding:20px 32px;border-top:1px solid #f0e8dd;background:#faf6f0">
          <p style="margin:0;font-size:12px;line-height:1.5;color:#8a7867">
            You're getting this because you marked "Going" on Event Atlas.<br />
            <a href="{unsubscribeUrl}"
               style="color:#8a7867;text-decoration:underline">
              Unsubscribe from reminders
            </a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
```

### Copy (locked, exact)

| Element | Copy |
|---|---|
| Subject | `Coming up: {eventTitle}` |
| Preheader | `{eventDate} at {eventTime} · {venueName}` |
| Wordmark | `Event Atlas` |
| Eyebrow | `Coming up in 24 hours` |
| Facts strip | `{eventDate} · {eventTime}` newline `{venueName}` |
| Primary CTA | `View event details` |
| Secondary link | `Get tickets on the provider site` |
| Footer disclosure | `You're getting this because you marked "Going" on Event Atlas.` |
| Unsubscribe link | `Unsubscribe from reminders` |

### CTA priority rationale

Primary is **View event details** (deep-link into `/feed?event={id}`) not **Get tickets**. A reminder's job is "remember and plan," not "convert." Sending users into the app improves return-visit metrics and lets them re-check details, use the calendar dropdown, or hit Get Tickets from there. Provider ticket link remains as an easy secondary jump for the "I already know I need tickets" flow.

### Unsubscribe stub

For iteration 8, `unsubscribeUrl` points to a static `/settings#notifications` (route exists; anchor doesn't do anything yet). Real unsubscribe route is out of scope but the link is present for CAN-SPAM formality and to reserve the visual space. Note this in `iterations.md` as a follow-up.

---

## Empty and loading states

**Card (uninitialized):** while `EventStateContext` is still fetching `/api/users/me/event-state`, both toggles render in resting state (unpressed) with `pointer-events-none opacity-70`. Prevents flash-of-wrong-state.

**Panel (uninitialized):** same — Save/Going chips render resting, disabled, until context resolves.

**Toggle in-flight:** replace icon with `Loader2 animate-spin`, `pointer-events-none opacity-70`. On success, replace back with new state icon (with pulse for save-success). On error, revert to previous state + generic toast (`sonner` or existing toast system if present; otherwise `console.error` and just revert visually).

**Dialog opening after 5th save:** dialog fades in per Base UI default (150ms). No slide, no scale.

---

## Frontend agent handoff notes

1. Convert the invisible card overlay `<button>` to `<Link>` (fixes nested-interactive HTML per F8).
2. Install `dropdown-menu` shadcn primitive: `pnpm dlx shadcn@latest add dropdown-menu`. Verify `Button` `brand` variant survives the install (iter 5 lesson) — if lost, re-add per iter 4's pattern.
3. Reuse Lucide icons already in the project: `Heart`, `CalendarCheck`, `CalendarPlus`, `Bookmark`, `Loader2`. If any aren't imported yet, they're all in `lucide-react` (already a dep).
4. Context provider mount site: `app/(main)/layout.tsx` — wraps children so both `/feed` and `/settings` inherit it (settings doesn't use it but wrapping the shared shell is cheaper than route-specific mounting).
5. Panel focus management: when Save/Going/Calendar rows render, the panel's initial focus target (per Base UI Sheet defaults) should not shift to a new element on toggle — keep initial focus on the close button as today.

## Sync agent handoff notes

1. Email template imports React from the project's existing setup (see `password-reset.tsx` for pattern).
2. Do NOT compute `eventDate` / `eventTime` inside the template — pre-format in the cron handler and pass as props. Rationale: template stays pure and easy to preview; formatting logic centralizes with the send-decision code.
3. Subject line uses **Coming up:** prefix, not **Tomorrow:** (see F6).
4. Structured log on send: `console.log(JSON.stringify({ event: "reminder.sent", reminderId, userId, eventId, at: new Date().toISOString() }))` — matches the sync pipeline's log shape.

---

## Motion inventory

| Interaction | Property | Duration | Easing |
|---|---|---|---|
| Toggle color change | `background-color`, `color`, `border-color` | 160ms | `ease-out` |
| Toggle press | `transform: scale(0.95)` | 160ms | `ease-out` |
| Save success pulse | `transform: scale(1) → 1.15 → 1` | 200ms | `ease-out` |
| Toggle hover | `transform: scale(1.05)` on icon | 160ms | `ease-out` |
| Dialog open | Base UI default | 150ms | Base UI default |
| DropdownMenu open | Base UI default | 150ms | Base UI default |
| Focus ring | (no transition, snap in) | | |

All animations respect `prefers-reduced-motion: reduce` via a single global rule already present in `globals.css` or added if missing.

---

## Absolute don'ts, for the frontend agent's convenience

- No em dashes anywhere (in code, in copy, in comments). Use commas or colons.
- No `backdrop-blur` on any toggle or button. The card overlay does not blur. The panel footer's `bg-background/95` is the only translucency in this iteration.
- No gradient text.
- No side-stripe borders (`border-l-4` etc.) as accents.
- No "!" in copy.
- Save and Going are the ONLY two toggles added. Don't add a "share" button or "notify me" button opportunistically.
- Card gets orange only on Save-active. Going on the card is neutral-active. This isn't negotiable.
