import { useEffect, useRef, useState } from "react";
import { useWakeLock } from "../hooks/useNow";
import { getSettings } from "../lib/db";
import {
  setCribFacing,
  setCribMic,
  startCrib,
  startWatch,
  stopMedia,
  retryCribCamera,
  useMedia,
  type MediaPhase,
} from "../lib/lanMedia";
import { formatPasskey, isValidPasskey, normalizePasskey } from "../lib/pairCode";

export function CribWatchPage({
  mode,
  onBack,
}: {
  mode: "crib" | "watch";
  onBack: () => void;
}) {
  const media = useMedia();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [digits, setDigits] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);
  useWakeLock(true, true);

  useEffect(() => {
    void getSettings().then((settings) => {
      const code = normalizePasskey(settings.cribPasskey);
      if (code) setDigits(code);
    });
  }, []);

  useEffect(() => {
    if (mode === "crib") void startCrib();
    if (mode === "watch") {
      void getSettings().then((settings) => {
        const code = normalizePasskey(settings.cribPasskey);
        if (isValidPasskey(code)) void startWatch(code);
      });
    }
    return () => stopMedia();
  }, [mode]);

  const stream = mode === "crib" ? media.localStream : media.remoteStream;
  const liveCount = media.watchers.filter((watcher) => watcher.live).length;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    video.muted = mode === "crib" || !soundOn;
    if (!stream) return;
    void video.play().catch(() => undefined);
  }, [stream, mode, soundOn]);

  async function join(code: string) {
    const next = normalizePasskey(code);
    if (next.length !== 6 || joining) return;
    setJoining(true);
    setJoinError("");
    try {
      await startWatch(next);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Could not use that passkey");
    } finally {
      setJoining(false);
    }
  }

  const status = statusLine(mode, media.phase, liveCount, media.watchers.length);
  const showJoin = mode === "watch" && media.phase !== "live" && media.phase !== "waiting" && media.phase !== "starting";

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
          <p className="faint">Live on this Wi-Fi only. Nothing is recorded or uploaded. Camera runs only while someone is watching.</p>
          {media.error ? <p className="warn-text">{media.error}</p> : null}
          {mode === "crib" && media.passkey ? (
            <button
              className="passkey-code"
              type="button"
              onClick={() => void navigator.clipboard.writeText(media.passkey)}
              aria-label="Copy crib passkey"
            >
              {formatPasskey(media.passkey)}
            </button>
          ) : null}
          {mode === "crib" && media.watchers.length > 0 ? (
            <p className="muted">
              {media.watchers.map((watcher) => watcher.name).join(", ")} {media.watchers.length === 1 ? "is" : "are"} watching.
            </p>
          ) : null}
          {mode === "crib" && media.phase === "waiting" && media.watchers.length === 0 ? (
            <p className="muted">Camera is off until someone downstairs opens Watch. This code stays the same — save it in Settings on your phone so you do not need to walk upstairs.</p>
          ) : null}
        </div>
        <div className="stack">
          {showJoin && (
            <>
              <p className="muted">
                {isValidPasskey(normalizePasskey(digits)) || media.passkey
                  ? "Same home Wi-Fi reaches downstairs. After the first save, this phone remembers the code."
                  : "Type the crib passkey once. Both parents can watch. Same home Wi-Fi is enough from another floor."}
              </p>
              <label className="field">
                Crib passkey
                <input
                  className="passkey-input"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  pattern="[0-9]*"
                  maxLength={7}
                  autoFocus
                  value={formatPasskey(digits)}
                  onChange={(e) => {
                    const next = normalizePasskey(e.target.value);
                    setDigits(next);
                    if (next.length === 6) void join(next);
                  }}
                  aria-label="Six-digit crib passkey"
                />
              </label>
              {joinError ? <p className="warn-text">{joinError}</p> : null}
              <button className="primary" type="button" disabled={digits.length !== 6 || joining} onClick={() => void join(digits)}>
                {joining ? "Connecting…" : "Watch"}
              </button>
            </>
          )}
          {mode === "crib" && media.localStream && (
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
          {mode === "watch" && media.phase === "live" && (
            <button className={soundOn ? "primary" : "secondary"} type="button" onClick={() => setSoundOn((on) => !on)}>
              {soundOn ? "Mute" : "Unmute sound"}
            </button>
          )}
          {mode === "crib" && !media.localStream && (media.error || media.watchers.length > 0) && (
            <button className="primary" type="button" onClick={() => void retryCribCamera()}>
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

function statusLine(mode: "crib" | "watch", phase: MediaPhase, liveCount: number, watcherCount: number) {
  if (mode === "watch") {
    switch (phase) {
      case "live":
        return "Live";
      case "starting":
        return "Finding the crib phone…";
      case "waiting":
        return "Waiting for the crib camera…";
      case "idle":
      case "error":
        return "Use the saved crib passkey, or type it once.";
      default: {
        const _never: never = phase;
        return _never;
      }
    }
  }
  switch (phase) {
    case "live":
      return liveCount ? `Live · ${liveCount} watching` : "Live";
    case "starting":
      return "Getting the crib ready…";
    case "waiting":
      return watcherCount ? "Starting camera for a watcher…" : "Standby · camera off";
    case "idle":
    case "error":
      return "Crib is not streaming yet.";
    default: {
      const _never: never = phase;
      return _never;
    }
  }
}
