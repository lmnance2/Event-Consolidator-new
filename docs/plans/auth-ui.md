# Auth UI — Iteration 4 Design Plan

Scope: landing `/` + `/login` + `/signup` + `/onboarding/zip` + polished `/verify-email`, `/forgot-password`, `/reset-password`. Server plumbing already exists (iteration 3) — this is UI only.

---

## Design direction

**Register split:** landing = **brand** (design IS the first impression); auth cards = **product** (design SERVES the flow). Different commitment levels for each — landing gets one bolder move, auth stays restrained.

**Style:** Warm-neutral base, one warm accent (discovery orange), Geist Sans as the primary type, and **one italic serif word in the hero + one in the feature-grid title** as the deliberate signature move. That single serif accent is the whole visual differentiator; use it exactly twice on the landing and nowhere else. Precise 1px borders, restrained motion (150–250ms), no gradients, no glassmorphism as decoration.

**One signature landing visual:** a live-feeling product preview in the hero right column — a vertical stack of three realistic event cards (concert, meetup, theater) with a horizontal filter-chip strip pinned above ("Music · This weekend · < 10mi"). This is a shrunken slice of the real `/feed`. Not abstract floating cards. It ties the hero image to the product's core insight (personalized + nearby) and cannot be guessed from the category alone.

**Positioning cue for copy:** Event Atlas is a *discovery* platform, not a ticketing platform. Copy leans "find" and "one feed," not "buy tickets."

**Light mode default.** Dark mode tokens exist in globals.css and should not regress, but only light mode is designed here. Dark mode polish is deferred.

---

## Token additions and edits

Neutrals are currently pure gray (`chroma 0`). Tint them slightly toward the brand hue for cohesion — non-invasive but the whole surface starts feeling like one object. Overwrite these in `:root`:

```css
:root {
  --background: oklch(0.995 0.003 60);   /* was oklch(1 0 0) — warm off-white */
  --foreground: oklch(0.16 0.008 41);    /* was oklch(0.145 0 0) */
  --card: oklch(1 0 0);                  /* keep pure white for card lift */
  --muted: oklch(0.965 0.006 60);
  --muted-foreground: oklch(0.52 0.012 41);
  --border: oklch(0.918 0.006 41);
  --input: oklch(0.918 0.006 41);
}
```

Add the brand tokens. Store the ring color solid (no alpha) so Tailwind's opacity modifiers stack cleanly:

```css
/* Corrected after iteration-4 review: prior oklch(0.66 0.19 41) measured 3.36:1
   on white, not 4.6:1. Deepened for real WCAG AA compliance. Frontend agent must
   re-verify with a contrast checker after applying. */
:root {
  --brand: oklch(0.54 0.18 39);            /* target: ≥4.5:1 on white */
  --brand-hover: oklch(0.60 0.17 39);
  --brand-active: oklch(0.48 0.19 39);
  --brand-foreground: oklch(0.99 0 0);
  --brand-soft: oklch(0.97 0.03 41);
}

.dark {
  --brand: oklch(0.70 0.17 41);
  --brand-hover: oklch(0.76 0.15 41);
  --brand-active: oklch(0.64 0.19 41);
  --brand-foreground: oklch(0.145 0 0);
  --brand-soft: oklch(0.24 0.04 41);
}

@theme inline {
  --color-brand: var(--brand);
  --color-brand-hover: var(--brand-hover);
  --color-brand-active: var(--brand-active);
  --color-brand-foreground: var(--brand-foreground);
  --color-brand-soft: var(--brand-soft);
}
```

Focus ring on the brand button uses the standard `--ring` scale mixed with alpha at the use site: `focus-visible:ring-brand/40 focus-visible:border-brand`. Never bake alpha into the token.

**Reasoning:** Warm orange signals energy/discovery without being aggressive; sits opposite the tinted neutral UI, contrasts cleanly on white, and reads as intentional rather than "SaaS blue." Brand is used sparingly on auth (primary CTA + focus ring only) and more assertively on landing (hero eyebrow dot, one accent word, one bloom, primary CTAs).

