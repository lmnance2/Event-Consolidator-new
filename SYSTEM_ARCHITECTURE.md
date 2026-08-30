# SYSTEM_ARCHITECTURE.md

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| ORM | Prisma |
| Database (dev) | PostgreSQL (local Docker or Neon dev branch) |
| Database (prod) | PostgreSQL (Neon) |
| Auth | Auth.js v5 (Google OAuth + Credentials) — JWT session strategy |
| Forms | react-hook-form + zod (shared client/server schemas) |
| Rate limiting | Upstash Redis (`@upstash/ratelimit`) |
| Email | Resend |
| Geocoding | OpenCage API (ZIP → lat/lng) |
| Meetup data | Apify (`filip_cicvarek/meetup-scraper`) |
| Hosting | Vercel |
| Cron | Vercel Cron |
| Testing | Vitest (`/lib` logic) + Playwright (smoke suite) |

> **Why Postgres in dev:** Prisma migrations are provider-specific and cannot be authored on SQLite then deployed to Postgres. SQLite also lacks enum support, which the schema relies on. Dev and prod must be the same provider.

---

## Directory Structure

```
/app
  /(auth)         # login, signup — unauthenticated
  /(main)         # feed, profile, settings — auth required
  /api
    /events       # feed + event detail endpoints
    /auth         # Auth.js handler
    /users        # profile + preferences endpoints
    /friends      # social endpoints
    /sync         # internal cron-triggered sync (CRON_SECRET protected)
    /notifications/reminders/process  # internal cron for email reminders

/components
  /ui             # shadcn/ui primitives
  /events         # EventCard, EventDetailsPanel
  /feed           # Feed, Filters, SearchBar
  /profile        # Saved, Going, AttendanceHistory
  /social         # FriendsList, ShareEvent

/lib
  /auth           # Auth.js config
  /db             # Prisma client singleton
  /providers      # ticketmaster.ts, eventbrite.ts, meetup.ts (Apify)
  /geo            # haversine.ts, geocode.ts
  /email          # send.ts + /templates (verify, reset, reminder)
  /sync           # pipeline orchestration + deduplication

/prisma
  schema.prisma
  /migrations
```

---

## Routes

