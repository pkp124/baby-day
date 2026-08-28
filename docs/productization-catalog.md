# Baby Day — Productization catalog

Ideas for turning the current family PWA into something other new parents would keep using. Ranked by **usefulness** and **impact to new parents** in the first ~12 weeks — the period this app is actually for.

This is not a build backlog. The bar in [product-plan.md](./product-plan.md) is locked: **simple, usable, reliable, privacy-first**. A high rank is not permission to add surface area. Use the app at night. If a row is not a pain you felt this week, it stays a row.

## How these are ranked

| Lens | What it means here |
| --- | --- |
| **Impact** | Harm avoided or relief given: missed care, partner conflict at 3am, lost sleep, visit-day panic, irreversible data loss. |
| **Usefulness** | Would an exhausted parent actually do this, one-handed, more than once? A feature that is “nice in a review” and unused at night ranks down. |
| **The bar** | Simple, usable, reliable, privacy-first — all four. Fail one, and the idea does not ship, even with a high score. |

Scores are 1–5. **Rank score** = `(impact × 2) + usefulness` so a rare-but-catastrophic miss (data loss, a double feed) still beats a daily gimmick. The bar is a veto on top of that score.

Business packaging is noted only when it follows from parent value. Ads, data resale, and “AI sleep coach” are not in the catalog.

## Already shipped (not new ideas)

Quick log (feed, pump, diaper, sleep, temp, weight, note), live breast/sleep timers, next-breast-side on the glance, milk split (fed / formula / pumped / fridge estimate), handover card, care-day totals, 48-hour copy, JSON/CSV export, local Wi-Fi pairing, night-first PWA.

The gaps are not “more event types.” They are: **handover when the other phone is off**, **surviving the phone**, and **the two minutes when a shift actually changes**.

---

## Ranked catalog

| Rank | Idea | Impact | Use | Score | Who it is for |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | Encrypted async mailbox | 5 | 5 | 15 | Two parents who are not always on the same Wi-Fi |
| 2 | Shift baton (offline snapshot pass) | 5 | 5 | 15 | Night/day handoffs at home, no server |
| 3 | Reliability: stale timers + iOS eviction + backup | 5 | 4 | 14 | Anyone who trusts the app as the record |
| 4 | One-tap partner briefing (copy / share sheet) | 5 | 4 | 14 | The partner who will not open the app |
| 5 | On-duty / whose shift | 5 | 4 | 14 | Two parents splitting nights |
| 6 | Vitamin D / meds as a first-class tap | 4 | 5 | 13 | Almost every newborn after discharge |
| 7 | Clinic pack (pediatrician + lactation) | 5 | 3 | 13 | Visit days (high stress, low frequency) |
| 8 | Glance without opening the app | 4 | 5 | 13 | Every night wake |
| 9 | Voice → event (hold-to-speak, on-device) | 4 | 4 | 12 | Hands full: latch, bottle, diaper at 3am |
| 10 | Guest caregiver with an expiry | 4 | 4 | 12 | Grandparents, postpartum doula, night nanny |
| 11 | Return-to-work pumping stash | 4 | 4 | 12* | Pumping parent going back to work |
| 12 | Humble “next likely” from *this* baby | 3 | 5 | 11 | Cluster-feeding weeks, WFH context-switch |
| 13 | Glance-only second parent | 4 | 3 | 11 | One logger, one reader (common in practice) |
| 14 | Daycare drop-off card | 4 | 3 | 11* | Month 3–4 onward |
| 15 | Kitchen / counter display | 3 | 4 | 10 | WFH, tablet on the counter |
| 16 | Watch / live activity for the running timer | 3 | 4 | 10 | Parents who already wear a watch |
| 17 | Cry bouts + weak labels from *this* baby’s log | 3 | 3 | 9 | Night-stand listen; native; opt-in |
| 18 | Optional diaper detail (poop chips) | 3 | 3 | 9 | The week the pediatrician asks “what did the stool look like?” |
| 19 | Catch-up over Bluetooth / AirDrop | 3 | 3 | 9 | Same as #2, smoother transport |
| 20 | Spit-up as a one-chip event | 2 | 4 | 8 | Reflux-y newborns |
| 21 | Solids / first bites | 2 | 2 | 6 | After ~6 months — different product moment |
| 22 | Second baby / twins | 5 | 2 | 12* | Small group, huge for them |
| 23 | Appointments on the timeline | 2 | 2 | 6 | Calendar apps already win |
| 24 | Push reminders | 2 | 2 | 6 | Fatigue; weak on iOS PWA |
| 25 | Charts and trends | 2 | 2 | 6 | Useful later; not why people stay in week two |
| 26 | Native wrapper for widgets | 3 | 3 | 9 | Packaging for #8, #9, #16, and #17, not a feature by itself |

