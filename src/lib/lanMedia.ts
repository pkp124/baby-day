import { useSyncExternalStore } from "react";
import { getSettings } from "./db";
import { hostOnlySdp } from "./lanMerge";
import { localHostSdp, newLanPeer } from "./lanRtc";
import { generatePasskey, isValidPasskey, normalizePasskey, topicForCribPasskey } from "./pairCode";
import { openPairMailbox, type PairMailbox, type PairWire } from "./pairMailbox";

export type MediaRole = "off" | "crib" | "watch";
export type MediaPhase = "idle" | "starting" | "waiting" | "live" | "error";
export type CameraFacing = "user" | "environment";

export type MediaWatcher = {
  id: string;
  name: string;
  live: boolean;
};

export type MediaState = {
  role: MediaRole;
  phase: MediaPhase;
  facing: CameraFacing;
  mic: boolean;
  error: string;
  passkey: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  watchers: MediaWatcher[];
};

const MAX_WATCHERS = 4;

const idle: MediaState = {
  role: "off",
  phase: "idle",
  facing: "environment",
  mic: false,
  error: "",
  passkey: "",
  localStream: null,
  remoteStream: null,
  watchers: [],
};

type Session = {
  id: string;
  name: string;
  live: boolean;
  pc: RTCPeerConnection | null;
};

let state: MediaState = { ...idle };
const listeners = new Set<() => void>();
const sessions = new Map<string, Session>();
let mailbox: PairMailbox | null = null;
let starting = false;
let cameraBusy = false;
let offerQueue: Promise<void> = Promise.resolve();
let unbindResume: (() => void) | null = null;

function emit(patch: Partial<MediaState>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

function emitWatchers(extra: Partial<MediaState> = {}) {
  emit({
    watchers: [...sessions.values()].map((session) => ({
      id: session.id,
      name: session.name,
      live: session.live,
    })),
    ...extra,
  });
}

export function subscribeMedia(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getMediaState() {
  return state;
}

export function useMedia() {
  return useSyncExternalStore(subscribeMedia, getMediaSnapshot, getMediaSnapshot);
}

function getMediaSnapshot() {
  return state;
}

export function cameraShouldRun(watcherCount: number) {
  return watcherCount > 0;
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function closePeer(session: Session) {
  if (session.pc) {
    session.pc.ontrack = null;
    session.pc.onconnectionstatechange = null;
    session.pc.close();
    session.pc = null;
  }
  session.live = false;
}

function closeAllPeers() {
  for (const session of sessions.values()) closePeer(session);
}

function closeMailbox() {
  mailbox?.close();
  mailbox = null;
}

async function cribName() {
  const settings = await getSettings();
  return settings.caregiverName || "Crib";
}

function enqueue(job: () => Promise<void>) {
  offerQueue = offerQueue.then(job).catch((err) => {
    console.error(err);
  });
  return offerQueue;
}

function bindResume() {
  unbindResume?.();
  const onVis = () => {
    if (document.hidden) return;
    if (state.role === "crib" && cameraShouldRun(sessions.size)) {
      void ensureCamera().then(() => reofferAll());
    }
  };
  document.addEventListener("visibilitychange", onVis);
  unbindResume = () => document.removeEventListener("visibilitychange", onVis);
}

async function primeCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser cannot use the camera.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: state.facing } },
    audio: false,
  });
  stopStream(stream);
}

async function openCamera(force = false) {
  if (!force && state.localStream?.getTracks().some((track) => track.readyState === "live")) {
    return state.localStream;
  }
  if (cameraBusy) return state.localStream;
  cameraBusy = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: state.facing },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: state.mic ? { echoCancellation: true, noiseSuppression: true } : false,
    });
    stopStream(state.localStream);
    emit({ localStream: stream });
    stream.getTracks().forEach((track) => {
      track.addEventListener("ended", () => {
        if (state.role === "crib" && cameraShouldRun(sessions.size)) {
          void ensureCamera(true).then(() => reofferAll());
        }
      });
    });
    return stream;
  } finally {
    cameraBusy = false;
  }
}

