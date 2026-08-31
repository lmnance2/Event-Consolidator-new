# Event Atlas

A personalized discovery feed that aggregates and deduplicates local events from **Ticketmaster, Eventbrite, and Meetup** into a single, filterable stream. Users find events here and are redirected to the source provider for tickets — Event Atlas is discovery, not ticketing.

**Live:** https://event-atlas-e39o58xjh-liam-nances-projects.vercel.app/

---

## What's built

- **Aggregation pipeline** — Three provider adapters (direct Ticketmaster API + two Apify actors for Eventbrite/Meetup) normalize events into a shared schema, deduplicate cross-provider (title similarity + ±2h + 500m radius), and upsert into Postgres. Currently ingesting ~6,000 upcoming events across five US metros (NYC, LA, Chicago, SF, Austin).
- **Personalized feed** — Infinite-scroll grid with search, category filters, distance/date/price range, and Pro-tier advanced filters (experience type, family-friendly, time-of-day, venue). Distance sort via Haversine against the user's ZIP-geocoded location. Feed query is shared between the SSR initial page and the client-side pagination endpoint.
- **Authentication** — Auth.js v5 with Google OAuth and email/password (Credentials), JWT session strategy, session-version invalidation, and rate-limited signup/forgot-password flows backed by Upstash Redis.
- **Save + Going** — Bookmark events (free tier capped at 5, enforced server-side), mark intent to attend, download `.ics` / open Google or Apple Calendar, and receive an email reminder 24h before the event via a cron-triggered worker.
- **Social** — Friend requests, accept/decline, view friends' Going events, share an event via public `/e/[id]` URL. Pro-only: invite friends to events (rate-limited, anti-enumeration silently drops non-mutual friends) and social activity feed.
- **Cron pipeline** — Ticketmaster syncs every 2 days (free API), Eventbrite + Meetup every ~2 weeks (Apify credit budget), cleanup runs daily to soft-delete past events and hard-delete those without Going references. Reminder dispatch runs every 15 min via a GitHub Actions cron pinging the Vercel endpoint (Vercel Hobby caps at daily; GitHub Actions is free and 15-min capable).
- **Test coverage** — 582 tests across 43 files (Vitest) covering provider normalization, dedupe logic, rate limiters, JWT session versioning, reminder scheduling math, feed query filters, and API route contracts.

---

## Tech stack

