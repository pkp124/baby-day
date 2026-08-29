import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import {
  acceptLanAnswer,
  disconnectLan,
  joinLanPasskey,
  lanError,
  startLanGuest,
  startLanHost,
  startLanHostPasskey,
  useLan,
} from "../lib/lan";
import { formatPasskey, normalizePasskey } from "../lib/pairCode";

export function LanCard() {
  const lan = useLan();
  const [paste, setPaste] = useState("");
  const [scan, setScan] = useState(false);
  const [enter, setEnter] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const passkeyMode = lan.pairing === "passkey";

  async function onScanned(text: string) {
    setScan(false);
    setPaste(text);
    try {
      if (lan.phase === "host-offer") await acceptLanAnswer(text);
      else await startLanGuest(text);
    } catch (err) {
      lanError(err instanceof Error ? err.message : "Could not read that code");
    }
  }

  async function copyPasskey() {
    if (!lan.passkey) return;
    await navigator.clipboard.writeText(lan.passkey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="card quiet">
      <h2>This Wi-Fi</h2>
      <p className="muted">
        Catch up on the home network. One parent shows a 6-digit passkey, the other types it. Care events stay on the two
        phones. Both of you keep the app open on the same Wi-Fi. Link again later to catch up.
      </p>
      {lan.phase === "connected" ? (
        <div className="stack">
          <p>Linked with {lan.partnerName || "the other phone"}.</p>
          <button className="secondary" type="button" onClick={() => disconnectLan()}>
            Disconnect
          </button>
        </div>
      ) : lan.phase === "idle" || lan.phase === "error" ? (
        <div className="stack">
          <button className="primary" type="button" onClick={() => void startLanHostPasskey()}>
            Show a passkey
          </button>
          <button
            className="secondary"
            type="button"
            onClick={() => {
              setEnter(true);
            }}
          >
            Enter a passkey
          </button>
        </div>
      ) : null}

      {lan.phase === "host-offer" && passkeyMode && (
        <div className="stack" style={{ marginTop: 12 }}>
          <p className="muted">Read this to the other parent, or let them type it.</p>
          <button className="passkey-code" type="button" onClick={() => void copyPasskey()} aria-label="Copy passkey">
            {formatPasskey(lan.passkey)}
          </button>
          <p className="faint">{copied ? "Copied." : lan.offerText ? "Waiting for the other phone…" : "Getting a link ready…"}</p>
          <button className="secondary" type="button" onClick={() => disconnectLan()}>
            Cancel
          </button>
        </div>
      )}

      {lan.phase === "guest-wait" && (
        <div className="stack" style={{ marginTop: 12 }}>
          <p className="muted">Looking for passkey {formatPasskey(lan.passkey)}…</p>
          <button className="secondary" type="button" onClick={() => disconnectLan()}>
            Cancel
          </button>
        </div>
      )}

      {lan.phase === "guest-answer" && passkeyMode && (
        <p className="muted" style={{ marginTop: 12 }}>
          Linking with {lan.partnerName || "the other phone"}…
        </p>
      )}

      {lan.phase === "host-offer" && !passkeyMode && (
        <div className="stack" style={{ marginTop: 12 }}>
          <p className="muted">Other parent: scan this, then show you their QR.</p>
          {lan.offerQr ? <img className="qr" src={lan.offerQr} alt="Pairing QR code" /> : null}
          <label className="field">
            Offer code
            <textarea readOnly value={lan.offerText} rows={3} />
          </label>
          <button
            className="secondary"
            type="button"
            onClick={() => void navigator.clipboard.writeText(lan.offerText)}
          >
            Copy code
          </button>
          <button className="secondary" type="button" onClick={() => setScan(true)}>
            Scan their answer
          </button>
        </div>
      )}

      {lan.phase === "guest-answer" && !passkeyMode && (
        <div className="stack" style={{ marginTop: 12 }}>
          <p className="muted">Show this to the first phone.</p>
          {lan.answerQr ? <img className="qr" src={lan.answerQr} alt="Answer QR code" /> : null}
          <label className="field">
            Answer code
            <textarea readOnly value={lan.answerText} rows={3} />
          </label>
          <button
            className="secondary"
            type="button"
            onClick={() => void navigator.clipboard.writeText(lan.answerText)}
          >
            Copy code
          </button>
        </div>
      )}

      {lan.error ? <p className="warn-text">{lan.error}</p> : null}

      {lan.phase !== "connected" && (
        <details className="advanced" open={qrOpen} onToggle={(e) => setQrOpen(e.currentTarget.open)}>
          <summary>Use a QR code instead</summary>
          <div className="stack" style={{ marginTop: 10 }}>
            <p className="faint">QR still works if a phone is offline. Android cameras often struggle with it — prefer the passkey.</p>
            {passkeyMode && lan.offerQr ? <img className="qr" src={lan.offerQr} alt="Pairing QR code" /> : null}
            {lan.phase !== "host-offer" && lan.phase !== "guest-wait" && lan.phase !== "guest-answer" && (
              <button className="secondary" type="button" onClick={() => void startLanHost()}>
                This phone shows the first QR
              </button>
            )}
            <button className="secondary" type="button" onClick={() => setScan(true)}>
              Scan the other phone
            </button>
            {(lan.phase === "host-offer" || lan.phase === "idle" || lan.phase === "error") && (
              <label className="field">
                Or paste a code
                <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={3} />
              </label>
            )}
            {paste && (
              <button
                className="secondary"
                type="button"
                onClick={() =>
                  void (lan.phase === "host-offer" ? acceptLanAnswer(paste) : startLanGuest(paste)).catch((err: unknown) =>
                    lanError(err instanceof Error ? err.message : "Could not use that code"),
                  )
                }
              >
                Use pasted code
              </button>
            )}
          </div>
        </details>
      )}

      {scan && <QrScan onClose={() => setScan(false)} onResult={onScanned} />}
      {enter && lan.phase !== "connected" && (
        <PasskeyEntry
          onClose={() => setEnter(false)}
          onSubmit={async (code) => {
            await joinLanPasskey(code);
            setEnter(false);
          }}
        />
      )}
    </section>
  );
}

function PasskeyEntry({ onClose, onSubmit }: { onClose: () => void; onSubmit: (code: string) => Promise<void> }) {
  const [digits, setDigits] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitted = useRef("");

  async function submit(code: string) {
    const next = normalizePasskey(code);
    if (next.length !== 6 || busy || submitted.current === next) return;
    submitted.current = next;
    setBusy(true);
    setError("");
    try {
      await onSubmit(next);
    } catch (err) {
      submitted.current = "";
      setError(err instanceof Error ? err.message : "Could not use that passkey");
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Enter passkey</h2>
        <p className="muted">Type the 6 digits from the other phone.</p>
        <label className="field">
          Passkey
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
              if (next.length === 6) void submit(next);
            }}
            aria-label="Six-digit passkey"
          />
        </label>
        {error ? <p className="warn-text">{error}</p> : null}
        <button className="primary" type="button" disabled={digits.length !== 6 || busy} onClick={() => void submit(digits)}>
          {busy ? "Linking…" : "Link phones"}
        </button>
        <button className="ghost" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
};

function getBarcodeDetector(): BarcodeDetectorLike | null {
  const Ctor = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

function QrScan({ onClose, onResult }: { onClose: () => void; onResult: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let raf = 0;
    let stopped = false;
    const detector = getBarcodeDetector();

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);

      void (async () => {
        if (detector) {
          try {
            const codes = await detector.detect(canvas);
            const text = codes[0]?.rawValue;
            if (text) {
              onResult(text);
              return;
            }
          } catch {
            // Fall through to jsQR.
          }
        }
        const code = jsQR(image.data, image.width, image.height);
        if (code?.data) {
          onResult(code.data);
          return;
        }
        if (!stopped) raf = requestAnimationFrame(tick);
      })();
    };

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        raf = requestAnimationFrame(tick);
      } catch (err) {
        lanError(err instanceof Error ? err.message : "Camera is blocked. Paste the code instead.");
        onClose();
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onClose, onResult]);

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Scan</h2>
        <video ref={videoRef} playsInline muted autoPlay className="scan-video" />
        <canvas ref={canvasRef} hidden />
        <button className="ghost" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
