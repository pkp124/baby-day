# Baby Day — current product plan

Living plan for the app in this repo. The original write-up is in [idea-and-plan.md](./idea-and-plan.md). Reviews: [plan-review.md](./plan-review.md), [hosting-and-backend.md](./hosting-and-backend.md), [privacy.md](./privacy.md). Ranked later ideas, gated by the bar below: [productization-catalog.md](./productization-catalog.md).

## What it is

A night-first PWA for two parents. Either parent logs a care event in a few taps. The other parent can see it. The home screen answers “what happened?” and “what needs attention?”

It is a shared handover layer, not a medical or coaching product.

## The bar (locked)

Keep this app **simple, usable, reliable, and privacy-first**. That is how we say no. It is not a slogan for a later version.

| Word | Means at 3am |
| --- | --- |
| **Simple** | Home still answers two questions: what happened, and what needs attention. No second product (coach, monitor, shop, translator). A new control has to earn the slot. |
| **Usable** | One-handed, night-first, a few taps. Optional fields never block logging. |
| **Reliable** | The log does not lie and does not vanish. Timers, totals, backups, and sync status stay honest. |
| **Privacy first** | On this phone by default. Sharing is a choice. Care events and audio do not go to a host in the clear. |

New work has to pass all four. A high score in the [catalog](./productization-catalog.md) is not permission to add surface area.

## Locked decisions

- **Vite + TypeScript + React**, not a vanilla rewrite later.
- **IndexedDB (Dexie)** is the source of truth on the device. The service worker caches the app shell only.
- **GitHub Pages** hosts the PWA. **On-device IndexedDB is the default record.** Optional sync, if enabled later, should be an encrypted mailbox (see [privacy.md](./privacy.md)), not plaintext rows on Supabase. The app is fully usable with no account.
- **Privacy default:** care events do not leave the phone. Shared async handover cannot be literal on-device-only; that path is end-to-end encryption plus a dumb mailbox, or waiting until both phones are open.
- **Events are append-first** with client UUIDs, `rev`, `updated_at`, and `deleted_at` tombstones. Last-write-wins on sync.
- **Breastfeeds are sessions**: start left/right, switch side, per-side seconds, optional formula top-up. Volume is for bottles.
- **Live timers** persist `startedAt` / `sideStartedAt`. Duration is computed from timestamps. Screen wake lock while a timer runs.
- **Care day** starts at 05:00 local (configurable), not midnight.
- **Canonical units** in storage: millilitres, grams, seconds. Display ml/oz and kg/lb from settings.
- **Auth**: Google if configured, magic link as backup. Do not auto-create a cloud family on login — the first parent taps “Start a shared family”, the second joins with a single-use invite.
- **No charts, reminders, cry analysis, or medical advice in v1.** Time-since-last, daily totals, handover, and a 48-hour text snapshot are the dashboard. Voice logging and on-device cry bouts stay out of v1; they are catalog rows, not the next build.

## MVP in this codebase

- Onboarding: baby name + parent name
- Quick log: feed, pump, diaper, sleep, weight, note
- Breast timer + switch side + formula top-up
- One-tap sleep start/end
- Today timeline, counters, last-feed / last-diaper / awake glance
- Handover card after returning from background
- Undo delete, backdate chips (now / 10m / 20m / 1h)
- Export JSON/CSV and copy 48-hour summary
- Optional Supabase sync + invite (not for real baby data until encrypted)
- Local Wi-Fi handover via 6-digit passkey (QR fallback) + WebRTC (host-only ICE)
- Installable PWA, dark UI

## Out of scope until nightly use is boring

Charts, notifications, appointments, milk inventory, custom event builder, multiple babies, guest/nurse roles, in-app voice, cry audio.

The [productization catalog](./productization-catalog.md) is a menu, not a roadmap. Until this family has used the current app at night, do not start product rows below the bar. Work that *can* pass the bar first: usability of the current screens (undo on save, thumb-zone actions, last night, choices before the clock), then make the log harder to lose, a copy-paste briefing, then a shift baton or encrypted mailbox if two phones need async handover.

## Sharing between two phones

**This Wi-Fi** (Settings): 6-digit passkey over the local network (QR still works). Events never go to a server. Both apps must be open on the same network. Catch up by linking again when you are both home.

There is still no cloud mailbox. Do not point this family at plaintext Supabase.