\*Conditional: score is high **for that subset** of parents, near zero otherwise. Ranked below universal newborn needs.

---

## 1. Encrypted async mailbox

**The product, if two parents are the audience.**

Handover while the other phone is off *requires* a mailbox. Local Wi-Fi already covers “we are both home and both apps are open.” It does not cover “I am in a meeting, you are feeding.” That is the original problem statement.

Do it as in [privacy.md](./privacy.md): ciphertext in a dumb store, family key by QR or passphrase in person, IndexedDB unchanged after decrypt. Never plaintext rows.

**Why it productizes:** every competing tracker already syncs — in the clear. Privacy-preserving sync is the thing you can charge for without becoming Huckleberry. It is also the only way the home screen stays honest when parents work different hours.

**Risk:** if both lose the family key, the cloud copy is unreadable. Keep export as the recovery path. Write the passphrase down during onboarding, not as a footnote.

## 2. Shift baton (offline snapshot pass)

**The local-first answer to the same problem, for the moment a shift actually changes.**

When parent B takes over, parent A taps **Pass the night**. The app builds a compact snapshot (last 24 hours + in-progress timers + next side + fridge estimate) and hands it over as a QR sequence, a file, or a share-sheet payload. Parent B merges it. No server. Neither app needs to stay open on the LAN.

This is closer to how nights actually work: handover is a *moment* (doorway, 11pm, 6am), not a daemon. It also rescues the current Wi-Fi link, which fails if someone locks their phone.

**Why it productizes:** it makes “on this phone” a two-parent product instead of a one-logger diary. Families who refuse a mailbox still get async-enough handover.

Ship a baton before a mailbox if you want to stay off-device. Ship both if you want this to work when one parent is at the office.

## 3. Reliability: stale timers, iOS eviction, backup you will actually run

An app that loses week one, or that reports a 6-hour feed because the phone slept, will be deleted. That is product, not polish.

- Prompt to **end or continue** sessions older than a threshold (for example 2 hours for a feed, 4 for sleep). Totals must not silently lie.
- Treat **Safari home-screen eviction** as a first-class failure. Visible “not backed up” when there is no second copy. Encrypted export to Files / iCloud Drive on a schedule the parent does not have to remember.
- After a PWA update, keep the existing “reload” banner — a stale shell that cannot log is the same as a crash at 3am.

**Why it productizes:** trust is the moat. Parents will not re-enter three days of feeds. Competitors that require an account win on this axis today; local-first only wins if the phone is not the only copy *or* the copy is boringly durable.

## 4. One-tap partner briefing

The real competitor at 2am is WhatsApp. If the other parent will not open Baby Day, handover has already failed.

One button: **Copy what’s going on** — last feed (side, next side, bottle ml), last diaper, awake/sleeping, fridge estimate, vitamin D if you add it, “logged by”. Share sheet or paste into Messages.

Smaller sibling: copy last 3 events as plain sentences. Already hinted in [plan-review.md](./plan-review.md).

