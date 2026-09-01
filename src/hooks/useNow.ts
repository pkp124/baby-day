import { useEffect, useState } from "react";

export function useNow(fast: boolean) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), fast ? 1000 : 30_000);
    return () => clearInterval(id);
  }, [fast]);
  return now;
}

export function useWakeLock(active: boolean, strong = false) {
  useEffect(() => {
    if (!active) return;
    let sentinel: WakeLockSentinel | undefined;
    let video: HTMLVideoElement | undefined;
    const grab = async () => {
      if (!("wakeLock" in navigator)) return;
      try {
        sentinel = await navigator.wakeLock.request("screen");
      } catch {
        /* browsers may deny when hidden */
      }
    };
    void grab();
    if (strong) {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d");
      ctx?.fillRect(0, 0, 1, 1);
      video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.loop = true;
      video.srcObject = canvas.captureStream(1);
      void video.play().catch(() => undefined);
    }
    const onVis = () => {
      if (!document.hidden) void grab();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void sentinel?.release();
      video?.pause();
      video?.removeAttribute("src");
      video?.load();
    };
  }, [active, strong]);
}
