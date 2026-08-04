# CLAUDE.md — Event Atlas AI Workflow

## What This App Is

Event Atlas is a **web-based event discovery platform** that aggregates events from Ticketmaster, Eventbrite, and Meetup into a single personalized feed. Users discover events, save/RSVP to them, and get redirected to the original provider for tickets. It is **not** a ticketing platform.

Stack: Next.js 15 App Router · TypeScript · Tailwind CSS v4 · shadcn/ui · Prisma · PostgreSQL (dev + prod — same provider, required by Prisma migrations) · Auth.js v5 (JWT sessions) · Resend · Upstash Redis · Vercel

---

## Reference Documents

Always read the relevant document before starting any task:

| Document                  | Read When                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| `PRODUCT_REQUIREMENTS.md` | Clarifying what a feature should do, what's in/out of scope, free vs Pro tier rules         |
| `SYSTEM_ARCHITECTURE.md`  | Building anything — routes, auth, sync pipeline, integrations, env vars, DB schema overview |

---

## Design Directions

- **Aesthetic:** Premium, venture-backed startup feel — clean, professional, engaging. Not generic corporate SaaS.
- **Light mode default** with crisp typography and clear visual hierarchy
- Designed with both mobile and desktop in mind
- **Micro-interactions** for filtering, searching, expanding event cards — smooth, non-distracting
- **Data-dense clarity** — scanning events, dates, and categories should be effortless
- **Accessible** — WCAG AA contrast, keyboard-navigable, readable font sizes

---

## Orchestration Workflow

You are the **orchestrator**. First triage the task into a tier — the full pipeline is not proportional for every change:

| Tier | Examples | Process |
| --- | --- | --- |
| **Trivial** | Copy changes, class tweaks, one-line fixes, config values | Orchestrator edits directly. Self-check against the relevant `.claude/agents/*.md` rules. Run the quality gate (below). No spawns. |
| **Standard** | A new component, a new route, a schema field | Spawn the relevant specialist → quality gate → spawn `code-reviewer`. Skip the design skills unless the UI is genuinely new. |
| **Complex / security-sensitive** | New features, anything touching auth, user data, payments, cron, provider adapters | Full pipeline below, including design skills for new UI. Reviewer is **non-negotiable** at this tier regardless of size. |

For standard and complex tasks:

```
1. Read relevant docs (PRODUCT_REQUIREMENTS.md and/or SYSTEM_ARCHITECTURE.md)
2. Ask any clarifying questions that would meaningfully change the approach
3. Create and present a concise implementation plan; wait for approval
4. Spawn the named specialist agents to execute (see below)
5. Quality gate: run `npx tsc --noEmit` and lint BEFORE spawning the reviewer —
   never pay for a review of code that doesn't compile
6. Spawn the code-reviewer agent — correctness, adherence, security, and (for
   UI-touching changes) the single thorough browser verification pass
7. Dispatch fixes from the review back to the responsible specialist
8. Re-review after fixes if any Critical or High findings were addressed
```

Never implement before presenting a plan on non-trivial tasks. Anything touching auth, user data, payments, cron endpoints, or provider adapters always gets the code-reviewer, even if the diff is tiny.

---

## Subagents — When and How to Spawn

Specialist agents are **defined in `.claude/agents/`** and spawned **by name** (`subagent_type: frontend`, `backend`, `database`, `auth`, `sync`, `code-reviewer`). Never spawn a generic `claude` agent and paste an agent file into it — the definitions load automatically. If a named agent isn't available, verify with `/agents` before falling back to a generic spawn.

Agent files hold **rules and boundaries**; the docs hold **facts** (routes, schema, pipeline specs). When briefing an agent, point it at the doc section — don't paste the doc.

### frontend

**When:** Any UI work — new pages, components, layout changes, styling

**Process for genuinely new UI (complex tier):**

1. Ask clarifying questions if the request is ambiguous
2. Load `/ui-ux-pro-max` to design the component/page approach
3. Load `/impeccable` to critique and refine the design plan
4. **Write the final design plan to `docs/plans/<feature>.md`** — component names, layout behavior, color/spacing decisions, interaction states, shadcn/ui components
5. Spawn `frontend` with the plan's file path — the agent reads it; do not paste the plan into the prompt

For changes to existing UI (standard tier), skip the design skills — brief the agent directly with the change and the affected files.

### backend

**When:** API route handlers, server actions, business logic, data fetching

**Brief with:** the specific route(s), which doc sections apply (routes table, schema overview), the business rules in play (e.g., free tier save limit), and auth requirements.

### database

**When:** Prisma schema changes, new models, migrations, index additions

**Brief with:** what model/field is changing, its relations, and the migration name. The agent uses the `prisma` plugin tools for live schema awareness.

### auth

**When:** Auth.js config, OAuth setup, session/JWT handling, route protection middleware

