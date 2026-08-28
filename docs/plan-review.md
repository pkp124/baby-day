# Baby Day — Plan review

This is a review of [the original idea and plan](./idea-and-plan.md). Verdict first, then what to keep, what to tighten, and what to add before building.

Hosting follow-up (Supabase vs GitHub-only, remaining blind spots): [Hosting and backend](./hosting-and-backend.md).

## Verdict

**The plan makes sense.** The product thesis is the right one: this should not compete with Huckleberry, Glow, or Baby Tracker on charts and coaching. It should be a **shared handover layer** so neither parent has to ask “did he already eat?”

The principles (shared by default, one-tap first, local-first, private, progressive complexity) are correct for two exhausted parents. The event-oriented data model is the right foundation. The definition of done for the first family release is concrete and testable.

The plan is slightly **underspecified on the actual newborn feeding workflow**, a bit **optimistic about a local-only prototype**, and missing a few risks that matter on real phones at 3am. None of that invalidates the direction. It is the difference between a good idea and an app you will actually keep using in week two.

## What is strong and should not change

- **Handover as the defining feature.** Daily charts are nice; knowing the last feed, last diaper, and what happened since you last looked is what prevents duplicate feeds and missed diapers.
- **One-tap first, optional fields never block logging.** Forms kill baby trackers.
- **Append-first events with stable IDs.** Idempotent sync is much easier than trying to be a collaborative document editor.
- **RLS on every family-owned table**, no service key in the browser, no “unguessable family code” as security.
- **Recoverable auth before the app becomes the record of truth.** Anonymous-only is correctly called out as a trap.
- **Small MVP, use it for a week, then add features from real friction.** That is the only honest roadmap for a family-of-two product.
- **No medical-decision features.** Informational summaries only.

## Gaps relative to the original need

The original request was: *how much breastfeeding, how much formula, how long on each breast, simple to use, a dashboard.*

The plan has feed method + optional volume + optional duration. That is not enough for breastfeeding, which is the main path for a newborn.

### 1. Breast side and per-side duration belong in MVP

A breastfeed is usually a **session with segments**, not a single duration:

- started on left or right
- minutes on left
- minutes on right
- optional note (“cluster feeding”, “fell asleep”, “good latch”)

Handover should show **which side to start next**. That is one of the few “smart” extras that is actually used, and it is a lookup, not a model.

Do **not** require millilitres for a breastfeed. Volume is for bottles (expressed milk / formula). Duration and side are the breastfeed record.

Mixed feeds are common: breast, then a formula top-up. Model that as **one feed event** that can contain breast segments *and* bottle millilitres, not two unrelated events.

Suggested payload:

```ts
type FeedData = {
  method: "breast" | "expressed" | "formula" | "mixed";
  startedOn?: "left" | "right";
  leftSeconds?: number;
  rightSeconds?: number;
  volumeMl?: number;      // bottle / expressed / formula
  formulaMl?: number;     // only if mixed and you want a split
  expressedMl?: number;
  note?: string;
};
```

Pumping should allow **left and right volumes separately**. Total is derived.

### 2. Live timers are logging UX, not “Phase 3 intelligence”

Parents start a feed, put the phone down, switch sides, stop later. Same for sleep.

If logging is “fill in minutes after the fact,” the app will lose events at night. MVP needs:

- **Start feed** / **Start sleep** that creates an in-progress event immediately
- Running elapsed time on the home screen
- **Switch side** without ending the feed
- **End** that writes duration from timestamps
- Survive lock screen, tab kill, and refresh by storing `startedAt` (do not depend on `setInterval`)

Use the Screen Wake Lock API during an active timer so the phone is less likely to sleep mid-feed. Always persist start time so duration is `now - startedAt`.

Forgotten “still going” sessions need a gentle prompt (“Feed started 2h ago — end it or continue?”), not silent 6-hour feeds in the totals.

### 3. “Time since last X” should be on the home screen

The handover card is right, but it should not be the only place this appears. The default glance should answer:

- Last feed: 1h 40m ago · started left · 70 ml formula after
- Last diaper: 55m ago · wet
- Sleep: awake 2h 10m · last nap 35m

That *is* the dashboard for week one. Charts can wait.

### 4. Backdating and undo

“I forgot to log; it was about 15 minutes ago” is the normal path, not an edge case. Offer:

- save with now (default)
- “10 min ago” / “20 min ago”
- optional exact time

After save, a few-second **Undo** toast. Fat-finger logging at 3am is guaranteed. Editing the last event should be two taps, not a buried settings flow.

## Product suggestions

### Night-first UI

The plan is mobile-first. Make it **night-first** as well.

