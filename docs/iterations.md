# Event Atlas — Implementation Iterations

Living plan for the greenfield build. Each iteration is a self-contained slice that ends with a green quality gate and (when applicable) a code-review pass. Iteration numbers are stable; sub-iterations may be inserted if scope grows.

**Rules of the road:**
- Each iteration returns to the user before the next begins.
- Quality gate = `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — must be green before spawning `code-reviewer` (per `CLAUDE.md`). `pnpm build` was added in iteration 3 after it caught a Suspense/CSR-bailout that the other three commands missed.
- Anything touching auth, user data, payments, cron endpoints, or provider adapters gets `code-reviewer`, regardless of diff size.
- Docs (`PRODUCT_REQUIREMENTS.md`, `SYSTEM_ARCHITECTURE.md`) are the single source of truth — update them when a change invalidates a statement in them.

---

## Iteration 1 — Foundation & Tooling ✅

**Status:** Complete (2026-07-05)

**Owner:** Orchestrator (trivial tier — pure scaffolding)

**Scope:**
- Next.js 15.5.0 App Router, TS strict, Tailwind v4, ESLint (pinned — `next@latest` currently ships v16 with breaking changes; docs specify v15)
- shadcn/ui initialized (`base` preset — `@base-ui/react` primitives, not Radix)
- Prisma 6.19.3 (v7 requires `prisma.config.ts` + driver adapter — architectural shift the docs don't reflect; pinned to 6)
- Auth.js v5.0.0-beta.31 + `@auth/prisma-adapter`
- bcrypt, zod, react-hook-form + `@hookform/resolvers`, resend, `@upstash/{ratelimit,redis}`, date-fns
- vitest 4 + tsx + type declarations
- Directory tree per `SYSTEM_ARCHITECTURE.md` § Directory Structure
- `lib/db/client.ts` — Prisma singleton
- `.env.example` — all 13 env vars documented
- `vitest.config.ts` — targets `lib/**/*.test.ts`, `passWithNoTests: true`
- `vercel.json` — both crons wired
- `.gitignore` — `!.env.example`, playwright artifacts
- `pnpm.onlyBuiltDependencies` allowlist added (non-interactive build-script approval)
- Placeholder `prisma/schema.prisma` (datasource + generator only)

**Quality gate:** typecheck ✅ · lint ✅ · test ✅ · build ✅

**Env vars needed:** none (scaffolding only)

**Deviations from docs:**
1. Next.js pinned to 15.5.0 (not `latest` = 16.x)
2. Prisma pinned to v6 (not v7)
3. shadcn `base` preset (not Radix)

---

## Iteration 2 — Database schema + initial migration ✅

**Status:** Complete (2026-07-05)

**Owner:** `database` agent

**Scope:**
- Full Prisma schema per `SYSTEM_ARCHITECTURE.md` § Database Schema (Key Models)
- All enums: `Category`, `Provider`, `ReminderStatus`, `FriendRequestStatus`, `SubscriptionStatus`, `LocationPermission`, `ExperienceType`
- Every FK indexed; feed-query composite indexes (`isActive + startTime`, `latitude + longitude` bounding-box, etc.)
- Initial migration authored and applied to dev DB (`prisma migrate dev --name init`)
- `lib/db/client.ts` singleton verified against the generated types

**Env vars needed:** **`DATABASE_URL`** — user must spin up local Postgres (Docker) or a Neon dev branch and paste the URL into `.env.local` before the migration runs. The database agent authors the schema without DB access; the migration step needs the DB.

**Quality gate:** typecheck + lint + test all pass with the generated Prisma types in use.

**Review:** `code-reviewer` — schema is upstream of everything; catching issues here is much cheaper than at review time.

---

## Iteration 3 — Auth end-to-end ✅

**Status:** Complete (2026-07-06)

**Owner:** `database` (mini schema addition) + `auth` agent (bulk)

**Scope delivered:**
- Auth.js v5 config split into `lib/auth/config.ts` (Node — Prisma + Credentials) and `lib/auth/config.edge.ts` (Edge — middleware; providers only, no Node modules)
- JWT session strategy, 7-day `maxAge`, Google + Credentials providers, bcrypt cost 12
- `PasswordResetToken` model added (migration `20260706131425_add_password_reset_token`) — SHA-256 hashed tokens, `usedAt` single-use enforcement, `updateMany` atomic-claim race guard
- Verification tokens also hashed at rest; `newVerificationToken` transactionally invalidates prior tokens on resend
- Signup, verify-email, forgot-password, reset-password, Google OAuth + `/onboarding/zip` interstitial flows
- Email templates: verification + password reset (Resend)
- Middleware protects all routes except public list; anchored-segment matcher prevents prefix leaks; excludes `/api/*` so API routes return 401 themselves
- Rate limiting: signup carries `email:ip` tuple + IP-only fallback; login `email:ip`; forgot-password `email:ip` (fire-and-forget Resend for constant-time)
- `sessionVersion` bumped on both password reset AND email verification
- Google new-user flow: `profile()` override + `events.createUser` fallback set `emailVerified`; `session.user.needsZip` gates ZIP interstitial; client calls `useSession().update()` after ZIP submit to refresh JWT
- Env fail-fast at runtime (dev + prod), skipped only during `next build`
- Bare functional stub pages: `/verify-email`, `/forgot-password`, `/reset-password`, `/onboarding/zip` (iteration 4 polishes)

**Env vars needed (all already in `.env.example`):** `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `OPENCAGE_API_KEY`

**Quality gate:** typecheck ✅ · lint ✅ · test ✅ (37 tests / 8 files) · build ✅

**Review:** `code-reviewer` × 2 passes — 4 Critical + 10 High + Medium found first round; 1 new Critical + 4 High + 6 Medium found in re-review; all addressed by two auth fix rounds. Third full re-review skipped after orchestrator spot-check confirmed all Critical/High fixes landed.

**Deviations from docs:**
1. Quality gate expanded to include `pnpm build` (was missing from iteration 1 spec — added going forward because it caught a Suspense/CSR-bailout error the other three commands missed)
2. `next-auth/react` `<SessionProvider>` added at root layout so onboarding client can call `useSession().update()`; needed for the Google-new-user JWT refresh flow

**Accepted trade-offs:**
- Verify-email bumps `sessionVersion` — the just-verified user gets bounced to `/login?verified=1` on their next protected-route hit. Iteration 4 UX polish can revisit.
- JWT callback `catch { return token }` fails open on transient DB errors (chose availability over revocation strictness during outages)
- Signup timing differs new-vs-existing email due to bcrypt (plan explicitly accepted; enumeration prevention holds for body/status shape)

---

## Iteration 4 — Landing page + login/signup UI ✅

**Status:** Complete (2026-07-06)

**Owner:** `frontend` agent (with `ui-ux-pro-max` + `impeccable` for design planning)

**Scope delivered:**
- Design plan at `docs/plans/auth-ui.md` — ui-ux-pro-max design pass + impeccable critique pass, includes tokens, component tree, exact copy, and the two-serif-italic signature move
- `/` landing (SSG) — hero, feed-preview product mock (not abstract cards), asymmetric feature grid (3 non-identical blocks), trust strip, final CTA, sticky header with scroll-state flip
- `app/(auth)/` route group — shared shell (centered card, brand radial bloom, skip link) for login, signup, forgot-password, reset-password
- `/login`, `/signup` — react-hook-form + zod, Google button + Credentials, generic error messages (no enumeration)
- ZIP field on signup with `\d{5}(-\d{4})?` validation; the location permission modal is deferred to when `/feed` ships
- Polish: `/verify-email`, `/onboarding/zip`, `/forgot-password`, `/reset-password` all rebuilt using the shared visual system
- Tokens: warm-tinted neutrals + `--brand*` (deepened to `oklch(0.54 0.18 39)` after review measured the initial value at 3.36:1 instead of the claimed 4.6:1; final measured contrast 5.42:1)
- Typography: Instrument Serif added via `next/font/google`, used exactly twice (the words "actually" in hero, "find" in FeatureGrid)
- `Button` gained a `brand` variant

**Env vars needed:** none new

**Quality gate:** typecheck ✅ · lint ✅ · test ✅ (8 files / 37 tests) · build ✅ (16 routes)

**Review:** `code-reviewer` × 1 pass — 3 Critical (font broken sitewide via `html` vs `body` var scope, login silent on wrong password due to callbackUrl-triggered Suspense re-render, Base UI `render={<Link>}` warnings) + 3 High (brand contrast, reset-password dead error string branch, signup 409 dead branch) + 4 Medium found; all addressed in one fix round. Full re-review skipped after orchestrator spot-check confirmed all Critical/High fixes landed.

**Deviations from docs:**
1. Trust strip provider "wordmarks" are stylized SVG text, not real brand marks — legally safer and avoids trademark issues. Flagged for a future design iteration if a designed logo lockup ships.
2. Skip link uses an explicit JS focus handler (`SkipLink` client component) rather than pure `<a href="#id">`, because fragment-navigation focus behavior is browser/AT-inconsistent.
3. Base UI's `render` prop replaces Radix's `asChild` throughout — plan called `asChild` but the project's shadcn base-nova style uses `@base-ui/react`. All button-as-link CTAs now use `buttonVariants(...)` styling on plain `<Link>` elements to sidestep `nativeButton` semantics warnings.

**Accepted trade-offs:**
- Duplicate-email signup returns 200 (anti-enumeration); the client's 409 handler was deleted per CLAUDE.md "no fallbacks for impossible cases." Users with existing accounts get the same UX as fresh signup; the diagnostic is a verification email that never arrives.
- Wrong-password login shows a generic banner ("Wrong email or password.") — no field-level enumeration.
- Location permission modal not built here — will land alongside `/feed` in iteration 7.
- Dark-mode design polish deferred; tokens exist and don't regress, but only light mode was designed.

---

## Iteration 5 — User preferences + settings page ✅

**Status:** Complete (2026-07-07)

**Owner:** `backend` + `frontend` agents (with a small `auth` fix-round pass)

**Scope delivered:**
- Shared preferences schema at `lib/preferences/schema.ts` — Zod schema mirroring the `UserPreferences` Prisma model, `PRO_ONLY_FIELDS = ["experienceType", "familyFriendly"]` const, `CATEGORY_DISPLAY_ORDER` list in the PRD's order. Full + partial variants; `priceMax >= priceMin` cross-field refinement
- `lib/subscription/is-pro.ts` — `subscription?.status === "ACTIVE"` helper (FREE/PAST_DUE/CANCELED/null → false)
- `GET/PATCH /api/users/preferences` — auth-gated; PATCH reads subscription fresh from DB (not the JWT) and silently strips Pro fields for non-ACTIVE users
- `PATCH/DELETE /api/users/me` — name + ZIP updates with OpenCage re-geocode (null coords tolerated on geocode failure to match signup); DELETE cascades User → children
- `/settings` (Server Component, dynamic) under `app/(main)/` — `auth()`-gated, fetches `user` with `preferences` + `subscription` in one query, Zod-parses the Json `disabledCategories` at the read boundary with `[]` fallback on parse failure
- `PreferencesForm` — RHF + `preferencesPartialSchema` resolver, 12 category chips (`aria-pressed`, PRD order), number inputs for distance/date-range/price, 3-state experience-type selector, family-friendly `<Switch>`; Pro-locked fields disabled with `<ProLockBadge>` and stripped client-side before submit (defense-in-depth; server also strips)
- `AccountSection` — name + ZIP editor, sign-out, delete-account with `<Dialog>` confirmation → `DELETE /api/users/me` → `signOut({ callbackUrl: "/" })`
- shadcn `dialog` + `switch` added via `pnpm dlx shadcn add`; `Button` `brand` variant restored after the installer overwrote it
- `events.createUser` in `lib/auth/config.ts` now upserts `UserPreferences` + `Subscription` for every new user (was previously only credentials-path via signup route) — closes the invariant "every User has both children" for Google OAuth signups. `SYSTEM_ARCHITECTURE.md` § Authentication updated with the one-liner
- Vitest: 85 tests / 12 files (was 65/10). New: preferences schema (23), `isPro` (5), preferences route handler (auth guard, Pro-strip for FREE + PAST_DUE, ACTIVE persistence, invalid body → generic 400, Prisma throw → generic 500), me route handler (name + ZIP update, geocode null-tolerance, IDOR guard via unknown-field strip, DELETE)

**Env vars needed:** none new

**Quality gate:** typecheck ✅ · lint ✅ · test ✅ (85/85 in 12 files) · build ✅ (19 routes; `/settings` = `ƒ (Dynamic)`)

**Review:** `code-reviewer` × 1 pass. 0 Critical + 2 High (missing `UserPreferences`/`Subscription` seed for Google OAuth users → 500 on PATCH; missing route-handler tests for Pro-strip business rule) + 2 actionable Medium (Zod issue-message leaked in 400 bodies; unvalidated `disabledCategories as Category[]` cast at SSR boundary) + 5 Nitpicks. All Critical/High + both actionable Medium addressed in one parallel fix round (`auth` + `backend` + `frontend`). Full re-review skipped after orchestrator spot-check confirmed all fixes landed.

**Deviations from docs:**
1. Preferences schema does not use Zod `.strict()` — unknown keys are stripped rather than rejected. This is the correct default for a PATCH endpoint (backends should not brittle-error on forward-compat client payloads); tests were updated to assert strip-not-reject.
2. `/settings` uses the root layout only — no shared `(main)/layout.tsx` yet. The shared authed shell with a nav bar is deferred to iteration 7 when `/feed` gives it a second occupant.
3. `events.createUser` also seeds preferences + subscription (not only the Credentials signup route as iteration 3 implied). Documented in `SYSTEM_ARCHITECTURE.md` § Authentication.

**Accepted trade-offs:**
- Free-tier PATCH sending Pro fields returns 200 with the fields silently stripped (not 403). Matches the plan's UX intent ("show all with Pro-only ones gated") and the "no fallbacks for impossible cases" rule — the UI already disables them; server strip is defense-in-depth.
- Account deletion has no password re-entry / re-auth. Google users have no password, and the JWT `sessionVersion` + 7-day maxAge bound the stolen-session window. Reconsider if a future iteration adds more destructive account operations.
- Preferences + account PATCH endpoints have no rate limiting. Both are per-user, no enumeration surface, no cost. Note for future.
- Nitpicks not fixed: `setDeleteLoading(false)` in `finally` after `signOut` (cosmetic strict-mode warning); object literal re-created inside `.map` in `PreferencesForm`. Both bounded and non-blocking.
- Playwright smoke suite still not bootstrapped — the reviewer's browser pass covered the golden path this iteration; the settings flow is a good first candidate whenever the suite is added.

**Pre-existing gap surfaced but out of scope:**
- `app/api/auth/signup/route.ts` still returns `parsed.error.issues[0]?.message` on 400. Same class of leak as the two just fixed. Iteration 3 territory — orchestrator to decide whether to open a targeted follow-up or roll into iteration 6/7 hygiene.

---

## Iteration 6 — Event sync pipeline ✅

**Status:** Complete (2026-07-10)

**Owner:** `sync` agent (bulk) + orchestrator (iteration-5 leftover Zod-leak fix in three auth routes)

**Scope delivered:**
- `lib/geo/haversine.ts` — pure `haversineMeters(lat1, lng1, lat2, lng2)` (also owned by iteration 7 feed)
- `lib/providers/types.ts` — `NormalizedEventInput` shape + `ProviderAdapter` contract (`fetchEvents(): AsyncGenerator<NormalizedEventInput>`)
- Three provider adapters — Ticketmaster (Discovery API, per-metro batching over NYC/LA/Chicago/SF/Austin, 429 exponential backoff 500ms→8s cap, segment→category map), Eventbrite (bearer, cursor pagination, category_id map with 13 entries), Meetup (Apify `filip_cicvarek/meetup-scraper` via dynamic import, 49-topic map). All three reject events without geo, fall back unknown categories to `OTHER` with structured logs, and read env vars inside functions (not at module load) so `next build` doesn't break when secrets are absent
- Provider fixtures under `lib/providers/__fixtures__/*.json` — synthesized (no PII, no real API captures) drive normalization tests
- `lib/sync/dedupe.ts` — Jaro-Winkler title similarity (0.849 rejects / 0.851 accepts), ±2h window, 500m Haversine radius; `mergeIntoCanonical` in a single Prisma transaction re-parenting `EventSource`/`SavedEvent`/`GoingEvent`/`EventReminder` and skipping `(userId, eventId)` unique-constraint collisions; **`deduplicateCrossRun`** second pass added in review to catch prior-run canonicals colliding with this-run new events (missing from first draft)
- `lib/sync/cleanup.ts` — two-step. Step 1 `updateMany isActive=false` on expired (`endTime < now`, fall back to `startTime` when `endTime` null). Step 2 `deleteMany` filtered by `goingUsers: { none: {} }` — attendance history preserved. Belt-and-suspenders with `GoingEvent.onDelete: Restrict` from iteration 2
- `lib/sync/run.ts` — orchestrator: streams each adapter, upserts on `EventSource.provider_externalId` unique, runs in-run + cross-run dedupe, cleanup, returns `{ provider: {fetched, normalized, upserted, skipped, status: "ok" | "aborted"} }` summary with `sync.complete` structured log
- `app/api/sync/run/route.ts` — **`GET`** handler (Vercel Cron sends GET; docs previously said POST — corrected). Bearer `CRON_SECRET` check happens before any DB/network work; returns 401 on missing/wrong secret. 5-minute `maxDuration`, Node.js runtime
- **Iteration-5 leftover cleanup** — same-class Zod `parsed.error.issues[0]?.message` leak found in `onboarding/zip`, `reset-password`, `forgot-password` routes (signup was already fixed); patched all three to generic `"Invalid request"` client body + structured server-side `console.error`. Matches the signup pattern from iteration 5

**Vitest coverage:** 242 tests / 19 files (was 85/12). New: Haversine (8), provider types + three adapter fixture suites (86 combined — category-map completeness across every provider, unknown-code → OTHER + log, mock loop iteration via `mockImplementation` not `mockResolvedValue`), dedupe (30 covering JW boundary, time/venue edges, mergeIntoCanonical collision paths, cross-run collision), cleanup (8 covering GoingEvent retention + in-progress survival), route (8 covering 401 branches + counts)

**Env vars needed:** `TICKETMASTER_API_KEY`, `EVENTBRITE_TOKEN`, `APIFY_API_TOKEN`, `CRON_SECRET` — all previously in `.env.example`. Adapters skip-with-warn if unset at runtime (no throw at module load).

**Quality gate:** typecheck ✅ · lint ✅ · test ✅ (242/242 in 19 files) · build ✅ (20 routes; `/api/sync/run` = `ƒ (Dynamic)`)

**Review:** `code-reviewer` × 1 pass. **2 Critical** (Meetup timezone offset parser produced `Invalid Date` for every US metro via `padEnd(6, ":00")` on single-digit offset strings — silent breakage of 100% of Meetup ingest; cross-run cross-provider dedupe never invoked because `deduplicateNewEvents` filtered to this-run IDs only) + **4 High** (silent fallback in `parseLocalDateTime`, `sources[0]` compare instead of provider-set intersection, adapter tests reused a single `Response` instance so multi-metro loop was never exercised, SA doc said POST) + **5 actionable Medium** (Promise.all-with-boolean idiom, redundant transaction in upsert, Ticketmaster `isFree` false positive on missing `priceRanges`, Meetup fee-unit ambiguity, provider `status` field for aborted runs) + 2 nitpicks. All Critical/High + all Medium addressed in one sync-agent fix round; 14 tests added (228 → 242). Full re-review skipped after orchestrator spot-check confirmed both Criticals' fixes and quality-gate green.

**Deviations from docs:**
1. Cron route exports **`GET`**, not `POST` as `SYSTEM_ARCHITECTURE.md` line 105 originally stated. Vercel Cron sends GET; POST would have silently 405'd in prod. SA § Event Sync Pipeline updated in the same iteration.
2. Bounding-box constants for cross-run dedupe (`0.005°lat / 0.007°lng`) are hardcoded in `dedupe.ts` — matches the ~500m radius the docs specify but the docs don't state the box math explicitly. Not worth pushing into a config knob yet.
3. Ticketmaster metro list (NYC, LA, Chicago, SF, Austin) is a starter set inside the adapter file. Expansion is a future config change, not an architectural decision — leaving in-file for now.

**Accepted trade-offs:**
- No live provider dry-run this iteration — env vars unset locally. Fixture-driven tests + typecheck+build cover shape correctness; live-API surprises (rate-limit shape, category vocabulary drift) will surface in the first prod cron run and go into a follow-up fix-round.
- `crypto.timingSafeEqual` on `CRON_SECRET` deferred — HTTPS shared-secret; reviewer marked as optional; skip.
- Playwright smoke suite still not bootstrapped — this iteration is server-only so no browser verification was performed. Will re-invoke on the next UI-touching iteration.
- `runSync` continues past a single-provider hard failure (marks that provider `status: "aborted"` in the summary log) rather than aborting the whole run. Trade-off: partial data is better than none; visibility comes from the per-provider status field, not a route-level 500.
- Fixture data is synthesized, not real API captures. Deliberate — real captures risk PII and TOS friction. When live-API drift surfaces, capture-then-scrub is the update path.

**Pre-existing gap surfaced:**
- None new. The iteration-5-flagged Zod-message leak in `signup/route.ts` turned out to have been silently patched during iteration 5's fix round; the same-class leak in three other auth routes was found and patched here.

---

## Iteration 7 — Feed (query + UI + details panel) ✅

**Status:** Complete (2026-07-11)

**Owner:** `backend` (shared query + `/api/events`) + `frontend` (feed UI + shared authed shell) agents; orchestrator ran the `ui-ux-pro-max` + `impeccable` design pass and wrote the locked plan.

**Scope delivered:**
- **Design plan at `docs/plans/feed.md`** — layout, tokens, motion, a11y, URL param schema, component tree, and an explicit "what's NOT in this iteration" list (Save/Going/Calendar deferred to iter 8; iter 7 is read-only)
- **`lib/events/feed-query.ts`** — shared `getFeedPage(input)` consumed by both the `/feed` Server Component (SSR page 1) and `GET /api/events` (client infinite scroll). Bounding-box `where` (indexed lat/lng), over-fetch `limit * 3` ordered by `(startTime asc, id asc)`, in-memory Haversine refine, cursor advances to last *scanned* row (not last returned), `MAX_LOOP_ITERATIONS = 10` bound. Pro filter strip happens BEFORE any DB query (mirrors iter 5 pattern)
- **`lib/events/cursor.ts`** — opaque base64url `{startTime, id}` encode/decode
- **`app/api/events/route.ts`** — auth-gated (`auth()` → JSON `401`), Zod-validated params, generic error responses (no Zod-message leak per iter 5/6 lessons)
- **`app/(main)/layout.tsx`** — shared authed shell (Header + UserMenu). First surface with a shared shell; `/settings` migrated under `(main)` group so both routes inherit it (iter 5 deferred this here)
- **`app/(main)/feed/page.tsx`** — SSR Server Component; redirects to `/onboarding/zip` if user has no coords (aligns SSR with API's `Location required` gate)
- **`components/main/{header,user-menu}.tsx`** — Header uses `bg-background` (no `backdrop-blur`, per shared design laws + iter 4 aesthetic). UserMenu shows Google avatar or first-initial monogram
- **`components/feed/*` (25 files)** — EventCard (article + positioned invisible button overlay for whole-card click), EventDetailsPanel (Sheet, Get Tickets + Maps deep-links only), SearchAndFilterBar, FilterBar (chip strip w/ Popover per filter), 9 filter popovers (4 free + 5 Pro), LocationPermissionModal, empty/end/error/skeleton states, back-to-top, load-more w/ IntersectionObserver + fallback button, `aria-live` region for infinite-scroll announcements
- **`components/feed/filter-chip.tsx`** — Pro-locked chips render an upsell popover on click (NOT `aria-disabled` blocking clicks) so FREE users see the "This is a Pro filter" message; free chips open their filter popover
- **`lib/events/format.ts`** — `formatDayTime`, `formatFullDate`, `formatTime`, `priceLabel`, `distanceLabel`. Fixed `en-US` locale + UTC time-zone to avoid SSR/CSR hydration mismatches
- **`lib/events/maps.ts`** — `googleMapsUrl(venue)` + `appleMapsUrl(venue)` using single-string venue (Prisma schema has one `Event.venue` field; UI uses it for both `venueName` and `venueAddress` on the FeedRow)
- **`lib/filters/url-params.ts`** — parse + serialize with delta-only semantics: `cat` param omitted when the effective enabled set equals the user-preference default (avoids 200-char URLs from unchecking one category). `parseGeoCoords` Zod-guards finite lat ∈ [-90,90], lng ∈ [-180,180], positive int ts, and rejects `ts` older than 24h
- **`lib/filters/defaults.ts`** — `effectiveFilters(overrides, prefs)` merges the two
- **`next.config.ts`** — `images.remotePatterns` for `s1.ticketm.net`, `img.evbuc.com`, `cdn.evbuc.com`, `secure.meetupstatic.com`, `photos.meetupstatic.com` (would have crashed the first prod cron run without this)
- **`app/globals.css`** — added `--border-strong` token for card hover borders
- **`SYSTEM_ARCHITECTURE.md`** § Routes — added `GET /api/events` row documenting the `FeedRow.venueName + venueAddress` two-field shape and the client-supplied-coords contract
- **shadcn installs:** `sheet`, `popover`, `badge`, `skeleton` (separator already present). `Button` `brand` variant re-verified intact after each install

**Vitest coverage:** 351 tests / 25 files (was 242/19). New: feed-query (26 covering preference merge, Pro-strip before DB, bounding-box math, cursor stability across all-filtered-out pages, iterated refill under `MAX_LOOP_ITERATIONS` bound, search `contains` insensitive-mode injection safety, category filter with URL override, source priority TM > EB > MU), route (16 covering 401 no session, 400 invalid params + no location, 200 correct FeedPage shape, client-lat prefers over DB, generic 500), format (12), maps (5), url-params (25 covering delta serialization, geo Zod rejection paths), defaults (11)

**Env vars needed:** none new (all providers set in iter 6)

**Quality gate:** typecheck ✅ · lint ✅ · test ✅ (351/351 in 25 files) · build ✅ (22 routes; `/feed` = 106 kB First Load, `/api/events` = `ƒ (Dynamic)`)

**Review:** `code-reviewer` × 1 pass with thorough browser verification (signed in as seeded test user, exercised full golden path). Report cited 3 Critical + 4 High + 6 Medium — but subsequent verification against the actual code showed the frontend agent had already addressed nearly every finding in-flight before the review completed (redirect on null coords, `next.config.ts` remotePatterns, Pro-chip upsell popover, category URL delta semantics, `parseGeoCoords` Zod hardening + age check, aria-live population, `router.replace` for reset, `useLayoutEffect`-measured "Show more" truncation gate, SSR error banner). Only remaining finding was **H1 timeOfDay UTC hours** — accepted as a documented limitation (inline comment at `lib/events/feed-query.ts:250`), fix requires a schema field `Event.startHourLocal` populated at ingest time (database + sync change deferred to a future iteration or bundled with iter 8 wiring)

**Deviations from docs:**
1. `FeedRow` shape has `venueName` + `venueAddress` as separate fields, both currently set to `Event.venue` (single string per Prisma schema). Design plan originally said single `venue: string`; updated to reflect the two-field forward-compatible shape. Panel prefers `venueAddress`, falls back to `venueName`. When a future schema splits venue name from address, the FeedRow contract does not change
2. Details panel Sheet is right-drawer at all breakpoints; the design plan called for bottom-sheet on mobile but the installed Base UI Sheet primitive does not expose a per-breakpoint `side` swap. Deferred as cosmetic
3. `Button` `asChild` prop referenced in the plan doesn't exist in this project's shadcn base-nova preset (uses `@base-ui/react`, not Radix). Frontend used Base UI's `render` prop pattern instead — same result, correct API for the installed stack

**Accepted trade-offs:**
- **timeOfDay UTC filter (H1 from review):** current implementation compares `startTime.getUTCHours()` against MORNING/AFTERNOON/EVENING bands. Correct behavior needs venue-local time. Deferred until a schema field for local hour is added; commented inline in `feed-query.ts`. Impact is bounded because timeOfDay is a Pro filter — free users cannot exercise it in V1
- **Playwright smoke suite still not bootstrapped** — reviewer's manual golden-path pass covered iter 7. Feed → filter → card open → panel close would be a good first case whenever the suite lands
- **No live provider imageUrl testing** — Ticketmaster/Eventbrite/Meetup images will render on first prod cron run; the `remotePatterns` allowlist covers the hostnames the adapters produce (verified against `lib/providers/__fixtures__/`). Wider CDN drift will surface if a provider adds a new subdomain

**Process observation (worth remembering):** the code-reviewer's report described state that the frontend agent had already fixed mid-session, before the review completed. Spot-checking findings against current source before dispatching a fix round saved a redundant frontend spawn. Reviewer output describes what was reviewed, not what the current code says — always verify.

---

## Iteration 8 — Save + Going + Calendar export + reminder cron ✅

**Status:** Complete (2026-08-06)

**Owner:** `backend` + `sync` + `frontend` agents (design plan by orchestrator via `ui-ux-pro-max` + `impeccable`)

**Scope delivered:**
- **Design plan at `docs/plans/save-going.md`** — locked EventCard toggle placement/state, EventDetailsPanel footer, SaveLimitDialog copy, reminder email register (brand register, table-based, no em dashes)
- **`POST/DELETE /api/events/[id]/save`** — interactive `$transaction` with `{ isolationLevel: "Serializable" }`, count-inside-tx for free users, P2034 conflict remaps to 409 SAVE_LIMIT_REACHED, P2002 same-event idempotency, 404 for missing/inactive events, subscription lookup pre-tx to shrink serialization footprint
- **`POST/DELETE /api/events/[id]/going`** — atomic tx wraps `goingEvent.create` + reminder upsert (updateMany-then-create), reminder created only when `startTime - 24h > now`, DELETE transitions PENDING reminders to CANCELLED
- **`GET /api/events/[id]/ics`** — RFC 5545-compliant ICS builder (`lib/calendar/ics.ts`) with 75-byte line folding, CRLF, text escaping, `Content-Disposition: attachment`
- **`lib/calendar/deep-links.ts`** — `googleCalendarUrl` (URL template) + `appleCalendarUrl` (client-only, derives host from `window.location.host` at call time)
- **`GET /api/users/me/event-state`** — returns `{ saved: string[], going: string[], isPro: boolean }`, `Cache-Control: private, no-store`
- **`GET /api/notifications/reminders/process`** — cron: `crypto.timingSafeEqual` on CRON_SECRET (also applied to `/api/sync/run`), NEXTAUTH_URL pre-flight guard (500 before any DB read if unset), claim-by-FAILED serializable strategy, batched `event.sources` include (no N+1), Resend send, structured `reminders.*` logs
- **`lib/events/reminder.ts`** — `computeSendAt(startTime)` returns `startTime - 24h` when > now, else null
- **`lib/events/primary-source.ts`** — `getPrimaryTicketUrl(eventId)` canonical `orderBy: { createdAt: "asc" }` used by ICS route
- **`lib/email/templates/reminder.tsx`** — brand-register email; subject "Coming up: {title}" (not "Tomorrow:" since 24h fires cross-date-boundary for evening events); locked copy per plan §4
- **`lib/subscription/constants.ts`** — `FREE_SAVE_LIMIT = 5` centralized
- **`components/providers/event-state-provider.tsx`** — client context; optimistic Save/Going with server reconciliation, per-id in-flight state (`isSavePending`/`isGoingPending`), pre-check skip when `isPro`, `router.push("/login")` on 401, `toggleSave` returns `Promise<{ success: boolean }>` so pulse only fires on 2xx
- **`components/feed/event-card.tsx`** — overlay converted from `<button>` to `<Link>` (nested-interactive HTML fix); Save/Going toggles at z-20, link at z-10; Save-success pulse via `data-just-saved` gated on server success; loading/uninitialized states
- **`components/feed/event-details-panel.tsx`** — new footer: row 1 `PanelToggle` (outline↔brand for pressed) × 2 + `AddToCalendarMenu`; row 2 full-width Get Tickets
- **`components/feed/save-limit-dialog.tsx`** — mounted at `app/(main)/layout.tsx`, locked copy per plan §3
- **`components/ui/dropdown-menu.tsx`** — new wrapper around `@base-ui/react/menu` following the project's `data-slot` pattern (replaces raw Menu usage in panel)
- **`app/globals.css`** — `@keyframes save-pulse` + `[data-just-saved]` selector with `prefers-reduced-motion` respect
- **`SYSTEM_ARCHITECTURE.md` § Notifications** — documented FAILED-as-sentinel claim strategy and its crash-leak trade-off; follow-up `SENDING` enum flagged

**Vitest coverage:** 482 tests / 35 files (was 351/25 after iter 7). New: save route (10 including TOCTOU inside-tx re-read, P2034 remap, `isolationLevel: Serializable` assertion, Pro-user allow-at-5), going route (7 including 404 branches, tx wraps create + reminder, P2002 idempotency inside tx), ICS route + builder (~15), event-state route (6 including `isPro` matrix across FREE/ACTIVE/PAST_DUE/CANCELED/null), reminder scheduling math (5), calendar deep-links (client-side host derivation + SSR guard), reminder cron (24 including CRON_SECRET timingSafeEqual matrix, NEXTAUTH_URL validation, batched sources with no per-reminder findFirst), primary-source helper (3)

**Env vars needed:** none new (`CRON_SECRET`, `NEXTAUTH_URL`, `RESEND_API_KEY` all set in prior iterations)

**Quality gate:** typecheck ✅ · lint ✅ · test ✅ (482/482 in 35 files) · build ✅ (26 routes)

**Review:** `code-reviewer` × 2 passes.
- Round 1: 3 Critical (TOCTOU save-limit race with create-outside-tx; Apple Calendar URL broken client-side via `process.env.NEXTAUTH_URL` in client bundle; Pro users blocked by client `savedIds.size >= 5` pre-check) + 5 High (`goingEvent.create` outside reminder tx; NEXTAUTH_URL not validated in cron before sending broken links; FAILED-as-sentinel crash-leak — doc-only fix; save-success pulse played on failed saves; hardcoded 600ms UI-lock timer decoupled from network) + 6 actionable Medium + 6 nitpicks. Fixes fanned out to backend + frontend + sync in parallel.
- Round 2 (targeted re-review): all round-1 Critical and High confirmed closed at cited `file:line`. One residual: default Postgres READ COMMITTED left a narrower TOCTOU window on concurrent DIFFERENT-event saves at count=4. Orchestrator landed the `{ isolationLevel: "Serializable" }` + P2034 → 409 remap inline as a trivial-tier follow-up (one line + a handler; identical shape to the pattern already in the reminder cron).

**Deviations from plan:**
1. **`AddToCalendarMenu` skipped `pnpm dlx shadcn@latest add dropdown-menu`.** The plan says to install the shadcn Radix dropdown-menu, but this repo is uniformly `@base-ui/react`. The fix round created `components/ui/dropdown-menu.tsx` as a base-ui wrapper following the project's Popover pattern — semantically identical, keeps the codebase primitive stack consistent.
2. **`/api/users/me/event-state` response shape.** Plan spec'd `{ savedIds, goingIds, savedCount }`; actual is `{ saved, going, isPro }`. Client derives `savedCount` from `saved.length`. The `isPro` addition (not in the plan) was required to unblock Pro users from the client-side pre-check.
3. **EventCard `<Link>` overlay `href` is aspirational.** `href="/feed?event={id}"` with `onClick={preventDefault + onOpen}` — the URL never changes. Deep-linkable panels were out of scope; the href reserves the shape for a follow-up.

**Accepted trade-offs:**
- **FAILED-as-sentinel crash leak.** The reminder cron's claim-by-FAILED strategy means any handler crash between claim and send permanently marks reminders FAILED. Documented in `SYSTEM_ARCHITECTURE.md`. Follow-up: add a `SENDING` enum state to distinguish in-flight from terminal failure (schema change deferred).
- **timeOfDay UTC filter** from iter 7 still uses UTC hours (H1 from iter 7 review). This iteration did not touch it; deferred alongside a future `Event.startHourLocal` schema field.
- **No Playwright smoke suite yet.** Reviewer's round-1 golden-path pass covered iter 8; the "sign in → save 5 → 6th → dialog fires" and "Apple Calendar link opens webcal URL" flows would be strong first Playwright cases whenever the suite lands.
- **ICS export not scoped to Saved/Going.** Any authenticated user can `GET /api/events/[id]/ics` for any event — reviewer flagged as optional product decision, not a bug. Kept open.
- **`event-state` client 401 handler pushes to `/login`.** Safe today because provider is mounted only under `(main)`; if provider were moved to the root layout, a loop is theoretically possible. Reviewer flagged Medium; deferred to a top-of-file comment on the provider file if this ever moves.

---

## Iteration 9 — Friends / social ✅

**Status:** Complete (2026-08-11)

**Owner:** `backend` + `frontend` agents (design pass by orchestrator via `ui-ux-pro-max` + `impeccable`)

**Scope delivered:**
- **Design plan at `docs/plans/friends.md`** — ui-ux-pro-max design pass + impeccable critique pass; 15 fold-in critiques applied. Locks the four-tab `/friends` layout, EventDetailsPanel additions, panel "Share" actions menu (replacing Add-to-Calendar), UserMenu pending-badge, and the public `/e/[id]` share page treatment
- **`lib/friends/`** — `pair.orderedPair(a,b)` (single enforcement point for the `userAId < userBId` invariant), `queries.{listFriendIds, areFriends, pendingRequestCount, listFriendsGoing}`, and **`activity.ts`** — shared `getFriendActivityPage({userId, cursor})` consumed by both the `/friends` SSR page 1 and `GET /api/social/activity` (per CLAUDE.md shared-query rule)
- **Friend request routes** — `POST /api/friends/requests` (silent-success anti-enumeration on every 200 path, rate-limited 5/hour tuple + 30/hour sender fallback, **429 with silent body** on rate-limit hit), `GET /api/friends/requests` (incoming + outgoing), `PATCH /api/friends/requests/[id]` (accept/decline, IDOR guard, serializable `$transaction` on accept with P2002 remap → idempotent 200), `DELETE /api/friends/requests/[id]` (cancel outgoing)
- **Friendship routes** — `GET /api/friends`, `DELETE /api/friends/[otherUserId]` (unfriend via `orderedPair`)
- **Panel & invite routes** — `GET /api/events/[id]/friends-going` (only mutual friends surface; empty array for common case), `POST /api/events/[id]/invite` (Pro-only, single `findMany` for mutual-friend check (was N+1), silent-drops non-friends, returns `{sent, droppedNonFriend, droppedEmailFailure}` distinguishing enumeration-safe drops from real Resend failures, rate-limited 10/hour per sender, NEXTAUTH_URL pre-flight guard)
- **Activity feed** — `GET /api/social/activity` (Pro-only, cursor-paginated, filters `event.isActive`, delegates to `lib/friends/activity.ts`)
- **Event-state extension** — `GET /api/users/me/event-state` now returns `{saved, going, isPro, pendingFriendRequests, friendCount}`; `EventStateProvider` exposes both new fields
- **Invite email** — `lib/email/templates/event-invite.tsx` (brand-register per iter-8 convention, links to `${NEXTAUTH_URL}/e/${eventId}`)
- **`app/(main)/friends/page.tsx`** — SSR, composed fetch, intelligent default tab (incoming pending > 0 → requests; else 0 friends → add; else friends), `?tab=` param overrides
- **Friends tab components** — `friends-tabs.tsx` (client shell with URL-state), `friends-tab.tsx` (list + unfriend confirm), `requests-tab.tsx` (incoming + sent, optimistic remove), `add-tab.tsx` (enumeration-safe email form; success alert reads identical regardless of outcome), `activity-tab.tsx` (grouped by day, cursor pagination via IntersectionObserver + fallback button, Pro upsell placeholder for FREE), `invite-friends-dialog.tsx`
- **`components/ui/tabs.tsx`** — new `data-slot` wrapper around `@base-ui-components/react/tabs`; underline is `bg-foreground` (not `bg-brand` — preserves orange-in-three-places commitment); `motion-reduce:transition-none` respects OS preference
- **`components/ui/avatar.tsx`** — new wrapper, FNV-1a-hashed deterministic muted-tint monogram fallback
- **`app/(public)/events/[id]/page.tsx`** — public SSR share page; uses shared `pickPrimarySource(sources)` helper (extracted to `lib/events/primary-source.ts` this iteration — feed and share now agree on the ticket URL); expired-event fallback (h1 + CTA only); `generateMetadata` with OG tags + `robots: { index: false, follow: true }`
- **EventDetailsPanel changes** — `FriendsGoingSection` inserted between description and venue (avatars only when count ≥ 3, text-only summary otherwise, section hidden entirely on empty array), `AddToCalendarMenu` renamed and expanded to **`ShareMenu`** (Copy link → separator → 3 calendar options → separator → Invite friends). Panel footer stays at four controls (Save · Going · Share · Get Tickets)
- **UserMenu** — pending-badge dot on trigger avatar; "Friends" popover link with count badge; reads `pendingFriendRequests` from `EventStateProvider`
- **`middleware.ts`** — matcher exclusion for both `/e/` and `/events/` (the latter is load-bearing because `/e/:id` internally rewrites to `/events/:id`); pre-existing routes still auth-gated
- **`next.config.ts`** — `rewrites()` mapping `/e/:id` → `/events/:id`
- **SYSTEM_ARCHITECTURE.md § Routes** — added 12 new route rows + updated `event-state` shape; **PRODUCT_REQUIREMENTS.md** status header updated

**Vitest coverage:** 580 tests / 43 files (was 482/35 after iter 8). New: `lib/friends/*` (pair, queries, activity, 5 route files), invite email template, event-state extension, `pickPrimarySource` boundary tests.

**Env vars needed:** none new (`RESEND_API_KEY`, `NEXTAUTH_URL`, Upstash Redis all set in prior iterations).

**Quality gate:** typecheck ✅ · lint ✅ · test ✅ (580/580 in 43 files) · build ✅ (32 routes)

**Review:** `code-reviewer` × 1 pass with browser-verification-attempted (local Postgres not running in reviewer's environment; middleware/routing verified live, DB-dependent flows verified against source + tests). **0 Critical + 5 High + 7 Medium + 6 Nitpick** — every High and every actionable Medium addressed in a single parallel fix round (`backend` + `frontend`). Highs closed: share page uses shared `pickPrimarySource` (was inconsistent alphabetical order); Add-tab copy locked to `they'll` contraction; `motion-reduce:` (was dead `@media` class); activity cursor ternary simplified; activity query extracted to `lib/friends/activity.ts` (was duplicated across SSR page + route). Mediums closed: N+1 invite check → single `findMany`; invite response shape split `dropped` into `droppedNonFriend` + `droppedEmailFailure`; activity filters `event.isActive`; rate-limit returns 429 with silent body (was 200 with dead client-side 429 branch); `friendCount` added to event-state. Full re-review skipped after orchestrator spot-check confirmed all Critical/High/Medium fixes landed at the cited file:line.

**Deviations from plan:**
1. **Pro upsell for "Invite friends" (free tier) uses a `Dialog` instead of a `Popover`** — nesting a Popover inside base-ui `DropdownMenu` caused z-index/portal-ordering issues. Same UX (blocks interaction, communicates the gate), lower layering risk. Documented as an accepted trade-off.
2. **`FriendsGoingSection` always fires the fetch on panel open in the merged state** — orchestrator's fix round added `friendCount` to `EventStateProvider` (backend side) but did not wire the consumer-side skip yet. Minor UX rough edge (skeleton flash for 0-friend users); trivial follow-up. Not blocking.
3. **`Button` still lacks a `destructive` variant** — the "Remove" ghost button and the Unfriend dialog's red button use inline classes. Reviewer flagged as scope-adjacent nitpick; adding the variant is a small hygiene follow-up.

**Accepted trade-offs:**
- **Invite email localizes to UTC** (matches reminder-email pattern from iter 8). Timezone-correct formatting is a cross-cutting change; when it lands it will fix both.
- **Activity feed is unpaginated on the "Sent" and "Incoming" request lists** — those lists are small in practice; pagination is a v2 concern if it becomes one.
- **No block/report mechanism.** A declined-then-re-sent friend request has no throttle beyond the general rate-limit. Iter-10 territory if needed.
- **Playwright smoke suite still not bootstrapped** — reviewer's environment could not reach the DB for a browser pass; static analysis + tests carried the review. The "sign in → add friend → accept as second user → see friend on details panel" flow is a strong first Playwright case whenever the suite lands.
- **Iter 7's timeOfDay UTC filter (H1 from iter 7 review)** still uses UTC hours; unchanged this iteration.

---

---

## Iteration 10 — Profile (Saved / Going / History tabs)

**Status:** Not started

**Owner:** `frontend` agent

**Scope:**
- `/profile` — tabbed layout: Saved, Going, Attendance History
- Attendance history = Going events whose `startTime` has passed (auto-derived)
- Reuses `EventCard` component from Iteration 7
- Optional: filter/sort within each tab

**Env vars needed:** none new

**Review:** `code-reviewer` — UI-only, but reviewer verifies expired-event display doesn't leak state

---

## Deferred / post-MVP

- Stripe integration for Pro subscriptions (schema is in place; UI + billing routes deferred)
- Advertisements (V1 free tier per PRD marks these as post-MVP)
- Push notifications
- Embedded maps
- Native mobile apps
- Reviews/ratings
- AI recommendations
- Playwright smoke suite (added iteratively as features ship; reviewer owns golden-path additions)
