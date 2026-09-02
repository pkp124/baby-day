# Baby Day technical notes

For someone installing, hosting, or changing the app. Parents who only want to log a feed should read [user-guide.md](./user-guide.md). In the app: `#/tech`. On the GitHub Pages site: `tech/`.

## Stack

Vite + TypeScript + React PWA. Dexie (IndexedDB) is the source of truth on the device. The service worker caches the app shell only, not care events. Vitest covers domain, merge, report, passkey, and page helpers.

There is no required backend. Optional Supabase exists for an invite-based cloud mailbox; it currently stores plaintext event rows and must stay off for real baby data until payloads are encrypted on the device.

## Data model

Events are append-first with client UUIDs, `rev`, `updatedAt`, and `deletedAt` tombstones. Last-write-wins on sync. Canonical units: millilitres, grams, seconds, Celsius. Display units are a settings concern.

A breastfeed is a session: `startedOn`, per-side seconds, optional `activeSide` while the timer runs. Bottles carry `volumeMl` / `formulaMl` / `expressedMl`. The care day is a timezone + start-hour window (default 05:00).

Settings live in the Dexie `meta` table. Beside baby identity they include:

- `cribPasskey` — stable crib-camera code
- `lanPasskey`, `lanPasskeyRememberUntil`, `lanPasskeyTtl` (`day` | `week`), `lanPasskeyRole` (`host` | `guest`) — one-tap Sync after the first Wi-Fi pair

## Hash routes

GitHub Pages has no server rewrites. Navigation is hash-based:

| Hash | Screen |
| --- | --- |
| `#/` | Home logging dashboard |
| `#/report` | 72-hour report and trends |
| `#/camera` | Crib / watch hub |
| `#/crib`, `#/watch` | Full-screen media |
| `#/settings` | Family, backup, This Wi-Fi |
| `#/guide`, `#/tech` | In-app documents; extra path is an in-page section (`#/guide/sync`) |

Static copies also ship at `guide/` and `tech/` on the GitHub Pages site so the same writing can be opened without installing the PWA.

## LAN event sync

WebRTC data channel, host-only ICE (no STUN, no TURN). A 6-digit passkey names a short-lived public mailbox (default `ntfy.sh`, topic `bdpairNNNNNN`) that carries compressed SDP only. Care events then move on the LAN. QR remains an offline fallback.

First pairing still shows or types the passkey. On data-channel open the app persists that code with an expiry of 24 hours or 7 days. Later, `syncLan()` reuses the saved code: the remembered host calls `startLanHostPasskey(code)`, the remembered guest calls `joinLanPasskey(code)`. If the channel is already open, Sync re-sends `hello` so both sides exchange digests again.

Reusing a 6-digit topic is the same threat model as the crib passkey: anyone who saw the digits could try to handshake, but ICE is host-only so the data path still has to be on the LAN. Forget the saved key, or show a new one, to rotate.

Relevant files: `src/lib/lan.ts`, `src/lib/lanRemember.ts`, `src/lib/pairMailbox.ts`, `src/components/LanCard.tsx`.

## Crib media

Separate `RTCPeerConnection` for media tracks. Mailbox topic `bdcribNNNNNN` so it cannot collide with event pairing. Crib ICE may keep STUN `srflx` so iOS mDNS addresses can still find a LAN path; relay/TURN candidates are dropped. Camera and mic start only while someone is watching.

The crib passkey is stable and stored in settings. Watch remembers it after the first successful join. The Camera tab is the hub; crib/watch routes are full-screen and stop media on unmount.

See [video-monitor.md](./video-monitor.md).

## Privacy stance

Default A: on this phone only. Path B: LAN copy while both apps are open. Path C (not built): end-to-end encrypted mailbox. Do not put plaintext events in git, gists, or Supabase. Do not record crib video. Do not add TURN “so it works from the office.”

Details: [privacy.md](./privacy.md).

## Hosting and development

Static PWA. GitHub Actions builds `dist/` and deploys GitHub Pages on push to `main`. Vite `base` is `./` so a project site or a custom domain both work. Leave Supabase secrets empty for a private default.

```bash
npm install
npm test
npm run dev
npm run build
```

Node 22. Open the Vite URL from the phone on the same network, or Chrome device emulation.

More hosting notes: [hosting-and-backend.md](./hosting-and-backend.md).
