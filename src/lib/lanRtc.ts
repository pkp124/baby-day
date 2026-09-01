import { hostOnlySdp, lanMediaSdp } from "./lanMerge";

export function newLanPeer() {
  return new RTCPeerConnection({ iceServers: [], iceCandidatePoolSize: 0 });
}

export function newMediaPeer() {
  return new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
    iceCandidatePoolSize: 0,
  });
}

export function waitIceGathering(peer: RTCPeerConnection, timeoutMs = 3000) {
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
    window.setTimeout(done, timeoutMs);
  });
}

export async function localHostSdp(peer: RTCPeerConnection) {
  await waitIceGathering(peer);
  return hostOnlySdp(peer.localDescription?.sdp ?? "");
}

export async function localMediaSdp(peer: RTCPeerConnection) {
  await waitIceGathering(peer, 5000);
  return lanMediaSdp(peer.localDescription?.sdp ?? "");
}
