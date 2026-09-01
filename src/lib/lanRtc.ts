import { hostOnlySdp } from "./lanMerge";

export function newLanPeer() {
  return new RTCPeerConnection({ iceServers: [], iceCandidatePoolSize: 0 });
}

export function waitIceGathering(peer: RTCPeerConnection) {
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

export async function localHostSdp(peer: RTCPeerConnection) {
  await waitIceGathering(peer);
  return hostOnlySdp(peer.localDescription?.sdp ?? "");
}