---

## Typography

**Geist Sans everywhere** (already loaded in `app/layout.tsx`) **plus one italic serif — Instrument Serif** — used exactly twice on the landing and nowhere else. Add via `next/font/google` next to Geist:

```ts
// app/layout.tsx
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";

const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
  style: "italic",
});
// body className adds instrumentSerif.variable alongside geistSans.variable
```

Register in `@theme inline`:
```css
--font-serif: var(--font-serif);
```

**Where the serif italic is used (exactly twice, do not spread further):**
1. Hero headline — the word `actually`: `<span className="font-serif italic font-normal text-brand">actually</span>`
2. FeatureGrid section title — the word `find`: `<span className="font-serif italic font-normal">find</span>` (no brand color, keep neutral)

Anywhere else, this is a violation of the plan.

**Hero headline treatment (single hero H1):**
- Class: `text-[clamp(2.75rem,7vw,5rem)] font-bold tracking-[-0.035em] leading-[1.02]`
- Font weight 800 (`font-extrabold`) on desktop, 700 (`font-bold`) below 640px for legibility
- Never uppercased, never gradient-clipped

Type scale (Tailwind classes → intent):
- Hero H1 — see above
- `text-3xl md:text-4xl tracking-tight` — auth card titles, section H2s
- `text-lg md:text-xl` — hero sub, feature card titles
- `text-base leading-relaxed` — body (16px, line-height 1.6)
- `text-sm` — labels, helper text, footer legal
- `text-xs uppercase tracking-widest` — small eyebrows only

Weight discipline: 800 for hero H1, 700 for other H1/H2, 600 for card titles, 500 for labels/buttons, 400 for body. Do not mix 500/600 buttons randomly.

---

## Motion tokens

- Micro: 150ms `ease-out` — hover, focus ring appear, color shifts
- Small: 200ms `ease-out` — button press scale (0.98), input border transitions
- Medium: 300ms `cubic-bezier(0.16, 1, 0.3, 1)` — card lift on landing, entering hero visual

**Respect `prefers-reduced-motion`:** wrap non-essential animations in `motion-safe:` variants (Tailwind ships this).

---

## Shadcn primitives to install

Run before implementation:

```bash
pnpm dlx shadcn@latest add input label card separator alert
```

Do **not** install `form` (react-hook-form + zod is enough without shadcn's Form wrapper — the wrapper adds provider ceremony we don't need for 3 forms).

Do **not** install checkbox — no "remember me" in the current auth spec; session is 7d already.

---

## Directory additions

```
/app
  page.tsx                        # rewrite — landing
  (auth)/
    layout.tsx                    # shared auth shell (centered card, brand top-bar, gradient bg)
    login/page.tsx
    signup/page.tsx
  onboarding/zip/page.tsx         # rewrite — visual polish
  verify-email/page.tsx           # rewrite — visual polish
  forgot-password/page.tsx        # rewrite — visual polish
  reset-password/page.tsx         # rewrite — visual polish

/components
  brand/
    logo.tsx                      # wordmark + mark (SVG)
    google-icon.tsx               # SVG (lucide has no Google logo)
  landing/
    hero.tsx
    trust-strip.tsx
    feature-grid.tsx
    final-cta.tsx
    marquee-events.tsx            # animated event-card carousel visual
  auth/
    auth-card.tsx                 # shared card shell used by login/signup
    google-button.tsx             # renders Google icon + "Continue with Google"
    password-field.tsx            # password input with show/hide + strength dots (signup)
    form-error.tsx                # Alert-style inline error banner
    field.tsx                     # <Label> + <Input> + helper/error wrapper
```

**Note:** The `(auth)` route group already exists as a naming convention in `SYSTEM_ARCHITECTURE.md § Directory Structure`. Move `/login` and `/signup` into `app/(auth)/` so they share the shell layout.

---

## Screen 1 — Landing `/`

**Layout goal:** feel alive without shouting. Above-the-fold should communicate *what* + *why* + *one CTA* within 3 seconds.

