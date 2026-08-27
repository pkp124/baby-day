import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import {
  acceptLanAnswer,
  disconnectLan,
  lanError,
  startLanGuest,
  startLanHost,
  useLan,
} from "../lib/lan";

export function LanCard() {
  const lan = useLan();
  const [paste, setPaste] = useState("");
  const [scan, setScan] = useState(false);

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

  return (
    <section className="card quiet">
      <h2>This Wi-Fi</h2>
      <p className="muted">
        Catch up on the home network. Care events stay on the two phones — there is no cloud mailbox. Both of you keep the app open on the same Wi-Fi, scan once, and logs copy across. Link again later to catch up.
      </p>
      {lan.phase === "connected" ? (
        <div className="stack">
          <p>Linked with {lan.partnerName || "the other phone"}.</p>
          <button className="secondary" type="button" onClick={() => disconnectLan()}>
            Disconnect
          </button>
        </div>
      ) : (
        <div className="stack">
          <button className="primary" type="button" onClick={() => void startLanHost()}>
            This phone shows the first QR
          </button>
          <button className="secondary" type="button" onClick={() => setScan(true)}>
            Scan the other phone
          </button>
        </div>
      )}

      {lan.phase === "host-offer" && (
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

      {lan.phase === "guest-answer" && (
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

      {(lan.phase === "host-offer" || lan.phase === "idle" || lan.phase === "error") && (
        <label className="field">
          Or paste a code
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={3} />
        </label>
      )}
      {paste && lan.phase !== "connected" && (
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

      {scan && <QrScan onClose={() => setScan(false)} onResult={onScanned} />}
    </section>
  );
}

function QrScan({ onClose, onResult }: { onClose: () => void; onResult: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let raf = 0;
    let stopped = false;

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
      const code = jsQR(image.data, image.width, image.height);
      if (code?.data) {
        onResult(code.data);
        return;
      }
      raf = requestAnimationFrame(tick);
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
