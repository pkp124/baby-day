import { useState } from "react";
import { saveSettings } from "../lib/db";
import { formatPasskey, isValidPasskey, normalizePasskey } from "../lib/pairCode";
import type { Settings } from "../lib/types";

export function CameraPage({
  settings,
  onCrib,
  onWatch,
  onGuide,
}: {
  settings: Settings;
  onCrib: () => void;
  onWatch: () => void;
  onGuide: () => void;
}) {
  const [message, setMessage] = useState("");
  const cribCode = normalizePasskey(settings.cribPasskey);

  return (
    <div className="settings">
      <header className="topbar">
        <div>
          <div className="eyebrow">Live on this Wi-Fi</div>
          <h1 className="baby-name">Camera</h1>
        </div>
      </header>

      <section className="card quiet">
        <h2>Crib camera</h2>
        <p className="muted">
          Put a spare phone on the crib, plugged in, Auto-Lock set to Never. Watch from downstairs on the same home
          Wi-Fi. The camera stays off until someone taps Watch. Nothing is recorded or uploaded.
        </p>
        {isValidPasskey(cribCode) ? (
          <button
            className="passkey-code"
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(cribCode);
              setMessage("Crib passkey copied");
            }}
            aria-label="Copy crib passkey"
          >
            {formatPasskey(cribCode)}
          </button>
        ) : null}
        <label className="field">
          Crib passkey on this phone
          <input
            className="passkey-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            pattern="[0-9]*"
            maxLength={7}
            value={formatPasskey(settings.cribPasskey)}
            onChange={(e) => void saveSettings({ cribPasskey: normalizePasskey(e.target.value) })}
            placeholder="from the crib phone"
            aria-label="Crib passkey"
          />
        </label>
        <p className="faint">
          Use the same six digits on the crib phone and both parent phones. Linking This Wi-Fi also copies it.
        </p>
        <div className="stack" style={{ marginTop: 12 }}>
          <button className="primary" type="button" onClick={onCrib}>
            Use this phone as crib
          </button>
          <button className="secondary" type="button" onClick={onWatch}>
            Watch the crib
          </button>
        </div>
        {message ? <p className="muted">{message}</p> : null}
      </section>

      <section className="card quiet">
        <h2>How to set it up</h2>
        <ol className="docs-list">
          <li>Open Camera on the spare phone and tap <strong>Use this phone as crib</strong>.</li>
          <li>Copy the passkey onto each parent phone, or sync This Wi-Fi once so it copies with the care log.</li>
          <li>Leave the crib phone upstairs, plugged in, this screen left on.</li>
          <li>Downstairs, tap <strong>Watch the crib</strong>. Same home Wi-Fi is enough from another floor.</li>
        </ol>
        <p className="faint">
          A phone is a poor night camera. Use a dim night light. Guest Wi-Fi with client isolation will fail.
        </p>
        <button className="ghost" type="button" onClick={onGuide}>
          Read the camera guide
        </button>
      </section>
    </div>
  );
}
