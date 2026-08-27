import { useSyncExternalStore } from "react";
import { toDataURL } from "qrcode";
import { db, getSettings, onEventCommit, putEvent, saveSettings } from "./db";
import { digestOf, eventsNeeded, hostOnlySdp, shouldApplyIncoming } from "./lanMerge";
import type { CareEvent } from "./types";

export type LanPhase = "idle" | "host-offer" | "guest-answer" | "connected" | "error";

export type LanState = {
  phase: LanPhase;
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
};
type DigestMsg = { kind: "digest"; items: ReturnType<typeof digestOf> };
type EventsMsg = { kind: "events"; events: CareEvent[] };
type EventMsg = { kind: "event"; event: CareEvent };
type Wire = HelloMsg | DigestMsg | EventsMsg | EventMsg;

function b64url(bytes: Uint8Array) {
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function unb64url(text: string) {
  const pad = text + "===".slice((text.length + 3) % 4);
  const bin = atob(pad.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function encodeSignal(payload: unknown) {
  const json = new TextEncoder().encode(JSON.stringify(payload));
  const gzip = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
  const buf = new Uint8Array(await new Response(gzip).arrayBuffer());
  return `BD1.${b64url(buf)}`;
}

export async function decodeSignal(text: string) {
  const raw = text.trim();
  const body = raw.startsWith("BD1.") ? raw.slice(4) : raw;
  const bytes = unb64url(body);
  const unzip = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  const json = await new Response(unzip).text();
  return JSON.parse(json) as { t: "offer" | "answer"; sdp: string; name: string };
}

async function toQr(text: string) {
  return toDataURL(text, { margin: 1, width: 360, errorCorrectionLevel: "M", color: { dark: "#1c1712", light: "#f6efe6" } });
}

function waitGathering(peer: RTCPeerConnection) {
  if (peer.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = () => {
      peer.removeEventListener("icegatheringstatechange", onChange);
      resolve();
    };
    const onChange = () => {
      if (peer.iceGatheringState === "complete") done();
    };
    peer.addEventListener("icegatheringstatechange", onChange);
    window.setTimeout(done, 3000);
  });
}

function newPeer() {
  return new RTCPeerConnection({ iceServers: [], iceCandidatePoolSize: 0 });
}

async function localPayload(type: "offer" | "answer", name: string, peer: RTCPeerConnection) {
  await waitGathering(peer);
  const sdp = hostOnlySdp(peer.localDescription?.sdp ?? "");
  return encodeSignal({ t: type, sdp, name });
}

function send(msg: Wire) {
  if (channel?.readyState === "open") channel.send(JSON.stringify(msg));
}

async function onWire(msg: Wire) {
  const settings = await getSettings();
  if (msg.kind === "hello") {
    emit({ partnerName: msg.name });
    if (role === "guest") {
      const events = await db.events.toArray();
      for (const event of events) {
        if (event.familyId !== msg.familyId || event.babyId !== msg.babyId) {
          await db.events.put({ ...event, familyId: msg.familyId, babyId: msg.babyId });
        }
      }
      await saveSettings({
        familyId: msg.familyId,
        babyId: msg.babyId,
        babyName: msg.babyName || settings.babyName,
      });
    }
    const events = await db.events.toArray();
    send({ kind: "digest", items: digestOf(events) });
    return;
  }
  if (msg.kind === "digest") {
    const mine = await db.events.toArray();
    const needed = eventsNeeded(msg.items, mine);
    for (let i = 0; i < needed.length; i += 40) {
      send({ kind: "events", events: needed.slice(i, i + 40) });
    }
    return;
  }
  if (msg.kind === "events") {
    for (const incoming of msg.events) await applyIncoming(incoming);
    emit({ lastSyncAt: new Date().toISOString() });
    return;
  }
  if (msg.kind === "event") {
    await applyIncoming(msg.event);
    emit({ lastSyncAt: new Date().toISOString() });
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
  });
}

function bindChannel(next: RTCDataChannel) {
  channel = next;
  next.binaryType = "arraybuffer";
  next.onopen = () => {
    emit({ phase: "connected", error: "", lastSyncAt: new Date().toISOString() });
    void hello();
  };
  next.onclose = () => {
    if (state.phase === "connected") emit({ phase: "idle", error: "" });
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

function teardown() {
  unhook?.();
  unhook = null;
  channel?.close();
  pc?.close();
  channel = null;
  pc = null;
  role = null;
}

export function disconnectLan() {
  teardown();
  const partner = state.partnerName;
  emit({ ...idle, partnerName: partner });
}

export async function startLanHost() {
  teardown();
  role = "host";
  watchLocal();
  const settings = await getSettings();
  pc = newPeer();
  bindChannel(pc.createDataChannel("babyday", { ordered: true }));
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  const offerText = await localPayload("offer", settings.caregiverName || "Parent", pc);
  emit({
    phase: "host-offer",
    offerText,
    offerQr: await toQr(offerText),
    answerText: "",
    answerQr: "",
    error: "",
    partnerName: "",
  });
}

export async function acceptLanAnswer(raw: string) {
  if (!pc) throw new Error("Start this phone first");
  const signal = await decodeSignal(raw);
  if (signal.t !== "answer") throw new Error("That code is not an answer");
  await pc.setRemoteDescription({ type: "answer", sdp: hostOnlySdp(signal.sdp) });
  emit({ partnerName: signal.name || state.partnerName });
}

export async function startLanGuest(raw: string) {
  teardown();
  role = "guest";
  watchLocal();
  const settings = await getSettings();
  const signal = await decodeSignal(raw);
  if (signal.t !== "offer") throw new Error("That code is not an offer from the other phone");
  pc = newPeer();
  pc.ondatachannel = (ev) => bindChannel(ev.channel);
  await pc.setRemoteDescription({ type: "offer", sdp: hostOnlySdp(signal.sdp) });
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  const answerText = await localPayload("answer", settings.caregiverName || "Parent", pc);
  emit({
    phase: "guest-answer",
    answerText,
    answerQr: await toQr(answerText),
    offerText: "",
    offerQr: "",
    error: "",
    partnerName: signal.name,
  });
}

export function lanError(message: string) {
  emit({ phase: "error", error: message });
}