**Why it productizes:** it meets parents where they already talk. It also becomes the on-ramp for the second parent (“just read this, then install”).

## 5. On-duty / whose shift

A single shared flag: **I am down / I am up.** Home shows who is on, since when, and the briefing from #4.

This is not a roster app. It is the sentence people already text: “your turn.” Pair it with the baton so taking the shift *is* receiving the snapshot.

**Impact is emotional as much as operational.** Duplicate night wakes and “I thought you had him” are how couples burn out in week two. A glanceable owner of the baby is high leverage for a tiny UI.

## 6. Vitamin D / meds as a first-class tap

Pediatricians discharge almost every newborn with daily vitamin D. Missed drops are a guilt machine. A `note` can do this; a **Drops** (and later **Meds**) chip on home will actually get used.

One tap, optional time chips, care-day “given / not yet” on the glance. No dosing advice. No interactions. No pharmacy.

**Fit:** still a log, not a clinical product. Do not build a medication database.

## 7. Clinic pack (pediatrician + lactation)

The 48-hour copy is the right primitive. Productize the *visit*, not charts.

- Waiting-room paste: last 48h feeds (breast minutes vs bottles, formula ml), wet/dirty counts, last weight, last temp, last sleep window, completeness (“no diapers logged 02:00–06:00”).
- Lactation-consultant variant: per-side minutes, started-on, next side, cluster stretches, pump volumes. Same facts, different order.
- Optional: three parent-typed questions so they are not forgotten when the baby cries in the exam room.

No percentiles, no “he should be…”. Factual snapshot only.

**Impact is spiky:** enormous on visit day, unused otherwise. That is still worth a button. New parents’ worst administrative hour is the 2-week check.

## 8. Glance without opening the app

The home glance is the product. Unlocking a PWA, waiting for the shell, and reading it is already too much at 3am.

- Android: home-screen widget (last feed, last diaper, awake, next side).
- iOS: this basically wants a native shell — Live Activity for a running timer, lock-screen widget for the glance. A PWA cannot do it well.
- Fallback that still helps: **huge-type lock briefing** inside the app (one screen, no chrome) plus the copy button from #4.

