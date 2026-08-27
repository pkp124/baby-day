# Baby Day

A shared, low-friction newborn care companion for two parents.

Log feeds (including time on each breast), bottles, diapers, sleep, weight, and notes in a few taps. The home screen shows time since the last feed/diaper/sleep, today’s totals, and what happened while the other parent was away.

The app is **local-first**. It works on one phone with no account. Pair it with Supabase when you want both phones to share the same record.

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
2. Optional, for two-phone sync: create a Supabase project, run [`supabase/schema.sql`](supabase/schema.sql), enable Google and/or Email auth, and add Actions secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Never put the Supabase **service role** key in this repo or in the frontend.

Until those secrets exist, the deployed app still works on-device. Settings will say “on this phone only.”

A custom domain is nicer for PWA install than `username.github.io/baby-day/`. The Vite `base` is `./` so both work.

## Use it

1. Enter the baby’s name and your name.
2. **Feed → Start left/right** starts a timer. Switch side, then end. Add a formula top-up if you need it. Bottles are a separate choice on the same sheet.
3. **Sleep** is one tap to start and one tap to end.
4. **Diaper** is wet / dirty / both, with optional “10 minutes ago.”
5. Settings: units, care-day start hour (default 5am), 48-hour copy for the pediatrician, JSON/CSV backup.
6. iOS: Share → Add to Home Screen. Android: Install app.

Each parent needs their own Google/email login. Do not share one account if you want attribution and recovery.

## Documents

- [Current product plan](docs/product-plan.md)
- [Original idea](docs/idea-and-plan.md)
- [Plan review](docs/plan-review.md)
- [Hosting and backend](docs/hosting-and-backend.md)
