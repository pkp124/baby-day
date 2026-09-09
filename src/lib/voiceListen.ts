type SpeechResult = {
  isFinal: boolean;
  0?: { transcript: string };
};

type SpeechEvent = {
  results: ArrayLike<SpeechResult>;
};

type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  processLocally?: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onaudiostart: ((ev: Event) => void) | null;
  onresult: ((ev: SpeechEvent) => void) | null;
  onerror: ((ev: Event & { error?: string }) => void) | null;
  onend: ((ev: Event) => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRec;

export type VoiceListenPhase = "idle" | "listening" | "unsupported";

export function isIosStandalone() {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const standalone = window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
  const apple = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 2);
  return standalone && apple;
}

export function speechRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function preferredVoiceMode(): VoiceListenPhase {
  if (!speechRecognitionCtor()) return "unsupported";
  if (isIosStandalone()) return "unsupported";
  return "idle";
}

export function transcriptFromEvent(event: SpeechEvent) {
  const parts: string[] = [];
  for (let i = 0; i < event.results.length; i += 1) {
    const alt = event.results[i]?.[0]?.transcript;
    if (alt) parts.push(alt);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function resultIsFinal(event: SpeechEvent) {
  const last = event.results[event.results.length - 1];
  return Boolean(last?.isFinal);
}

export function startSpeechRecognition(handlers: {
  onTranscript: (text: string, final: boolean) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}): { stop: () => void } | null {
  const Ctor = speechRecognitionCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = document.documentElement.lang || "en-US";
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 3;
  if ("processLocally" in rec) rec.processLocally = true;
  rec.onresult = (event) => {
    const text = transcriptFromEvent(event);
    if (text) handlers.onTranscript(text, resultIsFinal(event));
  };
  rec.onerror = (event) => {
    const code = event.error ?? "failed";
    if (code === "aborted" || code === "no-speech") {
      handlers.onEnd();
      return;
    }
    handlers.onError(
      code === "not-allowed"
        ? "Microphone permission is off."
        : code === "network"
          ? "Voice needs a network connection in this browser."
          : code === "audio-capture"
            ? "Couldn't use the mic. Type instead."
            : "Could not hear that.",
    );
  };
  rec.onend = () => handlers.onEnd();
  try {
    rec.start();
  } catch {
    return null;
  }
  return {
    stop: () => {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    },
  };
}