**Why it productizes:** widgets are how a tracker becomes furniture. They are also the honest reason to consider a thin native wrapper later (#26), not a rewrite.

## 9. Voice → event (hold-to-speak, on-device)

**This is still logging.** Unlike cry classification, it does not invent a new product. It is a faster input into the same events: feed, diaper, sleep, pump, bottle. That is why it ranks with daily parent needs and well above a baby-language model.

Hands are full. Eyes are off the phone. The original plan was one-tap first; voice is the eyes-free version of the same idea. “Wet diaper,” “start left,” “sixty millilitres formula,” “he’s down.” If that becomes a correct timeline row in two seconds, the other parent’s handover is more complete — which is the actual product.

### What would actually fit

1. **Hold-to-speak**, not a room that is always listening. One large control on home, or a long-press on Feed / Diaper / Sleep. Recording ends on release. The existing **undo toast** is the confirm. Do not silently commit a parse the parent never saw if confidence is low — show a one-line preview (“Feed · left · 12m · now”) and let undo work as it does today.
2. **On-device speech-to-text.** A cloud STT API is a care-event leak with extra steps: “I just gave him ninety of formula” is exactly the payload [privacy.md](./privacy.md) refuses to upload. The browser **Web Speech API is often a cloud service** even when the UI feels local. Do not use it in the PWA as if it were on-device. Native: Speech framework / on-device recognizer, or a tiny local model. Audio is discarded after the parse. It is not a diary of the room.
3. **A closed intent parser**, not a chatty LLM. Map into types and fields this app already has: side, minutes, ml/oz, formula vs expressed, wet/dirty/both, sleep start vs end, pump volumes, backdate chips (“ten minutes ago”). If the utterance is leftover talk, store a **note** or ask to tap. Do not invent vitamin doses, diagnoses, or extra fields from rambling.
4. **OS shortcuts as the first slice.** Siri / Google Assistant / App Intents: “Log a wet diaper in Baby Day,” “Start a left feed.” That is eyes-free without Baby Day running its own recognizer. It is also the honest reason for a thin native wrapper (#26). Ship this before an in-app parser if you wrap the PWA.

### Why #9, not #1

Taps already work. Voice does not create sharing, backups, or a second parent’s glance. A wrong parse (“ninety” vs “nineteen,” left vs right) is a bad care row at 3am — better than a missed log only if undo is obvious and the preview is readable in the dark.

It still ranks above guest mode and pumping stash because the core user hits this **every night**, not on visit weekends. It ranks below mailbox / baton / reliability because a faster logger on one phone does not help the parent who is asleep in the other room. It ranks below widgets because checking “when was the last feed?” is even more common than logging, and does not require a mic.

### Constraints

- **No always-on “just talk.”** That is a baby monitor. Same failure as always-on cry recording (the variant #17 refuses).
- **No cloud transcription**, including “helpful” Whisper-in-the-cloud and the default Web Speech path.
- **Whispered night speech plus a crying baby** will be messy. Prefer a small phrasebook over free-form conversation. Teach four or five example utterances in onboarding, not a general assistant.
- **Attribution** is “whoever is holding this phone,” same as today’s log. Do not try to identify which parent spoke.

## 10. Guest caregiver with an expiry

Grandparents, a doula, a night nanny: they need to **log**, not to own the family history.

A time-boxed guest link (or a local guest profile on a spare phone) that can add feed/diaper/sleep/note, cannot export the archive, and dies on Sunday. Notes the parents marked private stay private.

**Fit:** care circle, not a social graph. No feed of other families. No comments.

This is how the app survives the first time a grandmother is left with the baby and texts “when did he last eat?”

## 11. Return-to-work pumping stash

The fridge estimate is a running total. Working parents need **bags**: volume, date, left/right optional, freezer vs fridge, used/spilled/given away.

The original review parked “milk inventory” as extra chores — correct for week one at home. It becomes the product at return-to-work. Spills and milk given away are already called out as missing in the README.

**Do not** build this before a pumping parent has used the current estimate for a week. When you do, one-tap “poured a bag / fed a bag” must be as fast as a diaper, or it will rot.

## 12. Humble “next likely” from this baby

Not a model. Not “you should feed.” A family-specific interval:

> Last 6 feeds: about every 2h 20m. Last one 1h 50m ago.

Show it only when there are enough events. Hide it during obvious cluster stretches, or show “cluster — feeds are close together, this is normal to log, not a problem.” Never nag “you fed too recently.” Never infer medical need.

**Why it is in the catalog:** WFH parents live by “when am I likely to be needed again.” The original plan already called this optional “next likely task.” Keep it a lookup over *this* log.

## 13. Glance-only second parent

Many families have one logger. Design for it instead of pretending both always tap.

A reader mode: no log buttons, type large enough for a hallway glance, briefing from #4 at the top, optional read-only second device after a baton or mailbox merge.

**Why it productizes:** converting the second parent is the adoption problem. A reader is a cheaper ask than “please log every diaper.”

## 14. Daycare drop-off card

One screen / PDF / share: last feed, last diaper, last sleep, allergies as a parent-typed line, who to call. Handed to daycare at 8am.

Wrong for week one. High impact the week leave ends. Same snapshot machinery as #4 and #7.

## 15. Kitchen / counter display

An always-on layout for a tablet on the counter: giant start/end, running timer, glance, timeline. WFH parent can see it from a desk. Night parent can hit it with a knuckle.

This is the physical version of #8. Cheap if it is a CSS breakpoint and a “kitchen” setting, expensive if it becomes a second app.

## 16. Watch / live activity

Start/end sleep, log a wet diaper, see the running feed, from a watch. The phone stays in the other room.

High usefulness, high platform cost. Only worth it after the PWA glance is trusted. Live Activity on iOS for the in-progress timer is the slice that matches this app’s actual workflow.

## 17. Cry bouts + weak labels from this baby’s log

**The wish is real. The five-signal “baby language” translator is the wrong product. A personal, on-device version that learns from the care log is the only variant that belongs near this catalog.**

New parents want to know *why* the baby is crying. That desire is as strong as handover. Consumer apps already sell five classes (hungry, tired, discomfort, pain, burp). The science underneath is weak: infant cries encode **how upset**, not a stable vocabulary. A model trained on other babies transfers poorly. This baby at day 10 is not this baby at week eight. A wrong “pain” or a wrong “hungry” is not a cute miss — it delays the other action.

So do not ship an oracle. If this is ever built for Baby Day, ship a **pattern over this family’s own nights**.

### What would actually fit

1. **Night-stand listen** (opt-in, native, phone plugged in). Not a pocket mic all day. Cry-gated clips of a few seconds, not a continuous tape of the room.
2. **Labels from the log you already keep**, not from a 3am taxonomy quiz. Clip at 02:14, feed at 02:21 → weak label *feed*. Diaper within the window → *diaper*. Sleep start → *sleep*. Nothing logged, baby settled → *soothe / unknown*. Parents may override. They should not have to classify five Dunstan-style signals to make the feature work.
3. **On-device personalization**, not training a net from scratch on the phone. Ship a frozen audio encoder. Store embeddings (and clips only for a short window). A tiny head — prototypes or a linear layer — updates from those weak labels. Decay older examples as the baby changes. Do not show a guess until there are enough examples per class.
4. **Humble copy.** Never “the baby is hungry.” Prefer “this sounded like the cries that were followed by a feed (low confidence).” Same tone as #12 (next likely): a lookup over *this* log.

That is the automated recording idea, constrained so it does not become a monitor company. Manual “record this cry” while the app is already open is a valid PWA slice and a way to collect labels without always-on audio. Auto-listen is what forces a native wrapper (#26). Do not confuse this with voice logging (#9): that feature transcribes the *parent*; this one records the *baby*.

### Why the rank is 17, not 1

| If it worked as advertised | Why it does not rank with mailbox / baton |
| --- | --- |
| Impact would feel like a 5 | Expected impact is a 3: misfires, age drift, and the parent who already knows this cry will not look at the phone |
| Usefulness would feel like a 5 | Real usefulness is a 3: people try it for a week, then only the personalized, quiet version survives |
| It is a different product | Handover answers “what already happened.” Cry class answers “what should I do,” which is one step from coaching |

It still outranks charts and push because, unlike those, it is a *night* problem. It sits with other score-9 extras (poop chips, AirDrop catch-up) and **behind** anything that makes the existing log trustworthy and shared — including parent voice logging (#9), which transcribes the adult, not the baby.

### Constraints if you ever build it

- **On-device only.** Clips and embeddings never go to Supabase, the mailbox, analytics, or error reports. Not even ciphertext. Audio is not a care event.
- **No five-class marketing.** If you need names, use this app’s actions: feed, sleep, diaper, soothe, unlabeled. Drop “pain” as a predicted class — that is medical framing. A parent can still log a temp or a note.
- **No background mic in the PWA.** `getUserMedia` dies when the phone sleeps. iOS will not give a home-screen web app a baby-monitor session. Auto-record means native, plugged in, a visible “listening tonight” state, and a way to wipe the night’s audio in one tap.
- **Battery and household privacy.** Other adults talk in that room. Cry-gating and short retention are the difference between a clip of a cry and a tape of the house.
- **False confidence.** Show completeness (“12 labeled bouts in 14 days”) the same way you should show missing diapers on a clinic pack. If the model is quiet, that is success.

### What stays out

A cloud cry translator, an always-on pocket mic, camera + audio, and any UI that says Dunstan/ChatterBaby-style “the baby is saying X.” Those productize a different company and fight [privacy.md](./privacy.md).

## 18–20. Small logs and smoother pipes

- **Poop chips** (color/consistency, optional, never required): the question pediatricians actually ask. Hide behind “more” on the diaper sheet.
- **Spit-up chip**: does not invent millilitres. A timestamp + “after feed” is enough.
- **AirDrop / Bluetooth catch-up**: transport for the baton (#2). Same idea, less QR fiddling.

## 21–25. Later, or probably never as Baby Day

| Idea | Why it is ranked down |
| --- | --- |
| Solids / first bites | Different life stage; would bloat home for newborns. |
| Twins / second baby | Huge for those families; do not reshape v1 around them. The event model can grow a `babyId` when the pain is real. |
| Appointments | Calendar already exists. A note or a clinic-pack reminder is enough. |
| Push reminders | Notification fatigue; iOS PWA is a poor channel. A widget plus on-duty beats a badge. |
| Charts / WHO curves | False authority. Time-since-last and daily totals are the dashboard. Revisit only after a month of complete logs, still without medical framing. |

## 26. Native wrapper (packaging, not a feature)

A thin iOS/Android shell around the same local-first core, only to unlock widgets, Live Activities, durable storage, on-device speech (#9), and (if you ever do #17) night-stand cry listen. Not a rewrite. Not a reason to abandon the PWA for the family that already uses it.

Pay for this only in service of #3, #8, #9, #16, and #17.

---

## Explicitly out of the catalog

These productize *some* baby app. They would make this one worse.

- Cloud cry/audio upload, an always-on pocket mic, or a five-signal “the baby is saying X” translator (the on-device log-labeled variant is #17, not this)
- Camera or always-on video
- Medical advice, percentiles, “is this normal?” scoring
- Social feed, parent community, leaderboards
- Ads, affiliate marketplace, diaper-subscription upsells
- Cloud speech or analytics that see care events
- SMS as the sync channel (use share-sheet briefing instead)

---

## How this maps to productizing (not just adding features)

Three honest products, in order of parent impact:

1. **The night baton** — local-first, two parents, shift change as the unit of sharing (#2, #4, #5, #13). No account. This is what you can ship without becoming a host of baby data.
2. **The private family mailbox** — #1 plus #3. This is what you can charge for: async handover the host cannot read.
3. **The care-circle snapshot** — #7, #10, #14. Same event log, different one-tap outputs for the pediatrician, the grandmother, and daycare.

Voice logging (#9) is a better *input* to all three, not a fourth product. Do not start a cry-translator, coach, social, or shop company. A night-stand, on-device cry bout feature (#17) is an optional extra on the log. The differentiator in the original plan is still the right one: *one parent logs in a few seconds, the other knows, neither has to ask.*

## What the bar allows next

Until nightly use of the current app is boring, ignore ranks below this shortlist.

| Bar | Next, if anything | Not yet |
| --- | --- | --- |
| **Simple** | One more glance line, or one more home tap, not a new screen genre. | Guest roles, pumping stash UI, kitchen mode, twins, solids, charts. |
| **Usable** | Copy briefing (#4). On-duty flag (#5). Vitamin D as one chip (#6) only if home still fits. | Voice (#9) until taps are trusted. Widgets and watch until the PWA glance is enough. |
| **Reliable** | Stale-timer prompt + a backup that actually runs (#3). | Anything that adds data we cannot restore. |
| **Privacy first** | Shift baton (#2) — still on the two phones. Encrypted mailbox (#1) only as ciphertext. | Cloud speech, cry upload, plaintext Supabase, always-on mic. |

Vitamin D is the first *new event type* that might earn a slot. Voice is the first *input* extra, and only as hold-to-speak on-device with undo — not cloud dictation. Cry bouts stay a catalog row.

## What not to do with this list

Do not implement it as a roadmap of 26 items. The bar is how we keep the app the thing it is.
