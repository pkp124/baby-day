import { useSyncExternalStore } from "react";
import { toDataURL } from "qrcode";
import { db, getSettings, onEventCommit, putEvent, saveSettings } from "./db";
import { gunzipBd1, gzipToBd1 } from "./gzip";
import { digestOf, eventsNeeded, hostOnlySdp, shouldApplyIncoming } from "./lanMerge";
import { localHostSdp, newLanPeer } from "./lanRtc";
import { generatePasskey, isValidPasskey, normalizePasskey } from "./pairCode";
import { openPairMailbox, type PairMailbox, type PairWire } from "./pairMailbox";
import type { CareEvent, Settings } from "./types";

export type LanPhase = "idle" | "host-offer" | "guest-wait" | "guest-answer" | "connected" | "error";
export type PairingMode = "off" | "passkey" | "qr";

export type LanState = {
  phase: LanPhase;
  pairing: PairingMode;
  passkey: string;
  offerText: string;
  answerText: string;
  offerQr: string;
  answerQr: string;
  partnerName: string;
  lastSyncAt: string;
  error: string;
};

const idle: LanState = {
  phase: "idle",
  pairing: "off",
  passkey: "",
  offerText: "",
  answerText: "",
  offerQr: "",
  answerQr: "",
  partnerName: "",
  lastSyncAt: "",
  error: "",
};

let state: LanState = { ...idle };
const listeners = new Set<() => void>();
let pc: RTCPeerConnection | null = null;
let channel: RTCDataChannel | null = null;
let role: "host" | "guest" | null = null;
let unhook: (() => void) | null = null;
let mailbox: PairMailbox | null = null;
let lastOfferSignal = "";
let lastOfferName = "";
let remoteSet = false;
let guestBusy = false;
let pairTimer: number | null = null;
let pairingLock = false;

