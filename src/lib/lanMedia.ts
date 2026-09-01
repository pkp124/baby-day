import { useSyncExternalStore } from "react";
import { hostOnlySdp } from "./lanMerge";
import { localHostSdp, newLanPeer } from "./lanRtc";

export type MediaRole = "off" | "crib" | "watch";
export type MediaPhase = "idle" | "starting" | "waiting" | "live" | "error";
export type CameraFacing = "user" | "environment";

export type MediaState = {
  role: MediaRole;
  phase: MediaPhase;
  facing: CameraFacing;
  mic: boolean;
  error: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
};

export type MediaWire =
  | { kind: "media-ready"; role: "crib" | "watch" }
  | { kind: "media-offer"; sdp: string }
  | { kind: "media-answer"; sdp: string }
  | { kind: "media-bye" };

const idle: MediaState = {
  role: "off",
  phase: "idle",
  facing: "environment",
  mic: false,
  error: "",
  localStream: null,
  remoteStream: null,
};

let state: MediaState = { ...idle };
const listeners = new Set<() => void>();
let pc: RTCPeerConnection | null = null;
let watchReady = false;
let offering = false;
let starting = false;
let sendMedia: (msg: MediaWire) => boolean = () => false;
let lanLinked: () => boolean = () => false;

function emit(patch: Partial<MediaState>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
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

export function attachMediaSend(fn: (msg: MediaWire) => boolean) {
  sendMedia = fn;
}

export function attachLanLinked(fn: () => boolean) {
  lanLinked = fn;
}

export function parseMediaWire(raw: unknown): MediaWire | null {
  if (!raw || typeof raw !== "object") return null;
  const msg = raw as { kind?: unknown; role?: unknown; sdp?: unknown };
  switch (msg.kind) {
    case "media-ready":
      if (msg.role === "crib" || msg.role === "watch") return { kind: "media-ready", role: msg.role };
      return null;
    case "media-offer":
      if (typeof msg.sdp === "string" && msg.sdp) return { kind: "media-offer", sdp: msg.sdp };
      return null;
    case "media-answer":
      if (typeof msg.sdp === "string" && msg.sdp) return { kind: "media-answer", sdp: msg.sdp };
      return null;
    case "media-bye":
      return { kind: "media-bye" };
    default:
      return null;
  }
}

function send(msg: MediaWire) {
  return sendMedia(msg);
}

function lanConnected() {
  return lanLinked();
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function teardownPeer() {
  if (pc) {
    pc.ontrack = null;
    pc.onconnectionstatechange = null;
    pc.close();
    pc = null;
  }
}

function bindPeer(peer: RTCPeerConnection) {
  peer.ontrack = (ev) => {
    const tracks = state.remoteStream ? [...state.remoteStream.getTracks()] : [];
    if (!tracks.includes(ev.track)) tracks.push(ev.track);
    emit({ remoteStream: new MediaStream(tracks), phase: "live", error: "" });
  };
  peer.onconnectionstatechange = () => {
    if (peer !== pc) return;
    const conn = peer.connectionState;
    if (conn === "connected") {
      emit({ phase: "live", error: "" });
      return;
    }
    if (conn === "failed") {
      emit({
        phase: state.localStream || state.role === "watch" ? "waiting" : state.phase,
        error: "Picture dropped. Trying again…",
        remoteStream: state.role === "watch" ? null : state.remoteStream,
      });
      if (state.role === "crib" && watchReady) void offerFromCrib();
    }
  };
}

async function offerFromCrib() {
  if (state.role !== "crib" || !state.localStream || offering) return;
  if (!lanConnected()) return;
  offering = true;
  try {
    teardownPeer();
    pc = newLanPeer();
    bindPeer(pc);
    for (const track of state.localStream.getTracks()) {
      pc.addTrack(track, state.localStream);
    }
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send({ kind: "media-offer", sdp: await localHostSdp(pc) });
  } catch (err) {
    emit({
      phase: "error",
      error: err instanceof Error ? err.message : "Could not start the crib picture",
    });
  } finally {
    offering = false;
  }
}

async function answerOffer(sdp: string) {
  if (state.role !== "watch") return;
  teardownPeer();
  emit({ remoteStream: null });
  pc = newLanPeer();
  bindPeer(pc);
  await pc.setRemoteDescription({ type: "offer", sdp: hostOnlySdp(sdp) });
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  send({ kind: "media-answer", sdp: await localHostSdp(pc) });
}

async function openCamera(facing: CameraFacing, mic: boolean) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: facing },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: mic ? { echoCancellation: true, noiseSuppression: true } : false,
  });
  stopStream(state.localStream);
  emit({ localStream: stream, facing, mic });
  return stream;
}