async function ensureCamera(force = false) {
  if (!cameraShouldRun(sessions.size)) {
    await stopCamera();
    return null;
  }
  return openCamera(force);
}

async function stopCamera() {
  stopStream(state.localStream);
  emit({ localStream: null, phase: sessions.size ? "waiting" : state.role === "crib" ? "waiting" : state.phase });
}

async function offerTo(id: string) {
  const session = sessions.get(id);
  if (!session || state.role !== "crib" || !mailbox) return;
  let stream: MediaStream | null = null;
  try {
    stream = await ensureCamera();
  } catch (err) {
    emit({ error: mediaError(err, "Could not open the camera") });
    return;
  }
  if (!stream) return;
  closePeer(session);
  const pc = newLanPeer();
  session.pc = pc;
  pc.onconnectionstatechange = () => {
    if (session.pc !== pc) return;
    if (pc.connectionState === "connected") {
      session.live = true;
      emitWatchers({ phase: "live", error: "" });
      return;
    }
    if (pc.connectionState === "failed") {
      session.live = false;
      emitWatchers({ error: "Picture dropped. Trying again…" });
      window.setTimeout(() => {
        if (state.role === "crib" && sessions.has(id)) enqueue(() => offerTo(id));
      }, 2000);
    }
  };
  for (const track of stream.getTracks()) pc.addTrack(track, stream);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await mailbox.publish({
    k: "offer",
    to: id,
    signal: await localHostSdp(pc),
    name: await cribName(),
  });
}

function reofferAll() {
  return enqueue(async () => {
    for (const id of sessions.keys()) await offerTo(id);
  });
}

function dropWatcher(id: string) {
  const session = sessions.get(id);
  if (!session) return;
  closePeer(session);
  sessions.delete(id);
  if (!cameraShouldRun(sessions.size)) {
    stopStream(state.localStream);
    emitWatchers({ localStream: null, phase: "waiting", error: "" });
    return;
  }
  emitWatchers();
}

async function onCribWire(msg: PairWire) {
  switch (msg.k) {
    case "hello":
      if (sessions.has(msg.from)) {
        enqueue(() => offerTo(msg.from));
        return;
      }
      if (sessions.size >= MAX_WATCHERS) return;
      sessions.set(msg.from, { id: msg.from, name: msg.name || "Parent", live: false, pc: null });
      emitWatchers({ phase: "waiting", error: "" });
      enqueue(() => offerTo(msg.from));
      return;
    case "answer":
      if (msg.to && mailbox && msg.to !== mailbox.from) return;
      {
        const session = sessions.get(msg.from);
        if (!session?.pc || !msg.signal) return;
        await session.pc.setRemoteDescription({ type: "answer", sdp: hostOnlySdp(msg.signal) });
      }
      return;
    case "bye":
      dropWatcher(msg.from);
      return;
    case "offer":
      return;
    default: {
      const _never: never = msg.k;
      return _never;
    }
  }
}

async function answerOffer(msg: PairWire) {
  if (state.role !== "watch" || !mailbox || !msg.signal) return;
  if (msg.to && msg.to !== mailbox.from) return;
  const pc = newLanPeer();
  const existing = sessions.get("crib");
  if (existing) closePeer(existing);
  const session: Session = { id: "crib", name: msg.name || "Crib", live: false, pc };
  sessions.set("crib", session);
  pc.ontrack = (ev) => {
    const tracks = state.remoteStream ? [...state.remoteStream.getTracks()] : [];
    if (!tracks.includes(ev.track)) tracks.push(ev.track);
    emit({ remoteStream: new MediaStream(tracks), phase: "live", error: "" });
  };
  pc.onconnectionstatechange = () => {
    if (session.pc !== pc) return;
    if (pc.connectionState === "connected") {
      session.live = true;
      emit({ phase: "live", error: "" });
    }
    if (pc.connectionState === "failed") {
      session.live = false;
      emit({ phase: "waiting", error: "Picture dropped. Waiting for the crib phone…" });
    }
  };
  await pc.setRemoteDescription({ type: "offer", sdp: hostOnlySdp(msg.signal) });
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await mailbox.publish({ k: "answer", to: msg.from, signal: await localHostSdp(pc), name: await cribName() });
}

