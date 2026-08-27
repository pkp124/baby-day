import { useState, type FormEvent } from "react";
import { completeOnboarding } from "../lib/repo";

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const babyName = String(data.get("babyName") ?? "").trim();
    const caregiverName = String(data.get("caregiverName") ?? "").trim();
    if (!babyName || !caregiverName) return;
    try {
      await completeOnboarding({ babyName, caregiverName });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  return (
    <div className="onboard">
      <form className="onboard-card stack" onSubmit={submit}>
        <div className="eyebrow">Family companion</div>
        <div className="wordmark">Baby Day</div>
        <p>A shared memory for the two of you. Log a feed in a couple of taps, then the other parent can see it.</p>
        {error ? <p className="warn-text">{error}</p> : null}
        <label className="field">
          Baby’s name
          <input name="babyName" autoComplete="off" required placeholder="e.g. Arjun" />
        </label>
        <label className="field">
          Your name
          <input name="caregiverName" autoComplete="given-name" required placeholder="e.g. Asha" />
        </label>
        <button className="primary" type="submit">
          Start
        </button>
        <p className="faint">Everything is saved on this phone first. You can connect sync later in Settings.</p>
      </form>
    </div>
  );
}