**Component tree:**

```
<main>
  <SiteHeader />                             ← sticky, translucent-on-scroll
  <Hero />
  <TrustStrip />                             ← Ticketmaster / Eventbrite / Meetup
  <FeatureGrid />                            ← 3 columns
  <FinalCTA />
  <SiteFooter />
</main>
```

### SiteHeader
- Position: `sticky top-0 z-40`
- Two states, driven by scrollY (use a small `useEffect` in a client subcomponent or the `intersection-observer` on a sentinel div — do not rely on CSS-only):
  - **Top state (scrollY ≤ 24):** `bg-transparent border-b border-transparent`
  - **Scrolled state (scrollY > 24):** `bg-background/85 backdrop-blur border-b border-border`
  - Transition between states: 200ms `ease-out` on background + border color only
- Left: `<Logo />` (wordmark)
- Right (desktop): `<Link href="/login">Log in</Link>` (ghost) + `<Button variant="brand" size="lg" asChild><Link href="/signup">Sign up free</Link></Button>`
- Right (mobile): single "Sign up" pill button; "Log in" collapses

### Hero
Container: `max-w-6xl mx-auto px-6 pt-20 pb-16 md:pt-32 md:pb-24`

Grid: `grid gap-12 md:gap-16 md:grid-cols-[1.1fr_1fr] items-center`

Left column:
- Eyebrow: `<span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">` — leading 6px `bg-brand` dot, then text: "Every event, one feed"
- Headline: `<h1 className="text-[clamp(2.75rem,7vw,5rem)] font-extrabold tracking-[-0.035em] leading-[1.02]">` — text: `Find the events you'd <span className="font-serif italic font-normal text-brand">actually</span> go to.` (this is the first of the two allowed serif-italic uses)
- Sub: `<p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">` — "Ticketmaster, Eventbrite, and Meetup in one feed. Filtered by what you like, sorted by what's nearby. Buy tickets on the source site."
- CTA row: `<div className="mt-8 flex flex-col sm:flex-row gap-3">`
  - Primary: `<Button variant="brand" size="lg" asChild><Link href="/signup">Sign up free</Link></Button>` — h-11, px-6, brand bg. No trailing arrow — the copy sells the click.
  - Secondary: `<Button variant="ghost" size="lg" asChild><Link href="/login">I have an account</Link></Button>`
- Micro-trust below CTAs: `<p className="mt-4 text-xs text-muted-foreground">Free account. Email or Google.</p>`

Right column: **FeedPreview** — the distinctive product-preview visual (not abstract cards).
- A miniaturized slice of the real `/feed` — teaches what the app looks like in one glance:
  1. Horizontal filter chip strip (top of the preview): three static chips — `Music`, `This weekend`, `< 10 mi`. Rounded-full, `border-border bg-card`, one chip (`Music`) shown in the selected/brand state (`bg-brand text-brand-foreground border-transparent`).
  2. Vertical stack of 3 event card rows below the chip strip, each showing thumbnail (colored placeholder rect, no image needed — use `bg-gradient-to-br` with two neutral tokens), title, date, distance chip, category pill, and a small heart save button.
  3. Sample content (invented but realistic):
     - "Chappell Roan · Fri Aug 8 · 3.2 mi · Music" — Save filled (brand)
     - "Sourdough Meetup at Tartine · Sat Aug 9 · 1.4 mi · Food & Drink" — Save unfilled
     - "Hamilton (matinee) · Sun Aug 10 · 5.1 mi · Arts & Theater" — Save unfilled
- Wrapper: `relative rounded-2xl border border-border bg-card p-4 shadow-[0_1px_0_var(--border),0_20px_60px_-30px_rgba(15,23,42,0.25)]` — a single restrained shadow, not stacked cards
- Ambient bloom **behind** the wrapper: an absolutely positioned `--brand-soft` radial `bg-[radial-gradient(60%_50%_at_70%_20%,var(--brand-soft),transparent_70%)]` in a `-z-10` layer
- Motion (motion-safe only): the selected chip subtly pulses via `animate-[pulse_3s_ease-in-out_infinite]` with brand ring — one subtle animation, nothing else moves. No card drift.
- Mobile (<768px): the preview appears **below** the hero copy (stacked layout), scaled at natural width. No visual regression, no tilts, no marquee.