async function onWatchWire(msg: PairWire) {
  switch (msg.k) {
    case "offer":
      await answerOffer(msg);
      return;
    case "bye":
      closeAllPeers();
      sessions.clear();
      emit({ phase: "waiting", remoteStream: null, error: "" });
      return;
    case "hello":
    case "answer":
      return;
    default: {
      const _never: never = msg.k;
      return _never;
    }
  }
}

function mediaError(err: unknown, fallback: string) {
  const denied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "NotFoundError");
  return denied ? "Camera is blocked. Allow the camera, then tap Start camera." : err instanceof Error ? err.message : fallback;
}

export async function startCrib(opts?: { facing?: CameraFacing; mic?: boolean }) {
  if (opts?.facing) emit({ facing: opts.facing });
  if (opts?.mic !== undefined) emit({ mic: opts.mic });
  if (state.role === "crib" && mailbox) {
    if (cameraShouldRun(sessions.size)) {
      await ensureCamera(true);
      await reofferAll();
    }
    return;
  }
  if (starting) return;
  starting = true;
  const passkey = generatePasskey();
  emit({
    role: "crib",
    phase: "starting",
    passkey,
    error: "",
    remoteStream: null,
    watchers: [],
  });
  try {
    try {
      await primeCamera();
    } catch (err) {
      emit({ error: mediaError(err, "Could not open the camera") });
    }
    mailbox = await openPairMailbox(passkey, (msg) => void onCribWire(msg), (err) => emit({ phase: "error", error: err.message }), {
      topic: topicForCribPasskey(passkey),
      reconnect: true,
    });
    bindResume();
    emit({ phase: "waiting" });
  } catch (err) {
    closeMailbox();
    emit({ phase: "error", error: mediaError(err, "Could not start the crib") });
  } finally {
    starting = false;
  }
}

export async function retryCribCamera() {
  if (state.role !== "crib") {
    await startCrib();
    return;
  }
  try {
    await primeCamera();
    emit({ error: "" });
  } catch (err) {
    emit({ error: mediaError(err, "Could not open the camera") });
    return;
  }
  if (cameraShouldRun(sessions.size)) {
    await ensureCamera(true);
    await reofferAll();
  }
}

export async function startWatch(passkey: string) {
  const code = normalizePasskey(passkey);
  if (!isValidPasskey(code)) throw new Error("Enter the 6-digit passkey from the crib phone");
  if (state.role !== "off") stopMedia();
  emit({
    role: "watch",
    phase: "starting",
    passkey: code,
    error: "",
    localStream: null,
    remoteStream: null,
    watchers: [],
  });
  try {
    mailbox = await openPairMailbox(code, (msg) => void onWatchWire(msg), (err) => emit({ phase: "error", error: err.message }), {
      topic: topicForCribPasskey(code),
      reconnect: true,
    });
    const settings = await getSettings();
    await mailbox.publish({ k: "hello", name: settings.caregiverName || "Parent" });
    emit({ phase: "waiting", error: "" });
  } catch (err) {
    closeMailbox();
    emit({
      role: "watch",
      phase: "error",
      passkey: code,
      error: err instanceof Error ? err.message : "Could not reach the crib phone",
    });
  }
}

export async function setCribFacing(facing: CameraFacing) {
  if (state.role !== "crib") return;
  emit({ facing });
  if (!cameraShouldRun(sessions.size)) return;
  await ensureCamera(true);
  await reofferAll();
}

export async function setCribMic(mic: boolean) {
  if (state.role !== "crib") return;
  emit({ mic });
  if (!cameraShouldRun(sessions.size)) return;
  await ensureCamera(true);
  await reofferAll();
}

export function stopMedia() {
  if (mailbox && state.role !== "off") void mailbox.publish({ k: "bye" }).catch(() => undefined);
  unbindResume?.();
  unbindResume = null;
  closeAllPeers();
  sessions.clear();
  closeMailbox();
  stopStream(state.localStream);
  starting = false;
  cameraBusy = false;
  emit({ ...idle });
}