- Dark default (or follow system, but default dark)
- Very large tap targets; one-handed thumb reach
- Haptic (or a strong visual flash) so a tap is obviously registered
- Do not hide primary actions behind a hamburger
- Desktop can show timeline + summary side by side for WFH, but do not design the home screen around a laptop

### Care day, not calendar midnight

A 1:40am feed belongs with “last night,” not “today.” Give the family a **care-day start hour** (default 05:00 local). Store all events in UTC. Display and daily totals use the family timezone + care-day boundary.

Without this, dashboard totals lie every night.

### Units and identity

- Store canonical units: millilitres, grams, seconds
- Display oz / lb / minutes from a family preference
- Attribute events to `member_id` of the signed-in parent automatically; never ask “who are you?” on every log
- Show the name on the timeline so handover is obvious

### Pediatrician snapshot (small, high value)

JSON/CSV export is the right backup. What you will actually use at a 2-week visit is a **last 24–48 hours plain-text summary**: feed count, breast vs formula, approximate intake, wet/dirty diapers, last weight, last sleep. One “Copy summary” button. Keep it factual. No percentiles, no advice.

### What not to add yet

The plan already resists overbuilding. Be even stricter:

| Idea | Why wait |
| --- | --- |
| Cry / audio analysis | Privacy, battery, and a different product. Revisit only as on-device, log-labeled cry bouts — [catalog §17](./productization-catalog.md). Not a five-signal translator. Parent voice → event is a separate, better-fitting idea — [catalog §9](./productization-catalog.md). |
| Milk stash inventory | Extra chores; a note is enough |
| Growth percentiles / WHO charts | Medical framing you correctly want to avoid |
| Reminders and push | Notification fatigue; PWA push is weak on iOS anyway |
| Appointments / calendar sync | Phase 4 is fine |
| Multiple babies | One profile is correct |
| Custom event builder UI | Keep a `note` type plus a small enum; add types when you feel the pain |

Vitamin D drops and the odd medication can be a `note` or a later `meds` type. Do not block MVP for them.

### Cluster feeding

Newborns may feed every 20 minutes for a stretch. The UI should not treat that as a data-quality problem. Totals and “time since last feed” still work. Avoid “you fed too recently” nags.

## Data model suggestions

The flexible JSON `data` column is the right *storage* shape. It is not a substitute for **typed payloads per event type**. Without that, dashboard sums break on `ml` vs `oz`, `min` vs `seconds`, and `"Left"` vs `"left"`.

Recommendations:

1. Keep `events.data` as JSONB, but define a TypeScript discriminated union (and optionally a Postgres check / JSON schema) per `type`.
2. Add cheap columns now so you do not migrate under a live baby: `updated_at`, `rev` (monotonic integer), `deleted_at` (tombstone, never hard-delete from clients).
3. `time` = when the care happened (user-editable). `created_at` / `updated_at` = when the device recorded it. Allow `time` in the past.
4. In-progress intervals (feed, sleep, pump): `ended_at` nullable. Duration is derived.
5. Prefer **one event per care session**, with segments inside `data`, over start/stop event pairs. Pairs are harder to sync and easier to leave unmatched.
6. `parent` in the example should be `member_id` (FK to `family_members`), not a display string.

Soft deletes + last-write-wins on `rev`/`updated_at` is enough conflict strategy for this app. You do not need CRDTs. The plan’s “make creation immutable at first” is good; still put `rev` on the row from day one.

## Architecture suggestions

### Do not start anonymous, then migrate

Section 15 still sequences “prototype locally” then “replace anonymous auth.” There is **no prototype in this repository today** (only the MIT license). More importantly, if you log real newborn data into an anonymous local-only app, you will either lose it or spend a weekend on a migration during the worst sleep of your life.

**Collapse Phase 0 and Phase 1.** Ship local-first *with* recoverable login, family invite, and sync from the first version you actually use. A clickable UI shell without backend is fine for layout, but do not use it as the family record.

### IndexedDB, not `localStorage`

`localStorage` is synchronous, small, unindexed, and a poor outbox. Use IndexedDB (Dexie or `idb`) for:

- events
- outbound sync queue
- in-progress timers

The service worker caches the **app shell**. It should not be the database.

### iOS PWA storage eviction is a first-class risk

This is missing from the risk list and it is the one most likely to hurt.

Safari can evict IndexedDB for home-screen web apps, especially under storage pressure. If a parent’s phone has not synced, history disappears.

Mitigations:

- Recoverable accounts from day one (already in the plan — treat as blocking)
- Sync as soon as the network is back; show **Not backed up** when the outbox is non-empty
- After first login, verify events reappear on a second device before trusting the app
- Export remains important, but it is not a substitute for sync