### TrustStrip
`py-12 border-y border-border bg-muted/30`

- Label: `<p className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-6">Aggregating events from</p>`
- Row: `<div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">` — grayscale provider wordmarks (SVG, opacity-60 → hover opacity-100 transition). Three: Ticketmaster, Eventbrite, Meetup.
- No fake customer logos — providers only, because that is the truthful trust signal.

### FeatureGrid — three asymmetric blocks, not a copy-paste grid

`max-w-6xl mx-auto px-6 py-20 md:py-28`

Section eyebrow + title:
- Eyebrow: `<p className="text-sm font-medium text-brand mb-3">Built to help you find</p>`
- Title: `<h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.1] max-w-3xl">Not another place to <span className="font-serif italic font-normal">find</span> new hobbies.</h2>` (second and final serif-italic use)

Grid, asymmetric on desktop, single column on mobile:
```
mt-16 grid gap-6 grid-cols-1 md:grid-cols-[1.3fr_1fr_1fr]
```

The three blocks intentionally differ in visual density and detail so they don't read as a template repeat:

**Block 1, wider — "Three sites, one list":**
- Container: `rounded-2xl border border-border bg-card p-7 md:p-8`
- No top-left icon. Instead: a small horizontal row of three greyscale provider wordmarks at 60% opacity (Ticketmaster / Eventbrite / Meetup), an inline arrow glyph, then a small `[Feed]` chip in the brand state.
- Title (`mt-6 text-xl font-semibold`): "Ticketmaster + Eventbrite + Meetup, in one list"
- Body (`mt-2 text-sm text-muted-foreground leading-relaxed`): "The same concert on three sites shows up once. We match by title, time, and venue, then keep the earliest source's ticket link."

**Block 2, medium — "Filters that match you":**
- Container: `rounded-2xl border border-border bg-card p-6`
- Top: `<Sliders className="size-5 text-brand" />` icon in a 32×32 rounded-md `bg-brand-soft` square
- Title (`mt-5 text-lg font-semibold`): "Filters set once, not every scroll"
- Body (`mt-2 text-sm text-muted-foreground leading-relaxed`): "Pick your categories, distance, and price range in settings. The feed applies them every time."
- Bottom row (`mt-5 flex flex-wrap gap-1.5`): three small static filter chips as visual proof: `Music`, `< 10 mi`, `Free`. Same style as the FeedPreview chips but smaller (`text-[11px] px-2 py-0.5`).

**Block 3, narrower — "Show up on time":**
- Container: `rounded-2xl border border-border bg-card p-6`
- Top: `<Bell className="size-5 text-brand" />` icon in a 32×32 rounded-md `bg-brand-soft` square
- Title (`mt-5 text-lg font-semibold`): "Bookmark it. Get pinged."
- Body (`mt-2 text-sm text-muted-foreground leading-relaxed`): "Save up to five events on the free plan. Going gets you an email twenty-four hours before doors open. Tickets stay on the source."

Interaction states, all three: `transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_1px_0_var(--border),0_10px_30px_-15px_rgba(15,23,42,0.15)] hover:border-foreground/15`. Transform-only, no layout shift.

### FinalCTA
`max-w-4xl mx-auto px-6 py-24 text-center`

- `<h2 className="text-4xl md:text-5xl font-extrabold tracking-[-0.03em] leading-[1.05]">Stop scrolling four apps.</h2>`
- Sub: `<p className="mt-4 text-lg text-muted-foreground">One feed. Filtered by what you like. Free to start.</p>`
- CTA row: primary brand button `<Button variant="brand" size="lg" asChild><Link href="/signup">Sign up free</Link></Button>` + secondary ghost `<Button variant="ghost" size="lg" asChild><Link href="/login">Log in</Link></Button>`
- Container has a subtle `--brand-soft` radial bloom behind (`bg-[radial-gradient(50%_60%_at_50%_50%,var(--brand-soft),transparent_70%)]` in a `-z-10` layer)
- No third serif italic use here. This section leans on hierarchy alone.

