# Event Atlas — Playwright walkthrough issues (2026-07-11)

Tester: Claude (Playwright + code inspection).
Environment: local `pnpm dev`, `.env.local` populated, dev server auto-selected port `3006` because another Next.js process already held `:3000`. All API keys (Ticketmaster, Eventbrite, Apify) were set in `.env.local`.

Issues are grouped by severity. Each entry gives a repro, evidence, and a suggested fix. Line references reflect the code as of this pass; verify before dispatching.

---

## 🔴 Critical

### 1. Ticketmaster provider returns HTTP 400 on every metro — 0 events ever ingested

- **Where:** `lib/providers/ticketmaster.ts:171` (inside `fetchPage`)
- **Repro:** Hit `GET /api/sync/run` with the cron secret. Response says `TICKETMASTER.status: "ok"` but `fetched: 0`. Server log shows:
  ```
  {"event":"ticketmaster.fetch_error","metro":"NYC","page":0,"error":"Error: [ticketmaster] HTTP 400 fetching page 0","action":"abort_metro"}
  ```
  … for every metro.
- **Root cause:** `url.searchParams.set("startDateTime", new Date().toISOString())`. `Date.toISOString()` returns `YYYY-MM-DDTHH:mm:ss.sssZ`. Ticketmaster's Discovery API rejects the fractional seconds and returns 400. Confirmed by curl:
  - `2026-07-12T02:54:05.606Z` → **400**
  - `2026-07-12T02:54:05Z` → **200**
- **Suggested fix:** Strip milliseconds before sending, e.g.:
  ```ts
  const startDateTime = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  url.searchParams.set("startDateTime", startDateTime);
  ```

### 2. Meetup (Apify) provider fails on every metro — actor input shape is wrong

- **Where:** `lib/providers/meetup.ts:253-256`
- **Repro:** Same sync run. Server log shows for every metro:
  ```
  Error: Provide either `lat` + `lon`, or a `city` (and optionally `state`/`country`) to search.
      at /usr/src/app/src/main.js:156:15
  ```
- **Root cause:** The adapter passes `{ searchTerm: metro.searchTerm, maxResults: 200 }` to the `filip_cicvarek/meetup-scraper` actor, but the actor's input schema expects `city` (or `lat`+`lon`), not `searchTerm`. Actor runs fail immediately with status `FAILED`, and the adapter reports `status: "ok"` overall (see Issue #4).
- **Suggested fix:** Change to the actor's real input shape — either `{ city: metro.searchTerm, maxItems: 200 }` (verify the exact param name in the actor's README) or `{ lat, lon, maxItems }`. Consider using `context7` on `filip_cicvarek/meetup-scraper` to confirm the expected input.

### 3. Eventbrite provider hits `HTTP 404` on every metro — endpoint is deprecated

- **Where:** `lib/providers/eventbrite.ts:5` (`BASE_URL = "https://www.eventbriteapi.com/v3/events/search/"`)
- **Repro:** Same sync run. Log:
  ```
  {"event":"eventbrite.fetch_error","metro":"NYC","page":1,"error":"Error: [eventbrite] HTTP 404 fetching page 1","action":"abort_metro"}
  ```