| Route | Auth | Notes |
|---|---|---|
| `/` | No | Landing page (SSG) |
| `/login` | No | — |
| `/signup` | No | — |
| `/feed` | Yes | Main feed (SSR initial load + client infinite scroll) |
| `/profile` | Yes | Saved, Going, history tabs |
| `/settings` | Yes | Preferences + account |
| `/friends` | Yes | Tabbed surface: Friends, Requests (incoming + sent), Add, Activity (Pro). SSR composes friends + requests + activity (page 1) in one server call; tab state in `?tab=` param. Default tab is intelligent (incoming pending > 0 → requests; else 0 friends → add; else friends). |
| `/e/[id]` | No | Public event share URL. Internally rewrites to `/events/[id]` via `next.config.ts`. Both paths are excluded from the middleware auth matcher. |
| `/events/[id]` | No | Public event page (SSR). Renders event card + Get Tickets. Inactive/expired events show an "event has ended" fallback. `generateMetadata` sets OG tags and `robots: { index: false, follow: true }` (v1 decision, revisit before v2). |
| `GET /api/events` | Yes | Feed pagination endpoint. Shared query lives in `lib/events/feed-query.ts`; consumed by both the `/feed` Server Component (SSR page 1) and this route (client infinite scroll). Returns `FeedPage = { rows: FeedRow[], nextCursor: string \| null }` where `FeedRow` exposes `venueName` and `venueAddress` as separate fields — both currently set to `Event.venue` (single string), reserved for a future schema split without breaking UI callers. Client passes `?lat=&lng=` from sessionStorage; server prefers those over stored `User.lat/lng` for the query only (never persists them). Pro filter params are silently stripped for non-`ACTIVE` subscriptions before any DB work. |
| `GET /api/events/[id]/friends-going` | Yes | Returns `Array<{id, name, image}>` of the caller's friends who are marked Going for this event. Empty array is the common case; the panel suppresses the section entirely when empty. |
| `POST /api/events/[id]/invite` | Yes | Pro-only. Body `{ friendIds: string[] }`, max 20. Server silently drops non-mutual friends (anti-enumeration). Sends one Resend email per surviving recipient. Returns `{ sent, droppedNonFriend, droppedEmailFailure }`. Rate-limited (10/hour per sender). Refuses to send if `NEXTAUTH_URL` is unset (mirrors iter-8 reminder-cron guard). |
| `POST /api/friends/requests` | Yes | Body `{ email }`. Silent-success `{ ok: true }` on every 200 path (unknown email, self, existing friendship, existing PENDING either direction, true success). Never leaks recipient existence. Rate-limited tuple `email:senderId` (5/hour) + sender-only fallback (30/hour); rate-limit hits return **429** with the same silent body. |
| `GET /api/friends/requests` | Yes | Returns `{ incoming: RequestRow[], outgoing: RequestRow[] }`, each row `{id, createdAt, user: {id, name, image, email}}`. |
| `PATCH /api/friends/requests/[id]` | Yes | Body `{ action: "accept" \| "decline" }`. IDOR: rejects if `toUserId !== session.user.id` with generic 404. Accept path uses `$transaction` with `isolationLevel: Serializable`; upsert into `Friendship` via `orderedPair(a, b)` to enforce the `userAId < userBId` invariant. P2002 on the unique pair → idempotent 200. |
| `DELETE /api/friends/requests/[id]` | Yes | Cancel outgoing. IDOR: rejects if `fromUserId !== session.user.id`. Only allowed while status = PENDING. |
| `GET /api/friends` | Yes | Returns `[{id, name, image, friendsSince}]` (friendsSince = ISO 8601 `Friendship.createdAt`). Other-user perspective. |
| `DELETE /api/friends/[otherUserId]` | Yes | Unfriend. Derives pair via `orderedPair(session.user.id, otherUserId)`. Idempotent. |
| `GET /api/social/activity` | Yes | Pro-only. Cursor-paginated feed of friends' recent Going + Save actions (last 30 days). Non-Pro → 403. Shared query lives in `lib/friends/activity.ts`; consumed by both the `/friends` SSR page 1 and this route. Filters on `event.isActive`. |
| `GET /api/users/me/event-state` | Yes | Returns `{ saved, going, isPro, pendingFriendRequests, friendCount }`. Consumed by `EventStateProvider` mounted at `app/(main)/layout.tsx`. `pendingFriendRequests` powers the UserMenu badge; `friendCount` lets the panel skip the `friends-going` fetch when 0. |

---

## Authentication

**Credentials flow:** validate → check email uniqueness → bcrypt hash (cost 12) → create User (with geocoded lat/lng — fails fast with 400 if ZIP is unresolvable) → redirect `/feed` → location permission modal

Email verification is intentionally waived. `emailVerified` is left `null` for credentials signups so that `emailVerified != null` reliably signals "address proven via an OAuth provider." The `VerificationToken` table has been dropped from the schema. Re-introducing an Email/magic-link provider in the future would require re-adding the model + migration; the Prisma adapter does not require it unless that provider is registered.

**Google OAuth flow:** Google consent → Auth.js creates/links User → `events.createUser` seeds `UserPreferences` + `Subscription` (parity with Credentials path) → if new: prompt for ZIP code → redirect `/feed` → location permission modal

Route protection via Auth.js middleware on all `/(main)` routes. API routes call `auth()` and return `401` if no session.

**Config split (edge vs Node):** `lib/auth/config.edge.ts` is imported by `middleware.ts` — it holds only providers + cookie config, no Prisma adapter, no bcrypt (Node-only modules would crash the Edge runtime). `lib/auth/config.ts` is the full Node config used by the `[...nextauth]` handler and all `auth()` calls from Server Components / API routes. **Middleware does NOT verify `sessionVersion`** — revocation is enforced only at `auth()` call sites in the Node runtime. A revoked session survives one middleware pass but is rejected the moment any Server Component or API route calls `auth()`.

**Session strategy: JWT** (not database). The Credentials provider only supports JWT sessions in Auth.js v5 — database sessions are never created for credentials sign-ins, and strategy is global, so JWT applies to Google OAuth too. Consequences:

