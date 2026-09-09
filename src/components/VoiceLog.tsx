import { useCallback, useRef, useState } from "react";
import { describeVoiceIntent, parseVoiceLog, VOICE_EXAMPLES, type VoiceIntent } from "../lib/voiceIntent";
import { preferredVoiceMode, startSpeechRecognition, type VoiceListenPhase } from "../lib/voiceListen";
import type { BreastSide } from "../lib/types";

export function useVoiceListen() {
  const stopRef = useRef<(() => void) | null>(null);
  const [phase, setPhase] = useState<VoiceListenPhase>("idle");
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setPhase((current) => (current === "listening" ? "idle" : current));
  }, []);

  const start = useCallback((onFinal?: (spoken: string) => void) => {
    if (preferredVoiceMode() === "unsupported") {
      setPhase("unsupported");
      setError("");
      return;
    }
    setError("");
    setPhase("listening");
    const handle = startSpeechRecognition({
      onTranscript: (value, final) => {
        setText(value);
        if (final) {
          stopRef.current = null;
          setPhase("idle");
          onFinal?.(value);
        }
      },
      onError: (message) => {
        stopRef.current = null;
        setPhase("idle");
        setError(message);
      },
      onEnd: () => {
        stopRef.current = null;
        setPhase((current) => (current === "listening" ? "idle" : current));
      },
    });
    if (!handle) {
      setPhase("unsupported");
      setError("This browser cannot listen. Type, or use the keyboard microphone.");
      return;
    }
    stopRef.current = handle.stop;
  }, []);

  const reset = useCallback(() => {
    stop();
    setText("");
    setError("");
    setPhase("idle");
  }, [stop]);

  return { phase, text, setText, error, start, stop, reset, canListen: preferredVoiceMode() !== "unsupported" };
}

export function VoiceSheet({
  nextSide,
  phase,
  text,
  error,
  canListen,
  onText,
  onListen,
  onStop,
  onSubmit,
}: {
  nextSide: BreastSide;
  phase: VoiceListenPhase;
  text: string;
  error: string;
  canListen: boolean;
  onText: (value: string) => void;
  onListen: () => void;
  onStop: () => void;
  onSubmit: (intent: VoiceIntent) => void;
}) {
  const preview = text.trim() ? parseVoiceLog(text, nextSide) : null;

  return (
    <>
      <h2>Speak a log</h2>
      <p className="muted">
        {canListen
          ? "Say a short phrase, or type. Undo is on the toast if it hears the wrong thing."
          : "Home-screen iPhone apps cannot use live listening. Type here, or tap the keyboard microphone."}
      </p>
      {phase === "listening" ? <p className="voice-live">Listening…</p> : error ? <p className="warn-text">{error}</p> : null}
      <label className="field">
        What happened?
        <textarea
          value={text}
          rows={3}
          autoFocus
          placeholder="wet diaper, start left, formula 90…"
          onChange={(e) => onText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (text.trim()) onSubmit(parseVoiceLog(text, nextSide));
            }
          }}
        />
      </label>
      {preview && preview.type !== "unknown" ? <p className="muted">Will log: {describeVoiceIntent(preview)}</p> : null}
      <div className="row">
        {canListen ? (
          <button className="secondary grow" type="button" onClick={() => (phase === "listening" ? onStop() : onListen())}>
            {phase === "listening" ? "Stop" : "Listen"}
          </button>
        ) : null}
        <button className="primary grow" type="button" disabled={!text.trim()} onClick={() => onSubmit(parseVoiceLog(text, nextSide))}>
          Log it
        </button>
      </div>
      <p className="muted">Try saying</p>
      <div className="stepper">
        {VOICE_EXAMPLES.map((example) => (
          <button key={example} type="button" onClick={() => onText(example)}>
            {example}
          </button>
        ))}
      </div>
      <p className="faint voice-privacy">
        Chrome and Safari may send the audio to Apple or Google to turn it into words. The care event stays on this
        phone. Keyboard dictation uses the phone’s own microphone keyboard.
      </p>
    </>
  );
}
