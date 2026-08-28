# Privacy: can data stay on the devices?

Yes. That is already the default. Shared handover between two phones is the part that forces a choice.

## The constraint

Baby Day has two jobs that pull in opposite directions:

1. **Privacy** — feeding, diapers, sleep, and weight should not sit in a company database in the clear.
2. **Handover** — the other parent should see what happened *while they were in a meeting or asleep*.

Handover while the other phone is off requires a **mailbox**: some place the event can wait. A mailbox that is not either phone is, by definition, off-device.

So:

| Goal | Can data stay only on devices? |
| --- | --- |
| One parent, one phone | **Yes. This is how the app works today.** |
| Two parents, both in the app at the same time | **Yes**, with peer-to-peer sync. Fragile on phones. |
| Two parents, async handover | **Not if “stay on devices” is literal.** You need a mailbox, or you wait until you are together. |

Supabase RLS is *access control* (the other family cannot read your rows). It is not *privacy from the host*. Anyone with the database, a backup, or a service-role key can read feeds in plaintext. For newborn care that is a fair thing to refuse.

## Three honest designs

### A. On this phone only (already built)

Events live in IndexedDB. Nothing is uploaded unless you later connect sync.

Use this if one person is the logger, or you are willing to peek at the same phone / AirDrop an export. Handover as a product feature is off.

Keep this as the default. Never silently create a cloud family.

### B. Local Wi-Fi link (built)

Settings → **This Wi-Fi**. One phone shows a QR (WebRTC offer), the other scans and shows an answer QR. ICE is **host-only** (no STUN, no TURN), so the care events travel on the LAN between the two phones. Pairing codes never go to a server either.

Both apps must stay open on the same network. If someone locks their phone, the link drops; the other phone already has a full local copy of everything received so far. Link again in the evening to catch up. Guest Wi-Fi with AP isolation will fail.

This is handover in the “we are both home” sense, not a mailbox for when one of you is out.

### C. End-to-end encrypted mailbox (recommended if you want both)

Events **do** leave the phone, as ciphertext. The host (Supabase or any blob store) sees opaque rows: `id`, `family_id`, `updated_at`, `nonce`, `ciphertext`. It cannot see method, millilitres, sides, notes, or weight.

A **family key** is created on the first phone and never sent to the server. The second parent gets it by QR or a passphrase you say in person (or store in a password manager). Each device decrypts into IndexedDB and works as today.

This is how a password manager thinks, not how a typical baby tracker thinks.

What the server can still see: that your family exists, roughly how many events you wrote, and when they synced. That is traffic metadata, not “he fed 12 minutes on the left.”

What you must accept: if both of you lose the family key, the cloud copy is unreadable. The on-phone copy and JSON export are the recovery path. Write the passphrase down.

## Recommended product stance

1. **Default remains A.** No account, no upload. The home pill already says “On this phone.”
2. **Do not put plaintext care events in Supabase.** If we turn sharing on, encrypt payloads on the device first (C). RLS stays, as a second fence, not the privacy story.
3. **Do not promise P2P async handover.** It will disappoint at 3am.
4. **Export stays first-class** so you can leave any host without asking it to “give the data back” in the clear.

Signing in with Google still tells Google that this email uses the app. That is separate from feeding data. Prefer a family key plus an anonymous or email account that only authorizes the mailbox, not the content.

## Sketch of C (when we build it)

- Generate a 256-bit family key on device; show a short passphrase and a QR.
- Encrypt `type + time + endedAt + data + memberName` with AES-GCM; store ciphertext only.
- Decrypt on pull, then the current UI/IndexedDB is unchanged.
- Invite = join the mailbox account **and** scan the family key. Missing either piece is useless to an attacker who steals only the database.
- Never log plaintext events to error reporters or analytics.

Until C exists, connecting Supabase would upload plaintext. The UI should keep saying so, and we should not enable it for this family until encryption is in.

## What not to do

- Put events in a git repo, gist, or issue. History never forgets.
- Trust “the URL is secret” or “the family code is long enough.”
- Use the phone’s screenshot folder as a diary.
- Upload cry or room audio. Clips of this baby, if you ever record them, stay on the device and are not mailbox payloads. See [productization-catalog.md](./productization-catalog.md) §16.