### SiteFooter
- `py-10 border-t border-border`
- Left: `© {year} Event Atlas` in muted
- Right: no external links yet — just a `<Link href="/login">Log in</Link>` shortcut
- Keep intentionally minimal; footer is not a landing-page workhorse here.

### Micro-interactions on landing
- Sticky header switches from transparent to backdrop-blurred at scrollY > 24 (see SiteHeader spec)
- Feature blocks lift on hover (transform-only, no layout shift), per each block's `hover:` classes above
- CTA buttons: `active:scale-[0.98]` on press
- FeedPreview's selected chip pulses subtly (`motion-safe:animate-[pulse_3s_ease-in-out_infinite]`); everything else in the preview is static
- No card drift, no marquee, no gradient sweeps

---

## Screen 2/3 — `/login` and `/signup` (shared `(auth)` shell)

**Decision — centered card, not split-panel:**
- Split-panel doubles our maintenance surface for a login screen (a rare-use page); centered card matches Linear/Vercel/Cal.com references directly
- Mobile parity: a centered card scales; a split-panel has to radically re-lay-out
- Focus economy — one column reduces cognitive load

**Route-group scope:** `app/(auth)/` covers all four auth-flavored form pages — `/login`, `/signup`, `/forgot-password`, `/reset-password` — so they share the shell layout. `/verify-email` and `/onboarding/zip` are status/transition screens with different chrome; they keep their own top-level route directories and use the StatusCard pattern (see below).

### `app/(auth)/layout.tsx`

```tsx
<div className="min-h-svh grid grid-rows-[auto_1fr_auto] bg-background">
  <header className="px-6 md:px-8 pt-6">
    <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold">
      <LogoMark className="size-6 text-brand" />
      Event Atlas
    </Link>
  </header>

  <main id="main" className="flex items-center justify-center px-4 py-10 md:py-16 relative overflow-hidden">
    <a
      href="#auth-primary"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:bg-background focus:border focus:border-border focus:rounded-md focus:px-3 focus:py-1.5 focus:text-sm"
    >
      Skip to form
    </a>
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_-10%,var(--brand-soft),transparent_60%)]" />
    {children}
  </main>

  <footer className="px-6 md:px-8 pb-6 text-xs text-muted-foreground text-center">
    <p>&copy; {new Date().getFullYear()} Event Atlas</p>
  </footer>
</div>
```

The legal microcopy ("By creating an account you agree to...") does **not** live in the shared layout. It only makes sense on `/signup`, and Terms/Privacy pages don't exist yet. Add it to signup only, and only after those routes ship. Until then, omit entirely.

`#auth-primary` is an anchor id set on the credentials-form `<form>` element inside each auth page, so the skip link jumps past the Google button and divider directly to the fields.

### AuthCard (shared component)

```tsx
<div className="w-full max-w-md">
  <Card className="border-border/70 shadow-sm">
    <CardHeader className="text-center space-y-1">
      <CardTitle className="text-2xl md:text-3xl tracking-tight">{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">{children}</CardContent>
    <CardFooter className="justify-center text-sm text-muted-foreground">
      {footer}
    </CardFooter>
  </Card>
</div>
```

### `/login` (`app/(auth)/login/page.tsx`)

- Client component (needs `signIn` from `next-auth/react`)
- **Params to read (via `searchParams`, forwarded from server wrapper):**
  - `verified=1` — show success `Alert` "Email verified. Sign in to continue."
  - `error` — Auth.js error code — show inline `Alert` in destructive color
  - `callbackUrl` — persist through Google button + Credentials submit; default `/feed`