| Layer          | Choice                                                                 |
| -------------- | ---------------------------------------------------------------------- |
| Framework      | Next.js 16 (App Router, Turbopack)                                     |
| Language       | TypeScript (strict)                                                    |
| UI             | Tailwind CSS v4, shadcn/ui, base-ui                                    |
| Database       | PostgreSQL (Vercel Postgres in prod, local Docker in dev)              |
| ORM            | Prisma 6                                                               |
| Auth           | Auth.js v5 (JWT) — Google OAuth + Credentials                          |
| Rate limiting  | Upstash Redis (`@upstash/ratelimit`)                                   |
| Email          | Resend (React Email templates)                                         |
| Geocoding      | OpenCage (ZIP → lat/lng)                                               |
| Event data     | Ticketmaster Discovery API (direct), Apify actors (Eventbrite, Meetup) |
| Testing        | Vitest, Playwright                                                     |
| Hosting        | Vercel                                                                 |
| Sub-daily cron | GitHub Actions (workaround for Vercel Hobby's daily-min cron cap)      |

---

## Architecture highlights

- **Shared feed query.** `lib/events/feed-query.ts` is consumed by both the `/feed` Server Component (SSR page 1) and the `GET /api/events` pagination route. Business-rule filters (Pro-tier gates, distance, categories) live in one place — no drift possible between initial load and infinite scroll.
- **Per-request `auth()` dedupe.** Wrapped `auth()` in `react.cache()` so layout + page don't each trigger a JWT decode + `prisma.user.findUnique` for the session-version check.
- **`staleTimes` for client nav.** Next 15's default `staleTimes.dynamic = 0` re-fetches RSC payloads on every navigation. Set to 30s so back/forward and cross-tab navigation is near-instant.
- **Cross-provider dedupe.** Two-stage: within-run dedupe on new events, then cross-run reconciliation. Titles compared via Jaro-Winkler with time (±2h) and geo (500m) windows.
- **Attendance history preservation.** Cleanup soft-deletes expired events first, then hard-deletes only rows with no `GoingEvent` references. `onDelete: Restrict` on the FK is belt-and-suspenders against accidental history loss.
- **Reminder claim-and-send.** Serializable transaction moves `PENDING → FAILED` as a claim sentinel before sending (no `SENDING` enum), then flips to `SENT` on success. Idempotent under concurrent workers, and crashes between claim and send leave the row in the correct `FAILED` terminal state.

---

## Local setup

**Prerequisites:** Node 20+, pnpm 10+, PostgreSQL 14+ (local Docker is fine), and accounts for Google OAuth, Resend, Upstash Redis, OpenCage, Apify, and Ticketmaster.

```bash
# 1. Install deps
pnpm install

# 2. Copy env template and fill in every var
cp .env.example .env

# 3. Apply Prisma migrations to your local Postgres
pnpm prisma migrate dev

# 4. Start dev server
pnpm dev
```

Open http://localhost:3000. Sign up, enter a US ZIP code, and the feed will populate once the sync runs (or trigger it manually — see below).

### Required environment variables

| Var                                         | Purpose                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`                              | Postgres connection string                                                |
| `NEXTAUTH_URL`                              | `http://localhost:3000` in dev, prod URL in prod                          |
| `NEXTAUTH_SECRET`                           | Generate with `openssl rand -base64 32`                                   |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console OAuth client                                         |
| `RESEND_API_KEY`                            | Transactional email                                                       |
| `OPENCAGE_API_KEY`                          | ZIP → lat/lng geocoding                                                   |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN`         | Rate limiters                                                             |
| `CRON_SECRET`                               | Bearer token for `/api/sync/*` and `/api/notifications/reminders/process` |
| `TICKETMASTER_API_KEY`                      | Discovery API                                                             |
| `APIFY_API_TOKEN`                           | Runs Eventbrite + Meetup actors                                           |
| `APIFY_EVENTBRITE_TASK_ID`                  | (Optional) override the default Eventbrite Apify task                     |

### Triggering a sync manually

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/sync/run?providers=TICKETMASTER"
```

Providers param accepts `TICKETMASTER`, `EVENTBRITE`, `MEETUP`, or a comma-separated combination. Omit to sync all three.

### Quality gate

Before opening a PR:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## Future additions

- **Stripe billing** to activate the Pro tier gates (currently everyone is on Free)
- **Push notifications** as an alternative to reminder email
- **Additional metros + international support** (currently only 5 US metros are seeded in provider adapters)
- **Native mobile clients** (React Native), sharing the API and auth layer
- **AI-assisted recommendations** on top of the explicit preference model
- **Multi-location Pro feature** — save several ZIPs (work + home + travel) and switch feeds
- **In-app maps** for event discovery by area
- **Reviews and ratings** on attended events

---

## Project structure

```
app/
  (auth)/        # login, signup, forgot/reset password
  (main)/        # feed, friends, settings — auth required
  (public)/      # public event share URL (/e/[id])
  api/           # route handlers (auth, events, sync, cleanup, reminders, ...)
components/      # UI primitives + feature components
lib/
  auth/          # Auth.js v5 config, password + token utils, rate limiters
  db/            # Prisma singleton
  events/        # feed-query.ts (shared SSR + client), format helpers
  friends/       # friendship + activity queries
  geo/           # Haversine + geocode
  email/         # Resend send + React Email templates
  providers/     # ticketmaster.ts, eventbrite.ts, meetup.ts, timezone.ts
  sync/          # run.ts, dedupe.ts, cleanup.ts
  subscription/  # is-pro.ts, save-limit constants
prisma/
  schema.prisma
  migrations/
scripts/
  playwright/    # ad-hoc smoke scripts (auth flow, DB counts, sync trigger)
.github/
  workflows/reminders-cron.yml   # 15-min reminder cron
vercel.json                       # Vercel cron schedule
```

For the full product spec, see [`PRODUCT_REQUIREMENTS.md`](./PRODUCT_REQUIREMENTS.md). For architecture depth (routes, DB schema, ingestion pipeline), see [`SYSTEM_ARCHITECTURE.md`](./SYSTEM_ARCHITECTURE.md).
