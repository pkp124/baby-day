# Baby Day

A shared, low-friction newborn care companion for two parents.

Log feeds (including time on each breast), bottles, diapers, sleep, weight, and notes in a few taps. The home screen shows time since the last feed/diaper/sleep, today’s totals, and what happened while the other parent was away.

The app is **local-first**. Care events stay on the phone unless you later turn on an encrypted share. See [privacy.md](docs/privacy.md).

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints, preferably from your phone on the same network, or Chrome device emulation.

```bash
npm test
npm run build
```

## Deploy

The PWA is a static site. GitHub Actions publishes `dist/` to GitHub Pages on push to `main`.

1. In the repo: **Settings → Pages → GitHub Actions**.
2. Do not add Supabase secrets yet if you want care events to stay on the phone. Plaintext cloud sync is implemented but should not be used for real baby data until payloads are encrypted on the device.

A custom domain is nicer for PWA install than `username.github.io/baby-day/`. The Vite `base` is `./` so both work.

## Use it

1. Enter the baby’s name and your name.
2. **Feed → Start left/right** starts a timer. Switch side, then end. Add a formula top-up if you need it. Bottles are a separate choice on the same sheet.
3. **Sleep** is one tap to start and one tap to end.
4. **Diaper** is wet / dirty / both, with optional “10 minutes ago.”
5. Settings: units, care-day start hour (default 5am), 48-hour copy for the pediatrician, JSON/CSV backup.
6. iOS: Share → Add to Home Screen. Android: Install app.

No account is required. Names are stored on the phone so the timeline can say who logged what.

## Documents

- [Current product plan](docs/product-plan.md)
- [Original idea](docs/idea-and-plan.md)
- [Plan review](docs/plan-review.md)
- [Hosting and backend](docs/hosting-and-backend.md)
- [Privacy](docs/privacy.md)
