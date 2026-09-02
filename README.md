# Baby Day

Night-first care log for two parents. Log a feed, sleep, or diaper in a few taps. The home screen answers “what happened?” and “what needs attention?”

It is a shared handover layer — not a medical app, not a coach, and not a cloud baby tracker. No account is required.

**[Open the app](https://pkp124.github.io/baby-day/)**
· **[How to use](https://pkp124.github.io/baby-day/guide/)**
· **[Privacy](docs/privacy.md)**
· **[Technical notes](https://pkp124.github.io/baby-day/tech/)**

The PWA is at [pkp124.github.io/baby-day](https://pkp124.github.io/baby-day/). In-app copies of the guides live at [`#/guide`](https://pkp124.github.io/baby-day/#/guide) and [`#/tech`](https://pkp124.github.io/baby-day/#/tech).

## What to expect

- **Local-first.** Care events stay on this phone until you choose to share. Nothing is uploaded by default.
- **Two parents, same home Wi-Fi.** Pair once with a 6-digit passkey. After that, **Sync** reuses the code for a day or a week.
- **Night-friendly.** Large taps, a live feed/sleep timer, backdate chips (Now / 10m / 20m / 1h), and undo.
- **Optional crib window.** A spare phone upstairs can be a live camera. Nothing is recorded. Frames stay on the home network.
- **Honest limits.** Sync needs both apps open on the same Wi-Fi. A phone is a poor night camera. This log does not tell you what to do if the baby looks unwell.

The care day starts at **5:00 local** by default, not midnight. Units are ml/oz, kg/lb, and °C/°F.

## Install

1. Open **[the app](https://pkp124.github.io/baby-day/)** on the phone you will actually use at night.
2. **iPhone:** Safari → Share → **Add to Home Screen**. **Android:** Install app (or the browser’s Add to Home screen).
3. Enter the baby’s name and your name. Names stay on the phone so the timeline can say who logged what.

The home-screen icon is the real app — it has no browser refresh bar. If a screen looks stuck, Settings → Reload app. When a new version is waiting, a banner on the dock says so.

## Screenshots

<table>
  <tr>
    <td align="center">
      <img src="docs/screenshots/home.png" alt="Home dashboard with last feed, last pump, last diaper, and quick-log buttons" />
      <br /><sub>Home — last feed, pump, diaper, and awake</sub>
    </td>
    <td align="center">
      <img src="docs/screenshots/milk.png" alt="Milk totals for fed, formula, pumped, and fridge, plus today’s timeline" />
      <br /><sub>Milk today, plus the timeline</sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="docs/screenshots/feed.png" alt="Feed sheet with breast timer, per-side times, bottles, and a clock picker" />
      <br /><sub>Feed — timer, breast times, or a bottle</sub>
    </td>
    <td align="center">
      <img src="docs/screenshots/sleep.png" alt="Sleep sheet with start time, live start, and finished nap wake time" />
      <br /><sub>Sleep — live timer or start and wake times</sub>
    </td>
  </tr>
</table>

The dock is **Home · Report · Camera · Settings**.

## What you can log

| Action | What you record |
| --- | --- |
| **Feed** | Live left/right timer, minutes on each breast after the fact, formula, expressed milk, or mixed |
| **Pump** | Left and right volume |
| **Diaper** | Wet, dirty, or both |
| **Sleep** | Start a timer, or log a finished nap with started and woke times |
| **Temp** | Temperature in °C or °F |
| **Weight** | Optional check-in |
| **Vitamin D / K** | Time given today. Cards are red until logged, green after. |
| **Note** | Anything else |

Every sheet has **Now / 10m / 20m / 1h** chips and a date-and-time picker, so you can log the real clock time.

Home glance: last feed, last pump, last diaper, time awake. **Vitamin D** and **Vitamin K** sit under that — tap red to log now, tap green to edit or undo. A **Milk** card splits:

- **Fed** — formula + expressed bottles today (nursing is a feed count, not millilitres)
- **Formula** — formula given today
- **Pumped** — pump sessions today
- **Fridge** — leftover expressed milk: all pumped minus all expressed bottles, not only today. Spills and milk given away are not tracked.

**Report** is the last 72 hours (sleep, milk, diapers, gaps) plus a printable HTML / PDF. Settings can copy the last 48 hours as plain text for a clinic message.

## How to use

Full walkthrough: **[user guide](https://pkp124.github.io/baby-day/guide/)** (also [in the app](https://pkp124.github.io/baby-day/#/guide) under Settings → User guide).

1. **Feed → Start left/right** starts a timer. Switch side, then end. **Log times on each breast** is for a feed that already happened. Bottles are on the same sheet. Add formula top-up from a running timer if you need to.
2. **Sleep** opens a sheet: start now, or save a nap with started and woke times. If a sleep timer is already running, the home Sleep button ends it.
3. **Pump**, **Diaper**, **Temp**, **Weight**, and **Note** are one sheet each.
4. Tap a timeline row to edit time, breast minutes, notes, or delete (with undo).
5. **Settings:** units, care-day start hour, 48-hour copy, JSON/CSV backup, and **This Wi-Fi**.
6. **Camera** tab: spare phone as crib, parent phones Watch on the same home Wi-Fi.

### Two phones on home Wi-Fi

Settings → **This Wi-Fi**. One parent shows a 6-digit passkey, the other types it. Both apps stay open on the same network. Logs copy phone-to-phone — not into a baby cloud.

After that first link, each phone remembers the code for **a day or a week**. Tap **Sync** on Home or in Settings. You do not type the code again until it expires. Locking a phone drops the live link; already-copied events stay. Guest Wi-Fi with client isolation will fail. QR remains as a fallback if a phone has no internet for the handshake.

There is still no catch-up while the other phone is off the network. Optional cloud sync exists in Settings but stores events in a form the host can read — **leave it off** for real baby data.

### Crib camera

[Camera tab](https://pkp124.github.io/baby-day/#/camera) on a spare phone upstairs → **Use this phone as crib**. Plug it in, Auto-Lock → Never, leave that screen open. Downstairs → **Watch the crib**. Same home Wi-Fi reaches another floor. Camera off until someone watches. Nothing is recorded. A dim night light helps; a phone has no infrared.

More: [user guide — camera](https://pkp124.github.io/baby-day/guide/#camera) · [video notes](docs/video-monitor.md)

## Privacy

Default: everything is on **this phone** (IndexedDB). Nothing is uploaded.

This Wi-Fi copies events over the local network after a short handshake. Crib video frames stay on the LAN. The public passkey mailbox only carries WebRTC signaling, not feeds or video.

Longer argument: [privacy.md](docs/privacy.md).

## Support

Baby Day is free for families. No account, no ads, nobody selling baby logs.

If it helped a night and you want to say thanks, a coffee is welcome. A Buy Me a Coffee button will live here once the page is set up.

Until then: [star the repo](https://github.com/pkp124/baby-day) or [open an issue](https://github.com/pkp124/baby-day/issues) with what you needed at 3am.

<!-- When the page exists, replace the paragraph above with:
[![Buy Me A Coffee](https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png)](https://www.buymeacoffee.com/YOUR_PAGE)
and set custom: in .github/FUNDING.yml to the same URL.
-->

## Guides

| Who it is for | Where |
| --- | --- |
| New parent, day-to-day use | [Hosted user guide](https://pkp124.github.io/baby-day/guide/) · [in the app](https://pkp124.github.io/baby-day/#/guide) · [source](docs/user-guide.md) |
| How it is built | [Hosted technical notes](https://pkp124.github.io/baby-day/tech/) · [in the app](https://pkp124.github.io/baby-day/#/tech) · [source](docs/technical.md) |
| What leaves the phone | [Privacy](docs/privacy.md) |
| Crib-phone video | [video-monitor.md](docs/video-monitor.md) |
| Hosting / backend | [hosting-and-backend.md](docs/hosting-and-backend.md) |
| Product plan | [product-plan.md](docs/product-plan.md) |

Repo: [github.com/pkp124/baby-day](https://github.com/pkp124/baby-day) · License: [MIT](LICENSE)

## For developers

Node 22.

```bash
npm install
npm run dev
```

Open the URL Vite prints, preferably from a phone on the same network, or Chrome device emulation. Local docs: [http://localhost:5173/guide/](http://localhost:5173/guide/) and [http://localhost:5173/tech/](http://localhost:5173/tech/).

```bash
npm test
npm run build
```

The PWA is a static site. GitHub Actions publishes `dist/` to [GitHub Pages](https://pkp124.github.io/baby-day/) on push to `main`. In the repo: **Settings → Pages → GitHub Actions**. Leave Supabase secrets empty if care events should stay on the phone.

Vite `base` is `./`, so a project site (`username.github.io/baby-day/`) and a custom domain both work. A custom domain is nicer for “Add to Home Screen.”
