# Baby video on the phones you already have

Assessment of a crib-phone → parent-phone video link, without buying a camera, and without sending video off the home network.

**Verdict:** do not start a new repo, and do not start a native app. The current PWA is enough to try this. The hard limits are the phones themselves (dark room, screen must stay on), not the stack.

This is a **live window**, not a camera product and not part of the care log. It is optional, LAN-only, and unrecorded.

**Built:** Settings → **Use this phone as crib** / **Watch the crib**. The crib phone shows a 6-digit passkey and keeps the camera **off** until someone opens Watch. Both parents can type that passkey and watch at the same time. Hashes `#/crib` and `#/watch` keep the crib phone on that screen after a reload. This does not use the event-sync Wi-Fi link.

## What you are asking for

1. Put one already-linked phone on the crib (or a spare phone).
2. Watch that picture on the other linked phone.
3. Video never leaves the home network. Same privacy bar as **This Wi-Fi** for events.
4. No dedicated baby camera.

That is a two-role session: **crib** (publisher) and **watch** (viewer). It is not a new baby record, and it is not handover.

## Do we need a separate repo?

**No.**

A second repo would mean a second install, a second pairing story, and a second origin for camera permission. The family already has a passkey, WebRTC, and host-only ICE in this app. Video should reuse that identity and that LAN rule.

Keep the code here as a separate mode (`#/crib`, `#/watch`), not mixed into the home logging screen. If it ever grows into something with its own release cadence, split later. Splitting first would only add friction.

## Is the current web app enough, or do we need a phone app?

**The PWA is enough to ship a first version.** Camera, microphone, and WebRTC already work in mobile Safari and Chrome. This app already opens the camera to scan a QR, and it already holds a LAN peer connection for event sync.

A native app (React Native, Capacitor, Swift/Kotlin) is **not required** for “phone A shows phone B.” Native does not magically give you:

- infrared night vision (that is hardware)
- a crib phone that keeps filming with the screen locked (iOS will not allow that in a normal app either)
- video that stays on the LAN (that is an ICE policy, which we already have)

Buy a native shell only if, after using the PWA, the remaining pain is specifically: Android OEM process killing, a reliable foreground service, or wanting the crib role to survive leaving the app. That is a reliability upgrade, not a prerequisite.

## What we would reuse vs what is new

Already in this repo:

- 6-digit passkey + QR pairing
- WebRTC with **host-only ICE** (no STUN, no TURN) so media candidates stay on the LAN
- A short-lived public mailbox for the handshake only (`ntfy.sh` by default). That mailbox must never carry video frames.
- Screen wake lock while a timer runs
- `getUserMedia` for the QR scanner

What a first version would add:

- A **crib** screen: full-screen camera preview, keep awake, stay on this page, optional mute of the mic, a clear “streaming on this Wi-Fi only” line
- A **watch** screen: full-screen incoming video, tap-to-unmute (iOS will not autoplay sound)
- A second `RTCPeerConnection` for **media tracks**, or a renegotiation of the existing one. Do not stuff JPEG frames through the current data channel.
- Reconnect when Wi-Fi blips. The current event link already drops when a phone locks; video will be worse, not better.
- Copy that states: live only, not saved, not uploaded.

Do **not** write video into IndexedDB, git, or Supabase. Do **not** add STUN/TURN “so it works when someone is out.” Off-home viewing is a different product and would send media through a relay.

## Constraints you have to accept (this is the real product)

### 1. The crib phone must stay awake enough to hear a watch request

The camera and encoder stay off until a parent opens Watch. That is the power win.

The crib PWA still has to be running to receive that request. If iOS suspends it (lock, swipe away), nobody can start the picture until you unlock the crib phone. Wake Lock plus Auto-Lock → Never plus plugged in is the practical setup. Unlocking resumes: if someone is waiting, the camera starts then.

A native Android foreground service could film with the screen off. iOS will not, even in a native baby-monitor app, without keeping the screen on. Do not buy a native wrapper for lock-survival on iPhone.

### 2. A phone is a terrible night camera

Dedicated baby cameras exist mainly for **IR night vision**. A phone in a dark nursery shows black. A dim night light in the room is the workaround. Do not leave the torch on the baby’s face. If night-dark video is the actual need, a phone will not replace a camera.

### 3. Use a spare phone as the crib

With only the two parent phones, the crib role occupies one of them. The setup that works is an **old unused phone** on the crib, plugged in, this screen left on. Both parents keep their own phones as watchers.

### 4. Both parents can watch

The crib phone is a small room, not the 1:1 event-sync link. It shows a passkey. Each parent types it. The crib fans the live picture out to everyone currently watching (up to four). When the last watcher leaves, the camera turns off.

### 5. Audio is more sensitive than video

[privacy.md](./privacy.md) already refuses cry/audio upload. Live audio on the LAN is useful (a stirring baby) and still never stored. Default the mic **off**; let the watcher unmute. Do not record, do not transcribe, do not detect cries.

## Privacy rule (non-negotiable)

| Path | Allowed? |
| --- | --- |
| RTP/WebRTC on the home LAN, host ICE only | Yes |
| Handshake mailbox (passkey / ntfy) carrying SDP, not frames | Yes, same as event pairing |
| Recording to the phone, cloud, or this repo | No in v1 |
| STUN/TURN, cloud SFU, “watch from the office” | No, unless you explicitly drop the “stays in the lab” rule |

The host of GitHub Pages never sees frames. The mailbox never sees frames. If both phones are on guest Wi-Fi with client isolation, it will fail the same way event sync already fails.

## Recommended shape if we build it

```text
Crib phone (screen on, camera off)
  waits for a Watch passkey join
        │  on first watcher: open camera
        │  WebRTC media, host-only ICE, one stream per watcher
        ▼
Parent phones (Watch)
  <video>  — live only, nothing persisted
  last watcher leaving turns the crib camera off
```

Same origin, same installed PWA, same family passkey. Two buttons in Settings, next to **This Wi-Fi**: **Use this phone as crib** / **Watch the crib**. The home screen stays a logging dashboard.

## What not to do

- A second GitHub repo or a “Baby Cam” product name
- Capacitor/React Native before the PWA has been used at nap time
- Mixing a live video tile onto the feed/diaper home screen
- Saving clips “just in case”
- Cloud streaming so a parent can watch from work
- Cry detection, motion alerts, or any analysis of the stream
- Buying a camera for this experiment. Try a spare phone + a night light first. Buy hardware only if night-dark video is the requirement you will not compromise.

## Definition of done for a first try

- Crib phone in standby, camera off, both parents can open Watch with the crib passkey.
- Picture appears within a few seconds of the first Watch join; camera stops when the last watcher leaves.
- Locking the crib phone prevents a new Watch join until you unlock it (honest, not silently frozen).
- No video bytes in IndexedDB, network logs, or the mailbox.
- Home logging still works if you never open crib/watch.

Use it for daytime naps before trusting it at night. The night failure mode is darkness and a sleeping crib phone, not missing native code.