**Brief with:** a pointer to `SYSTEM_ARCHITECTURE.md` § Authentication. Credentials and Google OAuth flows differ in ZIP code collection; session strategy is JWT (Credentials provider requires it).

### sync

**When:** Event ingestion pipeline, provider adapters (Ticketmaster/Eventbrite/Apify), deduplication, cleanup cron, and the reminder-email cron

**Brief with:** a pointer to `SYSTEM_ARCHITECTURE.md` § Event Sync Pipeline and § Notifications. The agent uses `context7` tools for provider API docs.

### code-reviewer

**When:** After specialist work at standard tier and above — always for security-sensitive work (auth, user data, payments, cron endpoints, provider adapters).

**What it does:** Structured review across **correctness**, **conciseness / adherence to the three docs**, and **security** (data leaks, PII, injection, IDOR, auth bypass, secret exposure). It never edits code. For UI-touching changes it performs the **single thorough browser verification pass** — implementers only smoke-test; the reviewer owns deep verification. (It needs run/browser tools for this despite being "review-only" in spirit — don't restrict its tools to read-only.)

**Brief with:**

- The files changed (`git diff` paths — not the full diff)
- Which specialist implemented it (so the right boundary rules get enforced)
- Constraints the implementer flagged in their report

**Output:** Critical / High / Medium / Nitpick findings with `file:line`, why it matters, and a fix direction. The orchestrator dispatches findings to the responsible specialist — the reviewer never fixes.

---

## Spawn Order for New Features

For a typical full-stack feature (e.g., "build the saved events feature"):

```
1. database        → schema changes / new models first
2. backend         → API routes and business logic
3. auth            → if the feature touches auth/session
4. frontend        → UI last, after data layer is ready
5. Quality gate    → npx tsc --noEmit + lint (orchestrator runs this, cheap)
6. code-reviewer   → correctness, adherence, security, browser verification in one pass
7. Dispatch fixes  → send Critical/High findings back to the responsible specialist; re-review
```

For frontend-only changes, skip 1–3 and go directly to the frontend process.

For sync/ingestion work, spawn `sync` independently — it has no frontend dependency.

**Shared query logic:** when both a Server Component (frontend) and an API route (backend) need the same query (e.g., the feed's SSR initial load + infinite-scroll endpoint), the query lives in `/lib` and is owned by `backend`; both consume it. Never duplicate business-rule filters across the two.

---

## Plugins — When to Use

| Plugin           | Use When                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| `ui-ux-pro-max`  | Planning genuinely new UI (complex tier) — before spawning `frontend`. Skip for tweaks to existing UI    |
| `impeccable`     | Critiquing and refining the ui-ux-pro-max plan — after ui-ux-pro-max, before spawning                    |
| `playwright`     | Automated browser testing, e2e flows                                                                     |
| `prisma`         | Any database schema work — provides live schema awareness                                                |
| `context7`       | Looking up current API docs for Ticketmaster, Eventbrite, Apify, Auth.js, Prisma, Resend, or any library |
| `typescript-lsp` | Type checking, finding type errors before running                                                        |

---

## Development Guidelines

- **TypeScript strict mode** everywhere — no `any`, no type assertions without justification
- **No raw SQL** — Prisma only
- **No secrets in client code** — never use `NEXT_PUBLIC_` for secrets
- **Server-side validation** on all inputs at API boundaries — never trust client data
- **No comments** unless the why is non-obvious (hidden constraint, workaround, subtle invariant)
- **No premature abstractions** — three similar lines is better than a helper that doesn't need to exist yet
- **Prisma singleton** in `/lib/db/client.ts` — never instantiate PrismaClient outside this file
- **Error responses** never expose raw error details to clients — log server-side, return generic message
- **Cron endpoints** always validate `CRON_SECRET` before executing
- After every implementation, check if `PRODUCT_REQUIREMENTS.md` or `SYSTEM_ARCHITECTURE.md` needs updating — these two docs are the single source of truth; do not create additional overview/description docs that duplicate them

---

## Testing Strategy

Automated tests are the cumulative quality layer — browser verification only proves today's change, tests keep proving it.

- **Vitest for `/lib`** — every business rule gets a unit test, written by the specialist that implements it: dedupe matching (title similarity, ±2h window, 500m radius), provider category maps, reminder scheduling math, the 5-save free-tier limit, Haversine, cursor pagination edge cases
- **Provider adapters** — test normalization against recorded fixture responses (no live API calls in tests)
- **Playwright smoke suite** — a small set of golden-path e2e flows (signup → feed → save → going). The code-reviewer runs this suite as part of browser verification instead of re-clicking everything ad hoc, and adds a flow when a new feature ships
- **Quality gate before every review:** `npx tsc --noEmit`, lint, and `vitest run` must pass before the code-reviewer is spawned
- Specialists must not mark work complete with failing tests; fixing a test by weakening its assertion requires an explicit callout in the report
