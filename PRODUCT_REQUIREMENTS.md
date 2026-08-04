# PRODUCT_REQUIREMENTS.md

Event Atlas is a **discovery platform** — not a ticketing platform. It aggregates events from Ticketmaster, Eventbrite, and Meetup into a single personalized feed. Users discover events here; they buy tickets or RSVP on the original provider's site.

> **Current build status (2026-07-11):** Save, Going/RSVP, friends, reminder emails, and Pro-tier features are **not yet implemented** — the sections below describe the intended product. The landing page has been trimmed to stop promising these features until they ship. Currently shipped: aggregation feed, filters, ZIP-based location, credentials + Google auth, settings/preferences, provider ticket-link redirect.

---

## What It Is / Isn't

- Aggregates and deduplicates events from multiple providers into one feed
- Personalizes the feed through explicit user preferences (not hidden algorithms)
- Redirects users to the source provider for tickets — no payment handling
- **Not** an event creation tool, ticketing platform, or organizer dashboard

---

## Authentication

- Required for all features (unauthenticated users see landing page only)
- Supports: email/password and Google OAuth
- Collects at signup: name, email, password (if credentials), ZIP code
- After signup: prompt for browser geolocation; fall back to ZIP if denied

---

## Event Sources (V1)

Ticketmaster, Eventbrite, Meetup. Synced every 6 hours. Only future events are ingested. Expired events are removed from the feed (soft-deleted); those with Going references are retained for attendance history, the rest are hard-deleted.

---

## Categories (Fixed Taxonomy)

Music · Sports · Arts & Theater · Food & Drink · Networking · Health & Wellness · Outdoor & Adventure · Family Friendly · Community & Culture · Nightlife · Education · Other

Provider categories are normalized to this list at ingestion. All enabled by default; users can disable any.

---

## Feed

- Infinite scroll with search, filters, and event cards
- Clicking a card opens an inline event details panel (no page navigation)
- Default sort: soonest first
- Filter state lives in URL query params

**Event card shows:** thumbnail, title, date/time, distance, category, price, Save + Going buttons

**Event details panel shows:** hero image, title, description, date/time, price, distance, address, category, organizer, Maps links (Google + Apple), Save, Going, Add to Calendar, Ticket Link (opens provider in new tab)

---

## Search

Searches event title and performer name only. Filtering handles everything else. Always free.

---

## User Preferences

Stored per user; applied as feed defaults:

| Preference | Default |
|---|---|
| Enabled categories | All |
| Max distance | 25 miles |
| Date range | 30 days |
| Price range | Any |
| Experience type (indoor/outdoor) | Both |
| Family friendly | Off |

---

## Saved Events

Users bookmark events for later. **Free tier: max 5 saved at a time.** Pro: unlimited.

## Going

Marks intent to attend. Visible to friends. Triggers a reminder email 24 hours before the event. Cancelling Going cancels the reminder.

## Calendar

Export only (V1): `.ics` download, Google Calendar deep-link, Apple Calendar deep-link.

---

## Social (Friends)

**Free:** Send/accept friend requests, view friends' Going events, share an event via link.

**Pro only:** Invite friends to events, social activity feed.

---

## Notifications (V1, Email Only)

- Email verification (on signup)
- Password reset
- Event reminder (24h before Going events)

---

## Pro Plan

| Feature | Free | Pro |
|---|---|---|
| Discovery feed + search | ✓ | ✓ |
| Going + calendar export | ✓ | ✓ |
| Email reminders | ✓ | ✓ |
| Saved events | 5 max | Unlimited |
| Basic social (friends, Going visibility, share) | ✓ | ✓ |
| Friend invites + activity feed | — | ✓ |
| Multiple saved locations | — | ✓ |
| Advanced filtering | — | ✓ |
| Advertisements | Yes | No |

**Filtering tiers:**

- **Free filters:** category, max distance, date range, price range — the same knobs as User Preferences.
- **Advanced (Pro) filters:** experience type (indoor/outdoor), family friendly, free-events-only toggle, time-of-day (morning/afternoon/evening), specific venue.

Pricing TBD. Stripe integration deferred post-MVP. **Advertisements are deferred post-MVP** — no ad system in V1; the table row records the free/Pro contract only.

---

## Analytics

Attendance history auto-derived: any Going event whose start time has passed counts as attended. Self-service only — no sharing.

> Expired events with Going references are retained (soft-deleted from the feed, never hard-deleted) — they are the attendance history.

---

## V1 Non-Goals

Event creation · Ticket purchasing · User-generated events · Organizer dashboards · AI recommendations · Reviews/ratings · Native mobile apps · Push notifications · Embedded maps
