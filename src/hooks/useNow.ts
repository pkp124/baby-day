import { useEffect, useState } from "react";

export function useNow(fast: boolean) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), fast ? 1000 : 30_000);
    return () => clearInterval(id);
  }, [fast]);
  return now;
}

export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let sentinel: WakeLockSentinel | undefined;
    const grab = async () => {
      if (!("wakeLock" in navigator)) return;
      try {
        sentinel = await navigator.wakeLock.request("screen");
      } catch {
        /* browsers may deny when hidden */
      }
    };
    void grab();
    const onVis = () => {
      if (!document.hidden) void grab();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void sentinel?.release();
    };
  }, [active]);
}