Also note: iOS install is still “Share → Add to Home Screen.” There is no true push without extra complexity. Do not plan on notifications for MVP.

### Skip the vanilla-then-TypeScript rewrite

A PWA with an outbox, realtime, and RLS-sensitive auth will get messy in plain JS. Start with **Vite + TypeScript** and a small UI library (Preact or React). That is not overbuilding; it is how you keep event payloads typed.

Suggested stack (still matches the plan’s hosting idea):

- Vite + TypeScript + Preact/React
- Dexie (IndexedDB) + outbox
- Supabase Auth (magic link or Google), Postgres, RLS, Realtime
- Static host over HTTPS (GitHub Pages is fine; Cloudflare Pages is slightly easier for PWAs)

GitHub Pages works if you control the service-worker scope and env injection at build time. A custom domain avoids a lot of path-prefix pain.

### Family invite is the trickiest backend piece

RLS “only members of my family” has a chicken-and-egg problem for joins. Plan for:

- `families`, `family_members`, `invites` (hashed token, expiry, created-by)
- an RPC or Edge Function that accepts an invite **and** inserts membership in one step
- rotate/expire links; do not use a permanent family PIN as authorization

Document Realtime setup too: enable it on `events`, set replica identity, and test that RLS applies to the realtime stream (it does, but only if policies are correct).

### Clock skew and two phones

Event `time` comes from the device clock. Do not try to be clever. Last-write-wins on edits, stable UUIDs on create, and an obvious “edit time” control are enough.

## Roadmap tightening

| Original | Suggestion |
| --- | --- |
| Phase 0 local prototype, Phase 1 shared MVP | One **usable family MVP**: timers, breast side, handover, auth, sync, PWA, export |
| Edit + conflicts in Phase 2 | Allow edit/delete in MVP with LWW + tombstones; add nicer conflict UI later if you ever need it |
| Trends/charts in Phase 3 | Keep charts later; **time-since-last** and daily totals are MVP |
| Reminders/notifications in Phase 4 | Keep them later; iOS PWA is a poor notification platform |
| Cry/audio in Phase 5 | Move to an explicit **not doing** list so it does not haunt the backlog |

A realistic first release is still small:

1. Two parents, one baby, magic-link (or Google) auth, invite link  
2. Feed (breast sides + bottle), pump, diaper, sleep, weight, note  
3. Live feed/sleep timers  
4. Today (care-day) timeline + counters + handover + time since last  
5. Offline outbox + realtime + sync badge  
6. Undo / edit last / backdate  
7. Copy 48-hour summary + JSON/CSV backup  
8. Installable PWA, dark UI  

Use that for a week. Then consider charts.

## Extra risks to add

1. **iOS storage eviction** — see above.  
2. **False totals from stuck timers** — always timestamp-based; prompt to close stale sessions.  
3. **One parent not opening the app** — handover only works if both use it. Do not solve this with SMS in MVP; solve it with making logging faster than sending a WhatsApp. If needed later, “copy last 3 events” is enough.  
4. **Unit confusion** — 90 vs 3 oz looks like a 30× overdose in a chart. Canonical ml in storage.  
5. **There is no current prototype** — the implementation plan’s step 1 (“keep the current prototype as the baseline”) does not apply to this repo yet.

## Suggested repo shape (revised)

Vanilla `index.html` at the root will fight Vite quickly. Prefer:

```text
baby-day/
├── README.md
├── docs/
│   ├── idea-and-plan.md
│   ├── plan-review.md
│   └── hosting-and-backend.md
├── src/
├── public/          # manifest, icons
├── supabase/
│   └── schema.sql
├── package.json
└── .github/workflows/
```

## Metrics worth keeping

The plan’s metrics are good. The ones that will actually tell you if the app works:

- Time (and taps) to log a breastfeed **including starting a timer one-handed**
- Events created offline that later appear on the other phone
- Days where both parents logged at least once (if only one parent logs, handover failed)
- Edit/delete rate (high is OK at first; it means people trust they can fix mistakes)

## Bottom line

Yes — build this. Keep handover, speed, privacy, and an event log as the core.

Before writing production code, lock these decisions:

1. Breastfeed = per-side durations + last/next side, volume only for bottles.  
2. Live timers with persisted start timestamps.  
3. Recoverable auth + family invite + sync in the first version you use with the baby.  
4. Typed event payloads in JSONB; IndexedDB outbox; tombstones.  
5. Night-first UI, care-day totals, undo, 48-hour text snapshot.

Do that, and the rest of the plan is already the right shape.
