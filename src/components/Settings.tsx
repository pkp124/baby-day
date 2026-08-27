import { useState, type FormEvent } from "react";
import type { Settings } from "../lib/types";
import type { SyncState } from "../lib/sync";
import { acceptInvite, createInvite, createSharedFamily } from "../lib/sync";
import { saveSettings } from "../lib/db";
import { getSupabase, supabaseConfigured } from "../lib/supabase";
import { eventsToCsv, pediatricSnapshot } from "../lib/summary";
import { db } from "../lib/db";

export function SettingsPage({
  settings,
  sync,
  onBack,
  onRefreshSync,
}: {
  settings: Settings;
  sync: SyncState;
  onBack: () => void;
  onRefreshSync: () => void;
}) {
  const [invite, setInvite] = useState("");
  const [join, setJoin] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  async function copySummary() {
    const events = await db.events.toArray();
    const text = pediatricSnapshot(events, settings);
    await navigator.clipboard.writeText(text);
    setMessage("Copied last 48 hours");
  }

  async function exportJson() {
    const events = await db.events.toArray();
    download("baby-day.json", JSON.stringify({ settings, events }, null, 2), "application/json");
  }

  async function exportCsv() {
    const events = await db.events.toArray();
    download("baby-day.csv", eventsToCsv(events), "text/csv");
  }

  async function signIn(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    setMessage(error ? error.message : "Check your email for a sign-in link.");
  }

  async function google() {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) setMessage(error.message);
  }

  return (
    <div className="settings">
      <div className="topbar">
        <div>
          <div className="eyebrow">Family</div>
          <h1 className="baby-name">Settings</h1>
        </div>
        <button className="icon-btn" type="button" onClick={onBack} aria-label="Back">
          ←
        </button>
      </div>

      <section className="card quiet">
        <h2>Baby</h2>
        <label className="field">
          Name
          <input defaultValue={settings.babyName} onBlur={(e) => saveSettings({ babyName: e.target.value.trim() })} />
        </label>
        <label className="field">
          Your name
          <input defaultValue={settings.caregiverName} onBlur={(e) => saveSettings({ caregiverName: e.target.value.trim() })} />
        </label>
        <label className="field">
          Care day starts at
          <input
            type="number"
            min={0}
            max={23}
            defaultValue={settings.careDayStartHour}
            onBlur={(e) => saveSettings({ careDayStartHour: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          Timezone
          <input defaultValue={settings.timezone} onBlur={(e) => saveSettings({ timezone: e.target.value.trim() })} />
        </label>
        <div className="row">
          <button
            className={`secondary ${settings.volumeUnit === "ml" ? "primary" : ""}`}
            type="button"
            onClick={() => saveSettings({ volumeUnit: "ml" })}
          >
            ml
          </button>
          <button
            className={`secondary ${settings.volumeUnit === "oz" ? "primary" : ""}`}
            type="button"
            onClick={() => saveSettings({ volumeUnit: "oz" })}
          >
            oz
          </button>
          <button
            className={`secondary ${settings.weightUnit === "kg" ? "primary" : ""}`}
            type="button"
            onClick={() => saveSettings({ weightUnit: "kg" })}
          >
            kg
          </button>
          <button
            className={`secondary ${settings.weightUnit === "lb" ? "primary" : ""}`}
            type="button"
            onClick={() => saveSettings({ weightUnit: "lb" })}
          >
            lb
          </button>
        </div>
      </section>

      <section className="card quiet">
        <h2>Backup</h2>
        <p className="muted">Export is the backup. Free-tier databases do not keep point-in-time history.</p>
        <div className="stack">
          <button className="secondary" type="button" onClick={copySummary}>
            Copy last 48 hours
          </button>
          <button className="secondary" type="button" onClick={exportJson}>
            Download JSON
          </button>
          <button className="secondary" type="button" onClick={exportCsv}>
            Download CSV
          </button>
        </div>
      </section>

      <section className="card quiet">
        <h2>Sync</h2>
        {!supabaseConfigured() && (
          <p className="muted">
            This copy is on-device only. Add <span className="mono">VITE_SUPABASE_URL</span> and{" "}
            <span className="mono">VITE_SUPABASE_ANON_KEY</span> at build time, run <span className="mono">supabase/schema.sql</span>, then
            both parents can share one family.
          </p>
        )}
        {supabaseConfigured() && (
          <>
            <p className="muted">
              {sync.signedIn ? `Signed in as ${sync.email ?? "parent"}` : "Sign in to share with the other parent."} Pending: {sync.pending}
            </p>
            {sync.lastError && <p className="warn-text">{sync.lastError}</p>}
            {!sync.signedIn && (
              <>
                <button className="primary" type="button" onClick={google}>
                  Continue with Google
                </button>
                <form className="stack" onSubmit={signIn} style={{ marginTop: 12 }}>
                  <label className="field">
                    Email magic link
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </label>
                  <button className="secondary" type="submit">
                    Send link
                  </button>
                </form>
              </>
            )}
            {sync.signedIn && (
              <div className="stack">
                <button
                  className="secondary"
                  type="button"
                  onClick={async () => {
                    try {
                      await createSharedFamily();
                      onRefreshSync();
                      setMessage("Family created. Invite the other parent next.");
                    } catch (err) {
                      setMessage(err instanceof Error ? err.message : "Could not create family");
                    }
                  }}
                >
                  Start a shared family
                </button>
                <button
                  className="secondary"
                  type="button"
                  onClick={async () => {
                    try {
                      const token = await createInvite();
                      setInvite(token);
                      await navigator.clipboard.writeText(token);
                      setMessage("Invite copied. It expires in 7 days and can be used once.");
                    } catch (err) {
                      setMessage(err instanceof Error ? err.message : "Could not create invite");
                    }
                  }}
                >
                  Create invite for the other parent
                </button>
                {invite && <p className="mono">{invite}</p>}
                <label className="field">
                  Join with invite
                  <input value={join} onChange={(e) => setJoin(e.target.value)} placeholder="paste code" />
                </label>
                <button
                  className="secondary"
                  type="button"
                  onClick={async () => {
                    try {
                      await acceptInvite(join, settings.caregiverName);
                      onRefreshSync();
                      setMessage("Joined family");
                    } catch (err) {
                      setMessage(err instanceof Error ? err.message : "Could not join");
                    }
                  }}
                >
                  Join family
                </button>
                <button className="secondary" type="button" onClick={onRefreshSync}>
                  Sync now
                </button>
                <button
                  className="ghost"
                  type="button"
                  onClick={async () => {
                    await getSupabase()?.auth.signOut();
                    onRefreshSync();
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </>
        )}
        {message && <p className="muted">{message}</p>}
      </section>
    </div>
  );
}

function download(name: string, body: string, type: string) {
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
