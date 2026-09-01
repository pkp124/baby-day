# Baby video on the phones you already have

Assessment of a crib-phone → parent-phone video link, without buying a camera, and without sending video off the home network.

**Verdict:** do not start a new repo, and do not start a native app. The current PWA is enough to try this. The hard limits are the phones themselves (dark room, screen must stay on), not the stack.

This is a **live window**, not a camera product and not part of the care log. It should stay optional, LAN-only, and unrecorded.

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

### 1. The crib phone must stay awake and plugged in

The stream dies when iOS suspends the PWA, when Android kills the tab, or when the screen locks. Wake Lock helps; it does not survive a lock or a swipe-away. Treat the crib phone as a plugged-in appliance with the app in the foreground. That is how native baby-monitor apps work too.

### 2. A phone is a terrible night camera

Dedicated baby cameras exist mainly for **IR night vision**. A phone in a dark nursery shows black. A dim night light in the room is the workaround. Do not leave the torch on the baby’s face. If night-dark video is the actual need, a phone will not replace a camera.

### 3. Two phones means one of you has no phone

With the two phones you already pair for handover, the crib role occupies one of them. The setup that actually works is an **old unused phone** on the crib, still on the home Wi-Fi, still linked. Then both parents keep their own phones as watchers.

### 4. Today’s pairing is 1:1

**This Wi-Fi** links two peers. Crib + one watcher fits. Crib + two parents watching at once is a mesh or an SFU. Do not build that until one watcher works. A spare crib phone plus “whoever is home opens Watch” is enough for a family of two.

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
Crib phone (foreground, plugged in)
  getUserMedia (camera, mic optional)
        │  WebRTC media, host-only ICE
        ▼
Watch phone (this PWA, Watch mode)
  <video>  — live only, nothing persisted
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

- One phone in crib mode, one in watch mode, same Wi-Fi, already linked.
- Picture appears within a few seconds of tapping Watch.
- Locking the crib phone stops the picture (honest, not silently frozen).
- No video bytes in IndexedDB, network logs, or the mailbox.
- Home logging still works if you never open crib/watch.

Use it for daytime naps before trusting it at night. The night failure mode is darkness and a sleeping crib phone, not missing native code.