Layout inside AuthCard:
1. **Google button** at top: `<GoogleButton onClick={() => signIn("google", { callbackUrl })} />` — full-width, `variant="outline"`, google icon inline-start
2. Divider: `<div className="flex items-center gap-3"><Separator className="flex-1" /><span className="text-xs uppercase tracking-widest text-muted-foreground">or</span><Separator className="flex-1" /></div>`
3. **Credentials form** — react-hook-form + zod resolver
   - `<Field label="Email" name="email" type="email" autoComplete="email" required />`
   - `<Field label="Password" name="password" type="password" autoComplete="current-password" required />` — with a top-right "Forgot password?" link inside the label row (right-aligned)
   - Submit: `<Button type="submit" variant="brand" className="w-full" size="lg" disabled={isSubmitting}>{isSubmitting ? <Spinner /> : "Log in"}</Button>`
   - Error: `<FormError message={error} />` above submit
4. Footer text: `Don't have an account? <Link href="/signup" className="text-brand hover:underline">Sign up</Link>`

Interaction:
- Submit calls `signIn("credentials", { email, password, redirect: false, callbackUrl })`; on error `res?.error` → set form error to "Wrong email or password." (generic, no enumeration)
- On success → `router.push(res.url ?? "/feed")`
- Rate-limit 429 → show "Too many attempts. Try again in a minute." (server returns 429 with Retry-After if configured; UI is dumb — just interprets the response)

### `/signup` (`app/(auth)/signup/page.tsx`)

Client component. AuthCard shell.

Zod schema (client, mirrored server-side):
```ts
const schema = z.object({
  name: z.string().min(1, "Enter your name").max(80),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit ZIP"),
});
```

