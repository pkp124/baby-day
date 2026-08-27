# Baby Day — current product plan

Living plan for the app in this repo. The original write-up is in [idea-and-plan.md](./idea-and-plan.md). Reviews: [plan-review.md](./plan-review.md), [hosting-and-backend.md](./hosting-and-backend.md).

## What it is

A night-first PWA for two parents. Either parent logs a care event in a few taps. The other parent can see it. The home screen answers “what happened?” and “what needs attention?”

It is a shared handover layer, not a medical or coaching product.

## Locked decisions

- **Vite + TypeScript + React**, not a vanilla rewrite later.
- **IndexedDB (Dexie)** is the source of truth on the device. The service worker caches the app shell only.
- **GitHub Pages** hosts the PWA. **Supabase** (Postgres + Auth + RLS + Realtime) holds the shared record. The app is fully usable on one phone without Supabase.
- **Events are append-first** with client UUIDs, `rev`, `updated_at`, and `deleted_at` tombstones. Last-write-wins on sync.
- **Breastfeeds are sessions**: start left/right, switch side, per-side seconds, optional formula top-up. Volume is for bottles.
- **Live timers** persist `startedAt` / `sideStartedAt`. Duration is computed from timestamps. Screen wake lock while a timer runs.
- **Care day** starts at 05:00 local (configurable), not midnight.
- **Canonical units** in storage: millilitres, grams, seconds. Display ml/oz and kg/lb from settings.
- **Auth**: Google if configured, magic link as backup. Do not auto-create a cloud family on login — the first parent taps “Start a shared family”, the second joins with a single-use invite.
- **No charts, reminders, cry analysis, or medical advice in v1.** Time-since-last, daily totals, handover, and a 48-hour text snapshot are the dashboard.

## MVP in this codebase

- Onboarding: baby name + parent name
- Quick log: feed, pump, diaper, sleep, weight, note
- Breast timer + switch side + formula top-up
- One-tap sleep start/end
- Today timeline, counters, last-feed / last-diaper / awake glance
- Handover card after returning from background
- Undo delete, backdate chips (now / 10m / 20m / 1h)
- Export JSON/CSV and copy 48-hour summary
- Optional Supabase sync + invite
- Installable PWA, dark UI

## Out of scope until you have used it for a week

Charts, notifications, appointments, milk inventory, custom event builder, multiple babies, guest/nurse roles.

## How to go live with two phones

1. Create a Supabase project in a nearby region. Enable Google and/or email auth.
2. Run `supabase/schema.sql`.
3. Put the project URL and anon key in GitHub Actions secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Enable GitHub Pages (Actions source).
5. Parent A installs the PWA, signs in, taps **Start a shared family**, creates an invite.
6. Parent B installs, signs in with a **different** account, pastes the invite.
7. Confirm an event on A appears on B, then try the same offline.