export async function startCrib(opts?: { facing?: CameraFacing; mic?: boolean }) {
  const facing = opts?.facing ?? state.facing;
  const mic = opts?.mic ?? state.mic;
  if (starting) return;
  starting = true;
  emit({
    role: "crib",
    phase: "starting",
    facing,
    mic,
    error: lanConnected() ? "" : "Link both phones on this Wi-Fi first.",
    remoteStream: null,
  });
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser cannot use the camera.");
    }
    await openCamera(facing, mic);
    emit({ phase: lanConnected() ? "waiting" : "error" });
    send({ kind: "media-ready", role: "crib" });
    if (watchReady) await offerFromCrib();
  } catch (err) {
    const denied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "NotFoundError");
    emit({
      phase: "error",
      error: denied
        ? "Camera is blocked. Allow the camera, then tap Start camera."
        : err instanceof Error
          ? err.message
          : "Could not open the camera",
    });
  } finally {
    starting = false;
  }
}

export async function startWatch() {
  emit({
    role: "watch",
    phase: lanConnected() ? "waiting" : "error",
    error: lanConnected() ? "" : "Link both phones on this Wi-Fi first.",
    localStream: null,
  });
  send({ kind: "media-ready", role: "watch" });
}

export async function setCribFacing(facing: CameraFacing) {
  if (state.role !== "crib") return;
  await startCrib({ facing, mic: state.mic });
}

export async function setCribMic(mic: boolean) {
  if (state.role !== "crib") return;
  await startCrib({ facing: state.facing, mic });
}

export function stopMedia() {
  if (state.role !== "off") send({ kind: "media-bye" });
  watchReady = false;
  offering = false;
  teardownPeer();
  stopStream(state.localStream);
  emit({ ...idle });
}

export function mediaChannelOpen() {
  if (state.role === "crib") {
    emit({ error: "", phase: state.localStream ? "waiting" : state.phase });
    send({ kind: "media-ready", role: "crib" });
    if (watchReady) void offerFromCrib();
    return;
  }
  if (state.role === "watch") {
    emit({ error: "", phase: "waiting" });
    send({ kind: "media-ready", role: "watch" });
  }
}

export function mediaChannelClosed() {
  teardownPeer();
  watchReady = false;
  if (state.role === "off") return;
  emit({
    phase: "error",
    error: "Wi-Fi link dropped. Open Settings and link again.",
    remoteStream: null,
  });
}

export async function handleMediaWire(msg: MediaWire) {
  switch (msg.kind) {
    case "media-ready":
      if (msg.role === "watch") {
        watchReady = true;
        if (state.role === "crib") await offerFromCrib();
        return;
      }
      return;
    case "media-offer":
      if (state.role !== "watch") return;
      try {
        await answerOffer(msg.sdp);
      } catch (err) {
        emit({
          phase: "error",
          error: err instanceof Error ? err.message : "Could not take the crib picture",
        });
      }
      return;
    case "media-answer":
      if (state.role !== "crib" || !pc) return;
      try {
        await pc.setRemoteDescription({ type: "answer", sdp: hostOnlySdp(msg.sdp) });
      } catch (err) {
        emit({
          phase: "error",
          error: err instanceof Error ? err.message : "Could not finish the crib link",
        });
      }
      return;
    case "media-bye":
      teardownPeer();
      if (state.role === "crib") {
        watchReady = false;
        emit({ phase: state.localStream ? "waiting" : "idle", error: "", remoteStream: null });
        return;
      }
      if (state.role === "watch") {
        emit({ phase: "waiting", error: "", remoteStream: null });
        return;
      }
      return;
    default: {
      const _never: never = msg;
      return _never;
    }
  }
}
