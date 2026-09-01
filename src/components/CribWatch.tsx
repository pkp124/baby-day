import { useEffect, useRef, useState } from "react";
import { useWakeLock } from "../hooks/useNow";
import { useLan } from "../lib/lan";
import {
  setCribFacing,
  setCribMic,
  startCrib,
  startWatch,
  stopMedia,
  useMedia,
  type MediaPhase,
} from "../lib/lanMedia";

export function CribWatchPage({
  mode,
  onBack,
}: {
  mode: "crib" | "watch";
  onBack: () => void;
}) {
  const lan = useLan();
  const media = useMedia();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [soundOn, setSoundOn] = useState(false);
  useWakeLock(true);

  useEffect(() => {
    if (mode === "watch") void startWatch();
    else void startCrib();
    return () => stopMedia();
  }, [mode]);

  const stream = mode === "crib" ? media.localStream : media.remoteStream;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    video.muted = mode === "crib" || !soundOn;
    if (!stream) return;
    void video.play().catch(() => undefined);
  }, [stream, mode, soundOn]);

  const linked = lan.phase === "connected";
  const waitingWatch = mode === "crib" && media.phase === "waiting";
  const waitingCrib = mode === "watch" && media.phase === "waiting" && !media.remoteStream;
  const live = media.phase === "live";
  const status = statusLine(mode, media.phase, linked, lan.partnerName);

  return (
    <div className="media-stage">
      {stream ? (
        <video
          ref={videoRef}
          className={mode === "crib" && media.facing === "user" ? "mirror" : undefined}
          playsInline
          autoPlay
          muted={mode === "crib" || !soundOn}
        />
      ) : (
        <div className="media-blank" />
      )}
      <div className="media-hud">
        <div>
          <div className="eyebrow">{mode === "crib" ? "Crib" : "Watch"}</div>
          <p className="media-status">{status}</p>
          <p className="faint">Live on this Wi-Fi only. Nothing is recorded or uploaded.</p>
          {media.error ? <p className="warn-text">{media.error}</p> : null}
          {waitingWatch ? <p className="muted">Waiting for the other phone to tap Watch the crib.</p> : null}
          {waitingCrib ? <p className="muted">Waiting for the crib phone. Keep that phone open and plugged in.</p> : null}
        </div>
        <div className="stack">
          {mode === "crib" && (
            <div className="row">
              <button
                className="secondary grow"
                type="button"
                onClick={() => void setCribFacing(media.facing === "environment" ? "user" : "environment")}
              >
                Flip camera
              </button>
              <button className={media.mic ? "primary grow" : "secondary grow"} type="button" onClick={() => void setCribMic(!media.mic)}>
                {media.mic ? "Mic on" : "Mic off"}
              </button>
            </div>
          )}
          {mode === "watch" && live && (
            <button className={soundOn ? "primary" : "secondary"} type="button" onClick={() => setSoundOn((on) => !on)}>
              {soundOn ? "Mute" : "Unmute sound"}
            </button>
          )}
          {mode === "crib" && !media.localStream && (
            <button className="primary" type="button" onClick={() => void startCrib()}>
              Start camera
            </button>
          )}
          <div className="row">
            <button className="secondary grow" type="button" onClick={onBack}>
              Back
            </button>
            <button
              className="danger grow"
              type="button"
              onClick={() => {
                stopMedia();
                onBack();
              }}
            >
              Stop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function statusLine(mode: "crib" | "watch", phase: MediaPhase, linked: boolean, partner: string) {
  if (!linked) return "Phones are not linked on this Wi-Fi.";
  switch (phase) {
    case "live":
      return partner ? `Live with ${partner}` : "Live";
    case "starting":
      return "Opening camera…";
    case "waiting":
    case "idle":
    case "error":
      return mode === "crib"
        ? "Camera on this phone. Picture stays on the home network."
        : "Ready to watch. Picture stays on the home network.";
    default: {
      const _never: never = phase;
      return _never;
    }
  }
}