- **Root cause:** Eventbrite retired the public `/v3/events/search/` endpoint in December 2019. Only paying "distribution partners" have any equivalent access. The current adapter can never work.
- **Suggested fix:** Product decision required — either
  1. Drop Eventbrite from the provider list until (or unless) the org secures partner access, or
  2. Replace with a legitimate data source (Eventbrite's remaining organizer-scoped `/v3/users/me/events/` if you own the events, or a scraping strategy behind an Apify actor). Do not ship the adapter as-is; it wastes time and gives the false impression of coverage.

### 4. Sync reports `providers.*.status: "ok"` even when every metro aborted with zero events

- **Where:** `lib/sync/run.ts:103-151`
- **Symptom:** Sync summary claims success (`{ status: "ok", fetched: 0, ... }`) even when `TICKETMASTER` had 5/5 metros throw, `EVENTBRITE` 5/5, and `MEETUP` 5/5. `status: "aborted"` is only set when the outer `try` catches (i.e., the whole `for await` generator throws before yielding anything), but the generator swallows per-metro errors internally.
- **Impact:** Vercel cron logs will show `ok: true` even when ingestion is completely broken. Zero observability. This is what let Issues #1–3 survive.
- **Suggested fix:** Bubble the per-metro failure state up. Either:
  - Track `metroFailures` in each adapter and expose them on the yielded/returned counts, or
  - Have `runSync` treat `fetched === 0` for any provider as a soft alarm (write to a `SyncRun` metrics table and/or fail the request when *every* provider has 0 across *every* metro).
  Additionally consider a hard failure (`return 500`) when the overall run produces 0 new events for N consecutive attempts, so the cron alerts.

### 5. Signup bypasses email verification but the verification flow still exists

- **Where:** `app/api/auth/signup/route.ts:68` sets `emailVerified: new Date()` unconditionally.
- **Also inconsistent:** `SessionProvider`/session shape reports `emailVerified: null` while the DB row has a real date — see Issue #10.
- **Impact:** Anyone can register with `presidentbiden@whitehouse.gov` and the account is trusted. `/verify-email`, `/api/auth/verify-email`, and the verified-banner path in `login-form.tsx:74` are dead code shipped in the bundle.
- **Suggested fix:** Pick one path and commit to it:
  1. **If verification is required (recommended):** Remove the `emailVerified` assignment from signup; make the signup route enqueue a `VerificationToken` and call the same Resend template the reset flow uses; block sign-in for unverified users at the credentials provider level.
  2. **If verification is intentionally waived:** Delete `/app/verify-email`, `/app/api/auth/verify-email`, the `verified=1` alert branch in `login-form.tsx`, and drop `VerificationToken` from Prisma. Update `PRODUCT_REQUIREMENTS.md` to reflect the actual product.

### 6. `NEXTAUTH_URL` is hardcoded to `http://localhost:3000` and dev breaks whenever port bumps

- **Where:** `.env.local` (`NEXTAUTH_URL="http://localhost:3000"`)
- **Repro:** In this session `pnpm dev` auto-selected port `3006` (3000 was busy). Sign-out from `/settings`, then sign-in — both redirect to `http://localhost:3000/` and `http://localhost:3000/login`, which are not our dev process. Signup/login *appears* successful on 3006 but subsequent redirects escape the process, so the user thinks the flow is broken.
- **Suggested fix:** Prefer Auth.js's automatic origin detection (leave `NEXTAUTH_URL` unset in dev; Auth.js v5 reads from the request in dev mode) or set it from the resolved port. Add a `README.md`/`SYSTEM_ARCHITECTURE.md` note that if you must pin port 3000, `next dev -p 3000` should be scripted so the port never drifts. In production, hardcode to the real URL.

### 7. Save & RSVP functionality is missing — a core PRD feature is unbuilt

- **Where:** No `components/events/*` exist (`components/events/` is empty). `app/api/friends/` is empty (`.gitkeep` only). `app/api/notifications/reminders/process/` is empty (`.gitkeep` only). `components/feed/event-details-panel.tsx` only exposes a "Get Tickets" outbound link — no save button, no RSVP/going toggle.
- **Impact:** `PRODUCT_REQUIREMENTS.md` sells "Save up to five events on the free plan. Going gets you an email twenty-four hours before doors open" — but there is no way to save, no way to RSVP, and no reminder cron route to send those emails. Landing page copy makes a promise the app cannot keep.
- **Suggested fix:** This is a scope decision. Either:
  1. Build it: schema (`SavedEvent`, `Rsvp`), endpoints (`POST/DELETE /api/events/[id]/save`, `POST/DELETE /api/events/[id]/going`), the reminder cron (`GET /api/notifications/reminders/process` under `CRON_SECRET`), UI on the details panel, saved/going tabs on the feed, subscription-tier check for the 5-save limit.
  2. Cut the copy on the landing page and remove the placeholder folders/`.gitkeep`s until it ships. Do not leave dead placeholders that suggest partial work.

---

## 🟠 High

### 8. Login form gets stuck on "Signing in…" and shows no error on wrong password

- **Where:** `components/auth/login-form.tsx:45-59`
- **Repro:** On `/login`, enter a valid email + wrong password → submit. Button locks to "Signing in…" and stays disabled indefinitely. No error banner appears. In this session the actual failure was masked by Issue #6 (Auth.js also redirected the failed callback to `localhost:3000`), but even absent that, `signIn(..., { redirect: false })` calls with an invalid credential can resolve to `res.ok === false` *plus* a URL-based error, and the current code path never re-enables the button because `router.push(res.url ?? '/feed')` on failure would still try to navigate.
- **Suggested fix:** Explicitly branch on `res?.error` (Auth.js sets this on failure):
  ```ts
  if (res?.error || !res?.ok) {
    setFormError("Wrong email or password.");
    return; // isSubmitting resets when handler returns
  }
  router.push(res.url ?? "/feed");
  ```
  Also add a top-level `try/catch` so a thrown fetch error (e.g., wrong port) doesn't leave the form stuck.

### 9. Signup form has the same "stuck submit" pattern

- **Where:** `components/auth/signup-form.tsx:41-77`
- **Repro:** Fill valid signup and submit. In this run, `POST /api/auth/signup` and the follow-up `signIn(...)` both returned 200 in ~30s, but the button stayed on "Creating account…" for a long time and only unstuck after I triggered a manual fetch. Turbopack cold-compile is a contributor, but the form has no timeout, no reset-on-failure, and no error surface if `signIn` throws.
- **Suggested fix:** Wrap the whole `onSubmit` in `try/catch/finally`. On success, prefer `router.push` + `router.refresh` so RSC caches invalidate. Consider a `signal: AbortSignal` and a 15s timeout so the button can't hang forever.

### 10. Session `emailVerified` field is always `null` even after DB verification

- **Where:** likely in `lib/auth/*` JWT/session callbacks
- **Repro:** After signup, `GET /api/auth/session` returns `"emailVerified": null` for a user whose DB row has `emailVerified = <timestamp>`. The session shape is exposed to gating logic.
- **Impact:** Any client-side code that gates on `session.user.emailVerified` (or that trusts the session value) is silently broken. If Issue #5 is fixed by requiring verification, this will start blocking legitimate users.
- **Suggested fix:** In the JWT callback, on initial sign-in load `user.emailVerified` from the DB and copy it onto the token; in the session callback, expose it on `session.user`. Do the same for `sessionVersion` if you're using it for token invalidation (see `app/api/auth/verify-email/route.ts:60`).

### 11. Feed does not require a user location before rendering — SSR/CSR mismatch masks the failure

- **Where:** `app/api/events/route.ts:160-162` returns `{ error: "Location required" }` with status 400 when both `originLat` and `originLng` are missing.
- **Repro:** Sign up with a valid ZIP (which triggers `geocodeZip`). If the geocoder returns null (silent failure — happens whenever the Google Geocoding key is missing or the ZIP resolves outside the US), the user gets to `/feed`, is prompted with the location modal, chooses "Use ZIP code instead", and then the feed API returns 400 forever. There is no UI surface for that error — only the generic empty state.
- **Suggested fix:** Two things:
  1. In signup/onboarding, if `geocodeZip` returns null, fail the flow with a clear error ("Couldn't find that ZIP") instead of silently storing `latitude: null, longitude: null`.
  2. In the feed page, if `originLat/originLng` is null and the user picked "Use ZIP code", route them to `/settings` with a targeted banner explaining the ZIP couldn't be resolved.

### 12. `/verify-email` is a static page — it doesn't actually invoke verification

- **Where:** `app/verify-email/page.tsx`
- **Repro:** Visit `/verify-email?token=<anything>`. The page ignores `token` and always shows "Check your email". The real verification happens at `/api/auth/verify-email` — but if a user paste-clicks the wrong URL, or a stale email links to `/verify-email?token=…` instead of `/api/auth/verify-email?token=…`, nothing gets verified and nothing errors.
- **Suggested fix:** Either make the page a server component that reads `token` and does the verification (redirect to the API on the server), or remove the `?token=` reading confusion by explicitly documenting the flow. Given #5, consider deleting this whole page.

---

## 🟡 Medium

### 13. "Family Friendly" appears as both a Category and a Pro-only filter — semantic collision

- **Where:** `components/feed/filter-popover-category.tsx` + `components/feed/filter-popover-family.tsx`, mirrored on `app/(main)/settings/page.tsx`
- **Repro:** On `/feed`, open Category → "Family Friendly" is a category checkbox. Then a separate "Family friendly" chip is offered as a Pro-only global filter. In Settings, both live side by side.
- **Impact:** Users can't tell what "family friendly" means — is it a taxonomy of events, or a global filter that overrides category? The intent is presumably "the category tags what the event is, the filter drops any non-family-friendly result across categories," but the UI does not communicate that at all.
- **Suggested fix:** Either rename the Pro filter to something like "Family safe only" (make it an inclusion mode, not a category), or move family-friendly-ness out of `Category` into a separate boolean field on `Event`. Update PRD accordingly.

### 14. Empty-state "Reset filters" button triggers an accessibility warning

- **Where:** `components/feed/empty-state.tsx` (via `components/ui/button.tsx`)
- **Symptom:** Every load of `/feed` (with 0 events) logs:
  ```
  Base UI: A component that acts as a button expected a native <button> because the `nativeButton` prop is true. Rendering a non-<button> removes native button semantics…
  ```
- **Root cause:** The empty state renders a link-styled control through Base UI's Button without a native `<button>` element while `nativeButton` is true. Assistive tech will fail to treat it as a button.
- **Suggested fix:** Pass `nativeButton={false}` when the child is not a real `<button>`, or (better) ensure the "Reset filters" control is a real `<button>` element in JSX.

### 15. Filter defaults default to "everything selected" — no filtering happens

- **Where:** `app/(main)/settings/page.tsx` and default seed in `prisma/*` seed logic.
- **Repro:** New account has ALL 12 categories preselected — same as "no filter." First-time user gets a firehose and the whole "filters set once, not every scroll" landing promise fails.
- **Suggested fix:** Seed sensible starter categories on account creation (e.g., Music, Arts & Theater, Food & Drink) OR force the user through a "pick what interests you" onboarding step after ZIP.

### 16. Login page lacks the "Show password" toggle that Signup has

- **Where:** `components/auth/login-form.tsx:111-125` uses `<Field type="password">`; `components/auth/signup-form.tsx:127-133` uses `<PasswordField>`.
- **Impact:** Users mistyping their password have no way to reveal it. Especially frustrating on mobile after a signup that had one.
- **Suggested fix:** Swap `Field` for `PasswordField` on the login form.

### 17. Delete-account, sign-out, and forgot-password flows lack a confirmation step

- **Where:** `app/(main)/settings/page.tsx` renders the Delete button without a confirm modal (I did not click it — the auto-mode classifier blocked me — but the tree exposes a bare `<button>` labeled "Delete account" with no `AlertDialog` around it based on inspection).
- **Suggested fix:** Wrap Delete in an `AlertDialog` from shadcn, require typing "delete" or the account email, and only then POST `/api/users/me`.

### 18. `signInRes?.ok === false` in signup falls through to `router.push("/login")` — the user is silently redirected with no context

- **Where:** `components/auth/signup-form.tsx:72-76`
- **Repro:** Signup succeeds server-side but the credentials sign-in fails for any reason (network flake, race with password hash, etc.). The user is bounced to `/login` with no explanation.
- **Suggested fix:** Push to `/login?verified=1&reason=account-created` (or similar) so the login page can render a "Account created, sign in to continue" toast.

### 19. Location modal on `/feed` blocks first render but there is no "skip / decide later" affordance

- **Where:** `components/feed/location-permission-modal.tsx`
- **Repro:** First time on `/feed`, modal shows "Use precise location" / "Use ZIP code instead". There is no explicit dismiss (no Escape close, no X). Keyboard users have to Tab to a button.
- **Suggested fix:** Add explicit close/skip that defaults to ZIP; ensure `Escape` closes it (falling back to ZIP).

---

## 🟢 Low / Nitpick

### 20. Signup form field name mismatch is fine but easy to break

- **Where:** `signup-form.tsx` uses `zipCode` (camelCase) which matches the API. Just noting: any refactor that lowercases keys will silently break the signup schema validation. Consider a shared Zod schema between the form and the API route.

### 21. `.playwright-mcp/` output is untracked but should probably be gitignored

- **Where:** repo root — `.playwright-mcp/` appears in `git status` as untracked.
- **Suggested fix:** Add `.playwright-mcp/` to `.gitignore` if it's a local artifact directory (it looks like a screenshot/snapshot log dump).

### 22. All `landing-*.png`, `signup-desktop.png`, `verify-email*.png`, `settings-*.png`, `forgot.png`, `reset-no-token.png`, `login-check.png` sit in the repo root

- **Where:** repo root.
- **Impact:** Looks like screenshots left over from a design pass. They're not `public/` assets, they're not referenced by the app, and they inflate every clone.
- **Suggested fix:** Move to `docs/screenshots/` or delete. Update `.gitignore` for future.

### 23. Feed empty-state suggests "Reset filters" even when no filters are set

- **Where:** `components/feed/empty-state.tsx`
- **Impact:** New user sees empty feed (Issue #1–4 mean this happens by default), the empty state suggests resetting filters — but they haven't set any. Confusing.
- **Suggested fix:** Only render "Reset filters" when there are non-default filter values; otherwise show a "The next sync will pull events near {ZIP}" hint.

### 24. Extremely long Turbopack compile blocks the perceived-latency of every fresh route

- **Where:** dev only. First-touch on `/signup` took 46s, `/feed` took 20s, initial POST to `/api/auth/signup` took 19.7s.
- **Impact:** Not a shipped bug, but every "form stuck" report from a dev tester is going to be confused with real bugs (Issues #8 and #9 above).
- **Suggested fix:** Warm the critical routes with a `next dev` pre-render script or add a "Preparing your account…" progress copy that lasts >5s so users don't panic. Long term, keep an eye on Turbopack cold-compile times as they've improved release over release.

---

## Not yet tested (out of scope for this pass)

- Google OAuth signup / login path
- `/onboarding/zip` interactive flow (only inspected code — blocked by Issue #6 port confusion)
- Delete-account POST (blocked by auto-mode classifier; correctly)
- Password-reset happy path (would require live email inbox)
- Rate-limiting behavior on `/api/auth/signup` and `/api/auth/forgot-password` (would require repeated hits)
- Concurrent sync-run behavior / cleanup cron under real event volume
