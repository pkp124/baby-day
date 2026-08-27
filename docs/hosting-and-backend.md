# Hosting and backend

Answers to three follow-ups: remaining blind spots, whether Supabase is still the right backend, and whether the whole product can live on GitHub alone.

## Can this live on GitHub alone?

**The app can. The shared baby record cannot.**

GitHub is a good home for:

- Source code and the product docs
- GitHub Actions to build the PWA
- GitHub Pages to serve the static frontend over HTTPS

GitHub does not provide:

- A database
- Recoverable family authentication
- Row-level authorization
- Realtime fan-out to the other parent’s phone
- A always-on API

GitHub Pages is a static file host. It will serve `index.html`, JS, CSS, the manifest, and the service worker. It will not run Postgres, accept a `POST /events`, or keep a WebSocket open. GitHub Actions is ephemeral CI, not a server.

So “deploy on GitHub” should mean: **the PWA is deployed from this repo; the family data lives somewhere else.** That is a normal and good split. It is not GitHub-only.

### What “GitHub-only” would actually mean

| Approach | Why it fails for this product |
| --- | --- |
| Pages PWA, local-only, no backend | Handover dies. The other parent does not see the feed. |
| Save events as JSON commits in a private repo | Merge conflicts, no realtime, git history never forgets deletes, and a token in the browser is a repo-wide credential. |
| GitHub Issues / Discussions as the database | Public-ish, rate-limited, wrong shape, the other parent needs a GitHub account. |
| GitHub OAuth as the only identity | The second parent should not need a GitHub login to log a diaper at 3am. |
| Actions cron that “syncs files” | Minutes of lag, no offline story, still not a database. |

A local-only PWA on Pages is a valid **demo**. It is not the product in the plan.

**Do not try to store baby events in git.** Intimate data plus immutable history is the wrong combination.

### What GitHub Pages *is* good for here

For two parents, Pages is enough as the CDN:

- HTTPS is included
- Bandwidth and size limits are irrelevant at this scale
- Actions can inject the public Supabase URL and anon key at build time
- A custom domain (recommended) avoids the `/baby-day/` path prefix that breaks naive service workers and install URLs

Constraints to design for:

1. **The site URL is public.** Even if the repo is private, a github.io (or custom domain) Pages site is on the open internet unless you are on Enterprise Cloud private Pages. Protection is login + RLS, not a secret URL.
2. **GitHub Free only publishes Pages from public repos.** Private repo + Pages usually needs GitHub Pro. If the repo stays public, that is fine as long as **no family data, invite tokens, or service keys** are in it. The anon key is designed to be public.
3. **No server rewrites.** Use hash routes (`#/today`) or a `404.html` fallback. Refreshing `/dashboard` will 404 otherwise.
4. **Service worker scope.** If the app is at `https://pkp124.github.io/baby-day/`, the worker and manifest must use that base path. A user-site repo (`pkp124.github.io`) or a custom domain is less painful.
5. **Stale service workers.** After a deploy, phones may keep an old shell. Need a visible “Update available” reload. This is a PWA bug, not a GitHub bug.
6. **GitHub’s Pages policy** says Pages should not be used for sensitive transactions like sending passwords or credit cards. Auth should go to the backend (Supabase magic link / OAuth), not a homemade login form that posts secrets to GitHub.

**Recommendation:** GitHub Pages (or Cloudflare Pages if the subpath/private-repo friction annoys you) for the frontend. Not GitHub for data.

## Do I still recommend Supabase?

**Yes, for this family app.** It is still the best default.

You already designed around Postgres, RLS, recoverable auth, and realtime. Supabase is that bundle without you running a server at 2am with a newborn.

Why it still fits:

- Two users is nowhere near free-tier size (500MB DB, 50k MAU, realtime well above two phones)
- RLS matches “only my family can read these events” without writing an API
- Auth + Postgres + Realtime in one project, one dashboard
- The publishable anon key in a Pages bundle is the intended model
- Local-first still works when Supabase is down: log locally, flush the outbox later
- Export/CSV is straightforward from Postgres

Why not “just Postgres on GitHub”: there is no such product.

### Caveats that matter for a baby tracker

**Free projects pause after about a week of low activity.** During the newborn months you will hit the database many times a day, so this should not bite. It *will* bite when you stop logging and come back three months later for a weight chart: the project may be paused until you resume it in the dashboard (restorable for up to a year). Free tier also has **no real point-in-time backup**. The in-app export is the backup. Keep that in MVP.

**Magic links can land in spam.** For two tired parents, **Google (or Apple) OAuth** is often less fragile than email. Offer one OAuth provider plus magic link as fallback. Do not depend on the partner checking a spam folder during a night feed.