Layout inside AuthCard:
1. Google button (`callbackUrl=/feed`)
2. "or" divider
3. Form:
   - `<Field label="Name" name="name" autoComplete="name" required />`
   - `<Field label="Email" name="email" type="email" autoComplete="email" required />`
   - `<PasswordField label="Password" name="password" autoComplete="new-password" />` — includes eye toggle only. **No strength meter** (server accepts anything ≥8, so a meter shows judgement the server won't enforce). Helper text: `"8+ characters. 12+ is stronger."`
   - `<Field label="ZIP code" name="zipCode" inputMode="numeric" autoComplete="postal-code" placeholder="e.g. 94102" required maxLength={10} />` — helper "So we can show events near you"
   - Submit: `<Button variant="brand" size="lg" className="w-full">Create account</Button>`
   - `<FormError />` above submit
4. Footer text: `Already have an account? <Link href="/login" className="text-brand hover:underline">Log in</Link>`

Submit:
- `POST /api/auth/signup` with `{ name, email, password, zipCode }`
- On 200: call `signIn("credentials", { email, password, redirect: false, callbackUrl: "/verify-email" })` → then `router.push("/verify-email")`
- On 409 (email taken): field error under email — "An account with this email already exists. <Link href='/login'>Log in</Link>?"
- On 400 with validation issues: distribute to fields
- On 429: banner error

### Field component (shared)

```tsx
<div className="space-y-1.5">
  <div className="flex items-baseline justify-between">
    <Label htmlFor={name}>{label}</Label>
    {rightAdornment}
  </div>
  <Input
    id={name}
    aria-invalid={!!error}
    aria-describedby={helpId}
    className="h-10"
    {...register}
  />
  {(helper || error) && (
    <p id={helpId} className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
      {error ?? helper}
    </p>
  )}
</div>
```

**Interaction states on inputs:**
- Rest: `border-input`, `bg-transparent`
- Hover: `hover:border-foreground/30` (200ms)
- Focus: `focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:border-ring` (from shadcn Input default)
- Error: `aria-invalid` triggers `border-destructive ring-destructive/20` via shadcn's `aria-invalid` styles

**PasswordField component behavior:**
- Rest state: type="password", eye icon button in trailing position
- Toggle: switches to type="text", swaps eye/eye-off icon, aria-label updates
- No strength meter, no visual dots. One helper line under the input, that's it. Judgement about strength is user-side; we don't editorialize past "12+ is stronger."

---

## Screen 4 — `/onboarding/zip`

Google-new-user path. Different feeling from signup — celebratory + brief.

This is post-auth and uses its own layout (not the `(auth)` group), but it mirrors the auth visual system.

Container:
```tsx
<main className="min-h-svh grid place-items-center px-4">
  <div className="w-full max-w-md">
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto size-12 rounded-2xl bg-brand-soft grid place-items-center mb-4">
          <MapPin className="size-6 text-brand" />
        </div>
        <CardTitle className="text-2xl">
          {firstName ? `Welcome, ${firstName}` : "Welcome"}
        </CardTitle>
        <CardDescription>Where should we look for events?</CardDescription>
      </CardHeader>
      <CardContent>
        <form>
          <Field label="ZIP code" name="zipCode" inputMode="numeric" autoComplete="postal-code" placeholder="e.g. 94102" required maxLength={10} />
          {error && <FormError message={error} />}
          <Button variant="brand" size="lg" className="w-full mt-4" disabled={loading}>
            {loading ? "Saving..." : "Continue to feed"}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</main>
```

Greeting sourcing: `const { data: session } = useSession()`; `const firstName = session?.user?.name?.split(" ")[0] ?? null;`. When null, the greeting is just "Welcome" (no dangling comma). Do not fall back to "there" — reads awkward.

No "you can change this later in settings" line yet. Settings ships in iteration 5. Adding the promise now creates a broken affordance for a real (very short) window.

Submit logic already exists in the current file. Preserve the `await update()` before `router.push("/feed")` sequence.

---

## Screen 5 — Polish stubs

All three use the same **StatusCard** pattern (extracted to `components/auth/status-card.tsx` or inlined once — inline is fine, we only have 3 uses):

```tsx
<main className="min-h-svh grid place-items-center px-4">
  <Card className="w-full max-w-md">
    <CardHeader className="text-center">
      <div className={`mx-auto size-12 rounded-2xl grid place-items-center mb-4 ${tone === "success" ? "bg-emerald-500/10 text-emerald-600" : tone === "error" ? "bg-destructive/10 text-destructive" : "bg-brand-soft text-brand"}`}>
        <Icon className="size-6" />
      </div>
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    {actions && <CardFooter className="justify-center">{actions}</CardFooter>}
  </Card>
</main>
```

### `/verify-email`
- Default state: `<Mail />` icon, brand tone, title "Check your email", desc "We sent a verification link to your inbox. The link expires in 24 hours."
- `?status=invalid`: `<AlertTriangle />`, error tone, title "Link expired or invalid", desc "Request a new verification email by signing up again or logging in."
- Actions: `<Button asChild variant="outline"><Link href="/login">Back to login</Link></Button>`

### `/forgot-password`
- Form state: brand tone, `<KeyRound />` icon, title "Forgot password", desc "Enter your email and we'll send a reset link."
  - Field: email
  - Submit brand button: "Send reset link"
  - Footer link: back to login
- Submitted state: success tone, `<Mail />` icon, title "Check your email", desc "If an account exists for {email}, you'll get a reset link within a minute."
  - Action: back to login link

### `/reset-password`
- No token: error tone, title "Invalid reset link", desc + login link (existing logic preserved, just re-skinned)
- Token present: brand tone, `<Lock />` icon, title "Set a new password", desc "Choose a strong password with at least 8 characters."
  - `<PasswordField>` for new password (with strength meter)
  - `<Field>` for confirm
  - Client-side confirm-mismatch validation before submit
  - Submit brand button: "Update password"
- Success: success tone, `<CircleCheck />`, title "Password updated", desc + `<Button variant="brand" asChild><Link href="/login">Sign in</Link></Button>`

---

## New Button variant: `brand`

Extend `components/ui/button.tsx` `buttonVariants`:

```ts
variant: {
  ...existing,
  brand: "bg-brand text-brand-foreground hover:bg-brand-hover active:bg-brand-active focus-visible:ring-brand-ring/50 focus-visible:border-brand",
}
```

**Reason for a new variant vs reusing `default`:** `default` uses `--primary` (near-black) which is correct for neutral primary actions inside the app shell (e.g., "Save event"). The brand orange is for **acquisition CTAs** — signup, "Log in", primary conversion moments. Semantically distinct.

---

## Accessibility gates

- All inputs have `<Label htmlFor>` — no placeholder-only labels
- `aria-invalid` set by RHF `formState.errors` presence
- Error text sits **below** the field, linked via `aria-describedby`
- Form-level errors use `role="alert"` (shadcn `Alert` handles this)
- Landing hero images are decorative → `aria-hidden` on marquee container
- Trust strip provider names have `aria-label` on wordmark svg elements (screen readers read "Ticketmaster")
- Skip link at top of landing: `<a href="#main" className="sr-only focus:not-sr-only ...">Skip to content</a>`
- Focus rings visible on every interactive control (brand-tinted for brand button, ring-neutral otherwise)
- Password field eye-toggle has `aria-label="Show password" / "Hide password"` — swaps
- Prefers-reduced-motion: marquee drift + hover translate are wrapped in `motion-safe:`

---

## Metadata

Update `app/layout.tsx` metadata:
```ts
export const metadata: Metadata = {
  title: {
    default: "Event Atlas",
    template: "%s · Event Atlas",
  },
  description: "One personalized feed of events from Ticketmaster, Eventbrite, and Meetup.",
};
```

Per-route metadata (`export const metadata`):
- `/` — title "Event Atlas — Every event, one feed"
- `/login` — title "Log in"
- `/signup` — title "Sign up"
- `/verify-email` — title "Check your email"
- `/forgot-password` — title "Forgot password"
- `/reset-password` — title "Set a new password"
- `/onboarding/zip` — title "Welcome"

---

## Out of scope (deferred)

- Dark-mode design polish (tokens exist; visual QA deferred until iteration 10 or when a dark toggle ships)
- Testimonials / customer logos (we have no customers yet — dishonest to fake it)
- Waitlist / referral hooks
- Live/animated stats ("N events near you") — needs data we don't yet have at build time
- Blog / changelog links in footer
- Cookie banner (no non-essential cookies yet)

---

## Implementation checklist (for the frontend agent)

- [ ] Tint neutrals and add `--brand*` tokens in `globals.css`; register both in `@theme inline`
- [ ] Add Instrument Serif via `next/font/google` in `app/layout.tsx`; expose as `--font-serif`
- [ ] Add `brand` variant to `components/ui/button.tsx`
- [ ] `pnpm dlx shadcn@latest add input label card separator alert`
- [ ] Build `components/brand/{logo,google-icon}.tsx`
- [ ] Build `components/auth/{auth-card,google-button,password-field,form-error,field}.tsx`
- [ ] Build `components/landing/{site-header,hero,feed-preview,trust-strip,feature-grid,final-cta,site-footer}.tsx` (note: `feed-preview` replaces the earlier `marquee-events`)
- [ ] Rewrite `app/page.tsx` (landing)
- [ ] Add `app/(auth)/layout.tsx` (shared shell for the four form pages)
- [ ] Create `/login`, `/signup`, and **move** `/forgot-password`, `/reset-password` into `app/(auth)/` per spec
- [ ] Rewrite `app/onboarding/zip/page.tsx` and `app/verify-email/page.tsx` per spec (these keep top-level routes)
- [ ] Update root `metadata` and per-page metadata exports
- [ ] Manual smoke: signup happy-path, login happy-path, login `?verified=1` banner, forgot-password fill+submit, reset-password with no token vs bad token vs valid token, onboarding ZIP validation error, Google button visible on both login+signup, header state flip on scroll, skip-link works on auth pages with keyboard
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all green
- [ ] Reduced-motion check — set OS preference and reload landing; the FeedPreview chip pulse stops, everything remains readable
- [ ] Small-screen check at 375px — no horizontal scroll, hero readable, CTAs stack, FeedPreview appears below hero copy, feature blocks collapse to a single column