function emit(patch: Partial<LanState>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

export function subscribeLan(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getLanState() {
  return state;
}

export function useLan() {
  return useSyncExternalStore(subscribeLan, getLanSnapshot, getLanSnapshot);
}

function getLanSnapshot() {
  return state;
}

type HelloMsg = {
  kind: "hello";
  name: string;
  memberId: string;
  familyId: string;
  babyId: string;
  babyName: string;
  cribPasskey?: string;
};
type DigestMsg = { kind: "digest"; items: ReturnType<typeof digestOf> };
type EventsMsg = { kind: "events"; events: CareEvent[] };
type EventMsg = { kind: "event"; event: CareEvent };
type Wire = HelloMsg | DigestMsg | EventsMsg | EventMsg;

export async function encodeSignal(payload: unknown) {
  return gzipToBd1(JSON.stringify(payload));
}

export async function decodeSignal(text: string) {
  return JSON.parse(await gunzipBd1(text)) as { t: "offer" | "answer"; sdp: string; name: string };
}

async function toQr(text: string) {
  return toDataURL(text, { margin: 1, width: 360, errorCorrectionLevel: "M", color: { dark: "#1c1712", light: "#f6efe6" } });
}

async function localPayload(type: "offer" | "answer", name: string, peer: RTCPeerConnection) {
  const sdp = await localHostSdp(peer);
  return encodeSignal({ t: type, sdp, name });
}

function send(msg: Wire) {
  if (channel?.readyState === "open") channel.send(JSON.stringify(msg));
}

async function onWire(msg: Wire) {
  const settings = await getSettings();
  switch (msg.kind) {
    case "hello": {
      emit({ partnerName: msg.name });
      const patch: Partial<Settings> = {};
      const theirs = normalizePasskey(msg.cribPasskey ?? "");
      const mine = normalizePasskey(settings.cribPasskey);
      if (role === "guest") {
        const events = await db.events.toArray();
        for (const event of events) {
          if (event.familyId !== msg.familyId || event.babyId !== msg.babyId) {
            await db.events.put({ ...event, familyId: msg.familyId, babyId: msg.babyId });
          }
        }
        patch.familyId = msg.familyId;
        patch.babyId = msg.babyId;
        patch.babyName = msg.babyName || settings.babyName;
        if (isValidPasskey(theirs)) patch.cribPasskey = theirs;
      } else if (isValidPasskey(theirs) && !isValidPasskey(mine)) {
        patch.cribPasskey = theirs;
      }
      if (Object.keys(patch).length) await saveSettings(patch);
      send({ kind: "digest", items: digestOf(await db.events.toArray()) });
      return;
    }
    case "digest": {
      const mine = await db.events.toArray();
      const needed = eventsNeeded(msg.items, mine);
      for (let i = 0; i < needed.length; i += 40) {
        send({ kind: "events", events: needed.slice(i, i + 40) });
      }
      return;
    }
    case "events":
      for (const incoming of msg.events) await applyIncoming(incoming);
      emit({ lastSyncAt: new Date().toISOString() });
      return;
    case "event":
      await applyIncoming(msg.event);
      emit({ lastSyncAt: new Date().toISOString() });
      return;
    default: {
      const _never: never = msg;
      return _never;
    }
  }
}

async function applyIncoming(incoming: CareEvent) {
  const local = await db.events.get(incoming.id);
  if (!shouldApplyIncoming(local, incoming)) return;
  await putEvent(incoming, { queue: false, silent: true });
}

async function hello() {
  const settings = await getSettings();
  send({
    kind: "hello",
    name: settings.caregiverName || "Parent",
    memberId: settings.caregiverId,
    familyId: settings.familyId,
    babyId: settings.babyId,
    babyName: settings.babyName,
    cribPasskey: isValidPasskey(normalizePasskey(settings.cribPasskey)) ? normalizePasskey(settings.cribPasskey) : undefined,
  });
}

function bindChannel(next: RTCDataChannel) {
  channel = next;
  next.binaryType = "arraybuffer";
  next.onopen = () => {
    clearPairTimer();
    closeMailbox();
    emit({ phase: "connected", error: "", lastSyncAt: new Date().toISOString() });
    void hello();
  };
  next.onclose = () => {
    if (state.phase === "connected") emit({ phase: "idle", pairing: "off", passkey: "", error: "" });
  };
  next.onmessage = (ev) => {
    try {
      void onWire(JSON.parse(String(ev.data)) as Wire);
    } catch (err) {
      console.error(err);
    }
  };
}

function watchLocal() {
  unhook?.();
  unhook = onEventCommit((event) => {
    if (state.phase !== "connected") return;
    send({ kind: "event", event });
  });
}

function closeMailbox() {
  mailbox?.close();
  mailbox = null;
  lastOfferSignal = "";
  lastOfferName = "";
}

function clearPairTimer() {
  if (pairTimer != null) window.clearTimeout(pairTimer);
  pairTimer = null;
}

function armPairTimeout() {
  clearPairTimer();
  pairTimer = window.setTimeout(() => {
    if (state.phase === "connected") return;
    closeMailbox();
    teardownPeer();
    guestBusy = false;
    emit({
      ...idle,
      phase: "error",
      error: "That passkey timed out. Show or enter a new one.",
    });
  }, 180_000);
}

function teardownPeer() {
  unhook?.();
  unhook = null;
  channel?.close();
  pc?.close();
  channel = null;
  pc = null;
  role = null;
  remoteSet = false;
}

function pairError(err: unknown) {
  const message = err instanceof Error ? err.message : "Could not use that passkey";
  closeMailbox();
  teardownPeer();
  guestBusy = false;
  clearPairTimer();
  emit({ ...idle, phase: "error", error: message });
}

export function disconnectLan() {
  clearPairTimer();
  closeMailbox();
  teardownPeer();
  guestBusy = false;
  const partner = state.partnerName;
  emit({ ...idle, partnerName: partner });
}

export async function startLanHost() {
  closeMailbox();
  clearPairTimer();
  guestBusy = false;
  await beginHostOffer("qr");
}

export async function startLanHostPasskey() {
  if (pairingLock) return;
  pairingLock = true;
  closeMailbox();
  teardownPeer();
  guestBusy = false;
  const passkey = generatePasskey();
  emit({
    phase: "host-offer",
    pairing: "passkey",
    passkey,
    offerText: "",
    offerQr: "",
    answerText: "",
    answerQr: "",
    error: "",
    partnerName: "",
  });
  armPairTimeout();
  try {
    mailbox = await openPairMailbox(passkey, onHostPair, (err) => pairError(err));
    await beginHostOffer("passkey");
    const settings = await getSettings();
    lastOfferSignal = getLanState().offerText;
    lastOfferName = settings.caregiverName || "Parent";
    await mailbox.publish({ k: "offer", signal: lastOfferSignal, name: lastOfferName });
  } catch (err) {
    pairError(err);
  } finally {
    pairingLock = false;
  }
}

async function beginHostOffer(pairing: PairingMode) {
  teardownPeer();
  role = "host";
  watchLocal();
  const settings = await getSettings();
  pc = newLanPeer();
  bindChannel(pc.createDataChannel("babyday", { ordered: true }));
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  const offerText = await localPayload("offer", settings.caregiverName || "Parent", pc);
  emit({
    phase: "host-offer",
    pairing,
    offerText,
    offerQr: await toQr(offerText),
    passkey: pairing === "passkey" ? state.passkey : "",
    answerText: "",
    answerQr: "",
    error: "",
    partnerName: "",
  });
}

async function onHostPair(msg: PairWire) {
  if (msg.k === "hello" && lastOfferSignal && mailbox) {
    void mailbox.publish({ k: "offer", signal: lastOfferSignal, name: lastOfferName }).catch((err: unknown) => pairError(err));
    return;
  }
  if (msg.k === "answer" && msg.signal) {
    try {
      await acceptLanAnswer(msg.signal);
    } catch (err) {
      pairError(err);
    }
  }
}

export async function acceptLanAnswer(raw: string) {
  if (!pc) throw new Error("Start this phone first");
  if (remoteSet) return;
  const signal = await decodeSignal(raw);
  if (signal.t !== "answer") throw new Error("That code is not an answer");
  await pc.setRemoteDescription({ type: "answer", sdp: hostOnlySdp(signal.sdp) });
  remoteSet = true;
  emit({ partnerName: signal.name || state.partnerName });
}

export async function startLanGuest(raw: string) {
  closeMailbox();
  clearPairTimer();
  guestBusy = false;
  await beginGuestAnswer(raw, "qr");
}

export async function joinLanPasskey(raw: string) {
  const passkey = normalizePasskey(raw);
  if (!isValidPasskey(passkey)) throw new Error("Enter the 6-digit passkey");
  if (pairingLock) throw new Error("This phone is already linking");
  pairingLock = true;
  closeMailbox();
  teardownPeer();
  guestBusy = false;
  emit({
    phase: "guest-wait",
    pairing: "passkey",
    passkey,
    offerText: "",
    offerQr: "",
    answerText: "",
    answerQr: "",
    error: "",
    partnerName: "",
  });
  armPairTimeout();
  try {
    mailbox = await openPairMailbox(passkey, onGuestPair, (err) => pairError(err));
    await mailbox.publish({ k: "hello" });
  } catch (err) {
    pairError(err);
    throw err instanceof Error ? err : new Error("Could not use that passkey");
  } finally {
    pairingLock = false;
  }
}

async function onGuestPair(msg: PairWire) {
  if (msg.k !== "offer" || !msg.signal || guestBusy) return;
  guestBusy = true;
  try {
    await beginGuestAnswer(msg.signal, "passkey");
    const answerText = getLanState().answerText;
    const settings = await getSettings();
    await mailbox?.publish({ k: "answer", signal: answerText, name: settings.caregiverName || "Parent" });
  } catch (err) {
    pairError(err);
  }
}

async function beginGuestAnswer(raw: string, pairing: PairingMode) {
  teardownPeer();
  role = "guest";
  watchLocal();
  const settings = await getSettings();
  const signal = await decodeSignal(raw);
  if (signal.t !== "offer") throw new Error("That code is not an offer from the other phone");
  pc = newLanPeer();
  pc.ondatachannel = (ev) => bindChannel(ev.channel);
  await pc.setRemoteDescription({ type: "offer", sdp: hostOnlySdp(signal.sdp) });
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  const answerText = await localPayload("answer", settings.caregiverName || "Parent", pc);
  emit({
    phase: "guest-answer",
    pairing,
    answerText,
    answerQr: await toQr(answerText),
    passkey: pairing === "passkey" ? state.passkey : "",
    offerText: "",
    offerQr: "",
    error: "",
    partnerName: signal.name,
  });
}

export function lanError(message: string) {
  emit({ phase: "error", error: message });
}