**Pick a region close to you.** Realtime is a persistent connection; a US project from India (or the reverse) is usable but laggier. Set this on day one; migrating region later is a new project.

**Expired sessions vs the offline outbox.** If a phone stays offline long enough that the refresh token dies, queued events must **stay in IndexedDB** and sync only after the parent signs in again. A 401 must not wipe the queue. This is easy to get wrong and would look like “the app ate the night feeds.”

**No built-in family invite.** You will write `families` / `family_members` / hashed invite tokens and an RPC or Edge Function to accept a join. That is the main piece of backend you actually own. It is still less work than running your own auth.

**Realtime can fail on locked-down WFH networks** that block WebSockets. Need a dumb fallback: refetch on focus / interval. Logging must never wait on realtime.

### Alternatives (only if you reject Supabase)

| Option | When it is better | Cost of switching |
| --- | --- | --- |
| Firebase (Auth + Firestore) | You already live in Google Cloud | You lose SQL/RLS; security rules are easy to get wrong |
| Cloudflare Pages + D1 + Workers | You want one vendor and a nicer Pages story than GitHub | You write more auth/invite code yourself |
| PocketBase on a small VPS | You want SQLite and to own the box | You are on-call for the box |
| InstantDB / similar local-first BaaS | You want sync as the product | Newer, less RLS-shaped |

I would **not** start here with Firebase unless you already prefer it. I would **not** self-host PocketBase while caring for a newborn. Cloudflare is the best “we outgrew GitHub Pages” frontend move, not a reason to skip a BaaS today.

**Stay with Supabase + GitHub Pages** until the app is boringly useful on two phones.

## Blind spots still worth naming

These are in addition to breast-side timers, iOS eviction, care-day, and undo from the [plan review](./plan-review.md).

### Product / family

- **The other parent is the adoption problem.** If only one person logs, you built a personal diary. Measure “both parents logged today,” not just event count.
- **Shared Google/Apple accounts.** Some couples share one identity. Attribution and recovery both break. Each parent needs their own login.
- **Invite links leak.** WhatsApp previews, screenshots, grandparents forwarding. Make invites single-use or short-lived, and let a parent revoke them.
- **Who owns the data if the relationship changes.** Unpleasant, worth one sentence in the model: a family has members; leaving should not silently delete the other parent’s history. Defer a fancy UI; do not make “delete my account” wipe the baby’s record without an explicit choice.
- **Hospital / visitors / a night nurse.** Out of scope. Do not add a guest role in v1.
- **This will look like health data.** It is not a medical device and should not give advice. Still: no third-party analytics, no error-reporter that uploads event payloads, no public repo samples with real feeds.

### App / devices

- **Two tabs on a WFH laptop.** Two live timers must not fork. Use `BroadcastChannel` or treat the in-progress event in IndexedDB as the source of truth.
- **Wrong phone clock.** Rare, but “feed at 03:00” follows the device. Allow easy time edit; do not try to correct clocks.
- **PWA install is a ritual on iOS.** There is no “Install” banner like Android. Budget a 30-second walkthrough: Share → Add to Home Screen. Push notifications should not be in the first version; iOS PWA push is still a weak foundation.
- **Service worker caching the API.** Cache the shell only. If you cache GET `/events`, parents will see yesterday’s handover after a deploy.
- **Desktop vs phone.** WFH dashboard on a large screen is a layout, not a second app. Same data, bigger timeline.

### Security / ops

- **Public frontend, private data** is the security model. RLS tested with two users in two families is part of definition of done, not a polish item.
- **Never put the Supabase service role key in Actions logs, the Pages bundle, or this repo.** Only the anon key is frontend-safe.
- **Do not enable a default open storage bucket “just in case” for photos.** No attachments in v1.
- **Free-tier pause and no PITR** — export is the disaster plan. Test export on a real phone, not only in a browser profile.

## Recommended deployment shape

```text
GitHub repo
  └── GitHub Actions (build PWA)
        └── GitHub Pages  →  phones / laptop  (static app, public URL)
                                │
                                │  HTTPS, anon key
                                ▼
                         Supabase project
                           Auth (OAuth + magic link)
                           Postgres + RLS
                           Realtime (plus poll-on-focus fallback)
```

What you operate day to day: this GitHub repo, one Supabase project, optionally a custom domain. No VPS.

What you should lock before writing code:

1. Frontend on GitHub Pages (custom domain if you have one).
2. Data and auth on Supabase, region chosen once.
3. Google (or Apple) sign-in as the primary login; magic link as backup.
4. Public app URL is expected; RLS is the boundary.
5. Offline outbox survives 401s; export is the backup; pause is acceptable after you stop using the app.