- Short `maxAge` (7 days) to bound the revocation window
- Subscription status and anything mutable is read from the DB per-request, never from the token
- Password reset bumps a `sessionVersion` field on User; the JWT callback rejects tokens with a stale version (poor-man's revocation)
- `emailVerified` is not exposed on the session — verification is waived; use provider identity (Google = verified, credentials = not) if gating is ever needed

**New Google users:** the JWT carries `session.user.needsZip = true` until the user submits a ZIP at `/onboarding/zip`. Middleware reads `req.auth.user?.needsZip` and redirects there before any other authenticated route. After the ZIP POST, the client calls `useSession().update()` to force a JWT re-hydration (the `jwt` callback's `trigger === "update"` branch re-reads the DB and clears the flag) before navigating to `/feed`.

**Password reset tokens** live in a dedicated `PasswordResetToken` model (not `VerificationToken`). Raw tokens are never stored — only their SHA-256 hash. Reset consumption uses an optimistic `updateMany({ where: { id, usedAt: null }})` atomic claim to prevent concurrent replay; bcrypt only runs on the winning claim.

**Rate limiting:** login, signup, and forgot-password endpoints are rate-limited via Upstash Redis (`@upstash/ratelimit`, sliding window). In-memory counters do not work on Vercel serverless. Signup carries two limiters — an `email:ip` tuple limiter and an IP-only fallback (30/min) — so a single IP rotating emails can't bypass the tuple limit.

---

## Event Sync Pipeline

Triggered by Vercel Cron every 6 hours → `GET /api/sync/run` (requires `CRON_SECRET`). Vercel Cron issues GET requests; the route handler exports `GET` accordingly.

```
For each provider (Ticketmaster, Eventbrite, Apify/Meetup):
  → Fetch paginated events
  → Normalize to internal EventSchema
  → Filter out past events

Deduplication:
  Phase 1 — within provider: upsert key = (provider, externalId)
  Phase 2 — cross-provider: match on title similarity ≥ 0.85 + start time ±2h + venue ±500m
             → keep canonical record (Ticketmaster > Eventbrite > Meetup)
             → store alternate ticketUrls on canonical

Cross-RUN dedupe: if a duplicate pair spans runs (e.g., a Meetup event ingested
last run is matched by a new Ticketmaster event), merge in one transaction:
  → re-parent the loser's EventSource rows to the canonical Event
  → re-parent SavedEvent / GoingEvent / EventReminder rows to the canonical
    (skip rows that would violate the (userId, eventId) unique constraint)
  → delete the loser Event row

Upsert to database → Cleanup (see below)
```

**Cleanup (attendance-history safe):**

```
Expired = endTime < now (fall back to startTime only when endTime is null,
          so in-progress and multi-day events survive)

Step 1 — soft delete: set isActive = false on expired events
          (feed queries filter isActive = true, so they disappear immediately)
Step 2 — hard delete: expired events with NO GoingEvent rows
          (events with Going references are kept forever — they ARE the
           attendance history; SavedEvent rows on expired events are deleted)
```

> Never cascade-delete an Event that has GoingEvent rows. The PRD derives attendance history from past Going events — hard-deleting them would erase it.

---

## Location

- **Granted:** `navigator.geolocation.getCurrentPosition()` cached in session storage
- **Denied:** ZIP code geocoded via OpenCage at signup, stored as `(latitude, longitude)` on User
- Distance calculation: Haversine formula at query time (not at ingestion)

**Distance filtering with Prisma (no raw SQL) + cursor pagination:**

Haversine cannot run inside a Prisma `where` clause. The feed query therefore:

1. Prefilters with an indexed lat/lng **bounding box** in Prisma (`latitude`/`longitude` between min/max derived from the radius)
2. Over-fetches ~3× the page size, ordered by `(startTime, id)` cursor
3. Refines with in-memory Haversine, drops out-of-radius rows
4. Repeats from the last row's cursor until the page is full or rows run out

The cursor is always the last *scanned* row (not last *returned*), so pagination stays stable despite post-filtering.

---

## Notifications

Reminder cron runs every 15 min → `GET /api/notifications/reminders/process`

```
On GoingEvent insert:
  → if event.startTime - 24h > now: create EventReminder { status: PENDING, sendAt }

On GoingEvent delete:
  → set EventReminder status = CANCELLED

Cron:
  → query EventReminder where sendAt ≤ now AND status = PENDING
  → send via Resend → set status = SENT (or FAILED)
```

**FAILED-as-sentinel design:** The cron atomically transitions claimed rows from `PENDING → FAILED` before sending, using `FAILED` as an in-flight sentinel (a `SENDING` state would require a schema change). On success the row is corrected to `SENT`; on Resend failure it stays `FAILED`, which is also the correct terminal state. The trade-off: a handler crash between claim and send permanently marks those reminders as `FAILED` with no retry — the reminder is lost for that run. This is acceptable given reminders are best-effort and Vercel Cron serializes invocations. A follow-up iteration could introduce a `SENDING` enum state to distinguish in-flight from terminal failure, enabling a retry window.

---

## Database Schema (Key Models)

Full Prisma schema lives in `/prisma/schema.prisma`. Core models:

- **User** — name, email, passwordHash, image (populated by OAuth providers), zipCode, lat/lng, locationPermission, sessionVersion (bumped on password reset to invalidate JWTs)
- **Account** — Auth.js required table (no Session table — JWT strategy). `VerificationToken` was dropped in `20260712163814_drop_verification_token` — the Prisma adapter only needs it when the Email/magic-link provider is registered, which it is not
- **PasswordResetToken** — dedicated model for password-reset flow (`tokenHash` SHA-256, `expiresAt`, `usedAt` for single-use enforcement)
- **UserPreferences** — disabledCategories (JSON), maxDistanceMiles, dateRangeDays, priceMin/Max, experienceType, familyFriendly
- **Subscription** — status, stripeCustomerId, stripeSubscriptionId, currentPeriodEnd
- **Event** — title, description, imageUrl, startTime, endTime, venue, lat/lng, price, isFree, category, performerName, isActive
- **EventSource** — eventId, provider, externalId, ticketUrl (unique on provider+externalId)
- **SavedEvent / GoingEvent** — userId + eventId join tables
- **EventReminder** — userId, eventId, sendAt, status
- **FriendRequest** — fromUserId, toUserId, status
- **Friendship** — userAId, userBId

---

## External Integrations

| Service | Purpose | Auth |
|---|---|---|
| Ticketmaster Discovery API | Event data | API key |
| Eventbrite API | Event data | Bearer token |
| Apify (`filip_cicvarek/meetup-scraper`) | Meetup event data | Apify API token |
| Google OAuth | Sign-in | OAuth client ID/secret |
| OpenCage | ZIP → lat/lng geocoding | API key |
| Resend | Transactional email | API key |

> **Meetup ToS note:** Meetup prohibits automated scraping in their ToS. The Apify scraper is a widely-used workaround given Meetup's deprecated free API. Monitor for enforcement; migrate to an official API if one becomes available.

---

## Deployment

- Single Vercel project, deploys from `main`
- `prisma migrate deploy` runs as a pre-deploy build step
- Preview deployments on all PRs

**Vercel Cron (`vercel.json`):**
```json
{
  "crons": [
    { "path": "/api/sync/run", "schedule": "0 */6 * * *" },
    { "path": "/api/notifications/reminders/process", "schedule": "*/15 * * * *" }
  ]
}
```

---

## Environment Variables

```
DATABASE_URL
NEXTAUTH_SECRET
NEXTAUTH_URL       # Production only — set to the canonical origin (e.g. https://yourapp.com).
                   # Leave UNSET in dev: Auth.js v5 auto-detects the origin from the request.
                   # Pinning to http://localhost:3000 while Turbopack picks a different port
                   # (e.g. 3006) redirects every auth callback to the wrong process.
                   # The config uses the NEXTAUTH_ prefix (v4-compat); AUTH_URL also works.
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
TICKETMASTER_API_KEY
APIFY_API_TOKEN                 # Used by both the Meetup and Eventbrite adapters.
APIFY_EVENTBRITE_ACTOR_ID       # Optional. Override for the Eventbrite Apify actor
                                # (default: automation-lab/eventbrite-scraper).
RESEND_API_KEY
OPENCAGE_API_KEY
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
CRON_SECRET
```

---

## Security Basics

- Prisma parameterized queries only — no raw SQL
- All secrets in server-only env vars (never `NEXT_PUBLIC_`)
- Cron endpoints validate `CRON_SECRET` header
- bcrypt cost factor 12 for passwords
- Signup/reset responses identical regardless of email existence (prevents enumeration)
- No `dangerouslySetInnerHTML` with user content
