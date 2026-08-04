# Settings — Iteration 5 Design Plan

Scope: `/settings` (Preferences form + Account management). Inherits the visual system established in iteration 4 (`docs/plans/auth-ui.md`) — brand tokens, warm neutrals, Base UI + shadcn primitives, Geist Sans, no Instrument Serif on this surface (serif is landing-only per iteration 4).

Server plumbing (endpoints) is delivered by the `backend` agent in this same iteration; UI wires against it.

---

## Design direction

**Product-serving, not brand-forward.** This is a utility surface — dense, scannable, boring in the best way. No decorative visuals. No hero. No bloom. Just clear sections, labelled fields, sensible spacing, one primary action per section.

**Two vertical cards, stacked, single column, max ~640px wide, centered.**

1. **Preferences** — feed defaults the user can change. Categories, distance, date range, price range (Free); experience type, family friendly (Pro-only, disabled with lock badge for FREE users).
2. **Account** — name, ZIP code, sign out, delete account (destructive; separate visual treatment).

No shared authed shell / nav yet (deferred to iteration 7 with `/feed`). Page uses only the root layout. Add a lightweight page header inline — logo mark + "Settings" title, mirrors `(auth)/layout.tsx`'s minimal header pattern.

---

## Layout & structure

```
<main> (min-h-svh, background)
  <header> (px-6 md:px-8 pt-6, small logo mark + "Event Atlas" link back to /)
  <section> (mx-auto max-w-2xl px-4 py-10 md:py-16 space-y-8)
    <h1> Settings (text-3xl md:text-4xl tracking-tight)
    <Card> Preferences
      <CardHeader> title + short helper copy ("Defaults for your feed. Change anytime.")
      <CardContent>
        <PreferencesForm />  ← client component
    <Card> Account
      <CardHeader> title
      <CardContent>
        <AccountSection />   ← client component
</main>
```

Card uses the existing shadcn `Card` primitive. No custom card variant — the auth surface's `AuthCard` is bespoke; settings uses vanilla `Card` for utility feel.

---

## Preferences form

Fields, in visual order:

1. **Categories** — grid of 12 toggle chips (2 cols mobile, 3 cols md+). Selected = filled brand-soft with brand text and 1px brand border; unselected = neutral outline. Click toggles. Free feature.
2. **Max distance** — slider or number input. Range 1–500 miles, step 1. Show current value inline. Use a plain number input for iteration 5 (a proper slider is deferred). Free feature.
3. **Date range** — number input, days, 1–365. Free feature.
4. **Price range** — two number inputs (`min`, `max`) side by side. Both optional (nullable). Free feature.
5. **Experience type** — 3-state radio group (Indoor / Outdoor / Both). **Pro-only** — disabled with `<ProLockBadge />` next to the label for FREE users.
6. **Family friendly** — single switch. **Pro-only** — disabled with `<ProLockBadge />` for FREE users.

Bottom of card: primary "Save preferences" brand button (right-aligned on md+, full-width on mobile). Disabled while submitting. Show a success toast/inline confirmation on save; show inline error on failure.

**Pro gate rendering rule:** if `subscription.status !== "ACTIVE"`, render the Pro fields with `disabled` and a `<ProLockBadge />` chip beside the label. Do not hide them — the point is that free users see what's available.

**Category list source:** the 12 `Category` enum values from Prisma, displayed in the same order as the PRD's list (Music, Sports, Arts & Theater, …). Import from the shared preferences schema in `lib/preferences/schema.ts`.

---

## Account section

Fields, in visual order:

1. **Email** — read-only text (not editable in iteration 5). Muted foreground.
2. **Name** — text input.
3. **ZIP code** — text input, `\d{5}(-\d{4})?` pattern; on save the server re-geocodes via OpenCage.
4. **Save changes** — brand button, disabled while submitting.

Divider.

5. **Sign out** — outline button, left-aligned.
6. **Delete account** — destructive text link/button (`text-destructive`), opens a confirmation modal.

**Delete account modal** — shadcn `Dialog`. Title "Delete account?" · body "This permanently removes your account, saved events, Going events, friends, and reminders. This action cannot be undone." · destructive confirm button ("Delete my account") + neutral Cancel. No password re-entry (Google users have none; friction is not the point here).

After successful delete → server signs the session out and the client is redirected to `/` via `signOut({ callbackUrl: "/" })`.

---

## Pro lock badge

`<ProLockBadge />` — small pill, next to the field label:

- Size: `text-[10px]` uppercase tracking-widest, `px-1.5 py-0.5`, `rounded-sm`
- Fill: `bg-brand-soft text-brand`
- Optional lock icon (lucide `Lock`, `size-3`), inline before "Pro"
- Copy: `Pro`

No tooltip in iteration 5; the disabled input is enough context. Upgrade flow is deferred (Stripe post-MVP), so don't link the badge anywhere.

---

## Interaction states

- Form fields use the existing `Field` component from `components/auth/field.tsx` (label above, muted helper below, error slot). Reuse — do not duplicate.
- Primary "Save" buttons use `variant="brand"` from iteration 4.
- Loading state on submit: `disabled` + label swaps to "Saving…".
- Success confirmation: inline pill above the button, `bg-emerald-500/10 border-emerald-500/20 text-emerald-700` (same pattern as the "verified" alert on `/login`). Auto-dismiss after 3s or on next edit.
- Error state: `FormError` component (`components/auth/form-error.tsx`) — reuse.

Zip re-geocode may fail (OpenCage down / invalid ZIP that passed the regex). If `PATCH /api/users/me` returns non-2xx, show generic "Couldn't save. Please try again." Do not expose OpenCage errors.

---

## Data flow

Server Component `app/(main)/settings/page.tsx`:

1. `const session = await auth();` — redirect to `/login` if none (middleware already guards, this is defense-in-depth; simplest is `if (!session) redirect("/login")`).
2. Fetch `user`, `user.preferences`, `user.subscription` in one Prisma call (`include: { preferences: true, subscription: true }`).
3. Determine `isPro` via `lib/subscription/is-pro.ts` helper.
4. Pass initial values + `isPro` to `<PreferencesForm initial={...} isPro={isPro} />` and `<AccountSection initial={...} />`.

`PATCH` endpoints are called from the client forms with `fetch`. After account name/ZIP updates, call `useSession().update()` so the JWT re-hydrates (the JWT carries `needsZip`, and changing ZIP shouldn't accidentally flip it).

---

## Accessibility

- Every input has an associated `<label>` (via `Field`).
- Disabled Pro inputs get `aria-disabled="true"` in addition to `disabled` for AT clarity.
- Modal traps focus (Base UI Dialog does this by default).
- Destructive button has an explicit accessible name including "Delete account".
- Category chips are `<button type="button">` with `aria-pressed` reflecting state — not `<input type="checkbox">`, because the chip visual is not a checkbox.

---

## Files

New:
- `app/(main)/settings/page.tsx`
- `components/settings/preferences-form.tsx`
- `components/settings/account-section.tsx`
- `components/settings/pro-lock-badge.tsx`

No design-token changes. No new dependencies. shadcn `Dialog` and `Switch` are added via `npx shadcn add dialog switch` if not already present.

---

## Out of scope for iteration 5

- Change password (users use `/forgot-password`)
- Change email (needs re-verification flow — larger)
- Subscription management / Stripe billing (post-MVP)
- Shared `(main)` layout with nav bar (arrives iteration 7 with `/feed`)
- Multi-location saved places (Pro feature, deferred)
- Ad-preferences (advertisements post-MVP)
