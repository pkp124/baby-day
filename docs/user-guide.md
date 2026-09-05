# Baby Day user guide

How to use the app as a new parent. Technical internals are in [technical.md](./technical.md).

- **App:** [pkp124.github.io/baby-day](https://pkp124.github.io/baby-day/)
- **This guide (hosted):** [pkp124.github.io/baby-day/guide](https://pkp124.github.io/baby-day/guide/)
- **In the app:** Settings → User guide, or [open `#/guide`](https://pkp124.github.io/baby-day/#/guide)

Baby Day is a night-first log for two parents. Either of you records a feed, sleep, diaper, or note in a few taps. The home screen answers “what happened?” and “what needs attention?” It is a handover layer, not a medical app, and it does not need an account.

## First five minutes

1. On iPhone: Safari → Share → **Add to Home Screen**. On Android: the browser’s **Install app** prompt. The home-screen icon is the real app — it has no browser refresh bar.
2. Enter the baby’s name and your name. Names stay on the phone so the timeline can say who logged what.
3. Log the next real event, not a test. Undo is on the toast if you tap the wrong thing.

Everything is saved on this phone first (IndexedDB). Nothing is uploaded unless you later turn on sharing. The care day starts at 05:00 local by default, not midnight — change that in Settings if your nights run later.

Units: ml or oz, kg or lb, °C or °F. Storage underneath is always millilitres, grams, and Celsius.

## Logging care

### Live breastfeed

Home → **Feed** → Start left or right. The timer stays on the home screen. Switch side when you swap. End feed when you are done. If you also gave formula, tap **Add formula top-up** on the running timer, or edit the event after.

### A feed that already happened

Feed → **Log times on each breast** if you remember minutes. For a bottle, pick expressed, formula, or mixed and enter the amount. Every sheet has **Now / 10m / 20m / 1h** chips and a clock picker so the timestamp is the real one, not “whenever you found the phone.”

### Sleep

Sleep opens a sheet: start now, or save a finished nap with started and woke times. If a sleep timer is already running, the home Sleep button ends it. A leftover timer older than three hours shows a warning.

### Diaper, pump, temp, weight, note

One sheet each. Pump is left and right volume. Tap a timeline row to edit time, notes, or delete (with undo).

### Vitamin D and K

Red/green cards under the glance. Red means not given this care day — tap to log now. Green shows the clock time; tap to edit or undo.

## Use case: night shift

One parent has the phone. Log feeds and diapers as they happen. When you put the phone down for more than a couple of minutes, the next open can show a **handover** card — events the other person logged while you were away, once those events are on this phone.

Handover is not magic across town. If the other parent logged on their own phone, those events arrive when you [sync on this Wi-Fi](#use-case-two-phones-on-home-wi-fi). Until then, each phone has its own night.

Keep the screen awake during a live feed or sleep timer; the app requests a wake lock while a timer runs. If iOS still dims, Auto-Lock → Never for that stretch, then put it back.

## Use case: two phones on home Wi-Fi

Settings → **This Wi-Fi**. The first time, one parent taps **Show a passkey**, the other taps **Enter a passkey** and types the six digits. Both apps stay open on the same home network. Logs copy phone-to-phone. They do not go to a baby cloud.

After that first link, each phone remembers the passkey for **a day or a week** (you choose). The next catch-up is one tap: **Sync** on Home or in Settings. You do not type the code again until it expires. Tap Sync on both phones while you are home.

- One phone starts the link, the other joins. That role is remembered; you can swap it in Settings.
- If the other phone’s saved code expired, they can still type the digits shown on your Sync card.
- Locking a phone drops the live link. Already-copied events stay. Sync again later to catch up.
- Guest Wi-Fi with “client isolation” or a mesh that splits you onto two networks will fail.
- QR codes remain under “Use a QR code instead” if a phone has no internet for the handshake.

There is still no catch-up while the other phone is off the network or in another city. Optional cloud sync exists in Settings but stores events in a form the host can read — leave it off for real baby data.

## Use case: crib camera on a spare phone

Camera is its own tab, not a setting. It is a live window on the home Wi-Fi, not part of the care log, and nothing is recorded.

1. Spare phone upstairs → Camera → **Use this phone as crib**.
2. Plug it in. Set Auto-Lock to Never. Leave that screen open.
3. Save the crib passkey on each parent phone (type it, or Sync This Wi-Fi once — that copies it).
4. Downstairs → Camera → **Watch the crib**. Same home Wi-Fi reaches another floor.

The crib camera stays off until someone watches, then turns off when the last watcher leaves. Both parents can watch at once. The crib sends live sound; Watch stays silent until you unmute (phones will not autoplay audio). Turn the mic off on the crib phone if you want a silent picture.

A phone cannot see in the dark. Use a dim night light, not the torch on the baby’s face. If the crib phone sleeps or you swipe the app away, Watch cannot start until you unlock it again.

## Use case: pediatrician or a worried night

The **Report** tab defaults to the last 72 hours. You can switch to 24h, 48h, 7 days, or pick start and end timestamps. Sleep, milk, diapers, gaps, and the printable HTML file follow that range. Settings can copy the last 48 hours as plain text for a message, or print a 72-hour snapshot to PDF.

Home glance: last feed, last pump, last diaper, time awake. Milk splits fed / formula / pumped / fridge estimate (all pumped minus all expressed bottles, not only today). Trends on Report fill in as days accumulate.

This is a log, not advice. If the baby looks unwell, use the clinic — the app will not tell you what to do.

## Use case: keep a copy, or leave the app

Settings → Backup. JSON is the full local record. CSV is a spreadsheet of events. The HTML report is a chosen time slice, not a backup. Export is the backup.

Events stay on this phone until you delete them. There is no automatic expiry. A few years of logs is still a small IndexedDB. Safari can still evict storage under pressure, so export occasionally if this phone is the only copy. Settings → Data on this phone can delete finished events older than 90 days, 1 year, or 2 years. After the next Wi-Fi sync, the other phone applies the same deletes.

If you only have one phone, you can skip Sync entirely.

## What stays on the phone

Default: events never leave the device. This Wi-Fi copies them over the local network after a short handshake. Crib video frames stay on the LAN and are not stored. The public passkey mailbox only carries WebRTC signaling, not feeds or video.

See [privacy.md](./privacy.md) for the longer argument.

## If something fails

- **Stuck screen on iPhone:** Settings → Reload app. Home-screen PWAs have no pull-to-refresh.
- **New version:** a banner on the dock. Reload. Phones can keep an old copy until you do.
- **Sync does nothing:** both on the same Wi-Fi, both apps open, saved passkey not expired, one phone set to start and the other to join.
- **Watch is black:** the screen now says why. Usually the crib phone slept, left the Camera crib screen, or camera permission is blocked. Same Wi-Fi, night light on, then try Watch again.
- **Timer you forgot:** end it. Events older than three hours warn you. You can edit the end time.
