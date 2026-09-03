import { useState, type FormEvent } from "react";
import { LanCard } from "./LanCard";
import type { Settings } from "../lib/types";
import type { SyncState } from "../lib/sync";
import { acceptInvite, createInvite, createSharedFamily } from "../lib/sync";
import { saveSettings } from "../lib/db";
import { getSupabase, supabaseConfigured } from "../lib/supabase";
import { eventsToCsv, pediatricSnapshot } from "../lib/summary";
import { db } from "../lib/db";
import { buildReport, reportFileStem } from "../lib/report";
import { reportHtml } from "../lib/reportHtml";
import { downloadFile, printHtml } from "../lib/download";
import { RETENTION_CHOICES, retentionLabel } from "../lib/retention";
import { pruneEventsOlderThanDays } from "../lib/repo";

export function SettingsPage({
  settings,
  sync,
  needRefresh,
  onReload,
  onRefreshSync,
  onGuide,
  onTech,
}: {
  settings: Settings;
  sync: SyncState;
  needRefresh: boolean;
  onReload: () => void;
  onRefreshSync: () => void;
  onGuide: () => void;
  onTech: () => void;
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
    downloadFile("baby-day.json", JSON.stringify({ settings, events }, null, 2), "application/json");
  }

  async function exportCsv() {
    const events = await db.events.toArray();
    downloadFile("baby-day.csv", eventsToCsv(events), "text/csv");
  }

  async function exportReport() {
    const events = await db.events.toArray();
    const model = buildReport(events, settings);
    downloadFile(`${reportFileStem(model)}.html`, reportHtml(model, settings), "text/html;charset=utf-8");
    setMessage("Downloaded last 72 hours as HTML");
  }

  async function printReport() {
    const events = await db.events.toArray();
    const model = buildReport(events, settings);
    printHtml(reportHtml(model, settings));
  }

  async function applyRetention(days: (typeof RETENTION_CHOICES)[number]) {
    if (days > 0) {
      const ok = window.confirm(
        `Remove finished events older than ${retentionLabel(days)} from this phone? In-progress timers stay. After the next Wi-Fi sync, the other phone will delete them too. Export JSON first if you want a copy.`,
      );
      if (!ok) return;
    }
    await saveSettings({ eventRetentionDays: days });
    if (days > 0) {
      const n = await pruneEventsOlderThanDays(days);
      setMessage(n ? `Removed ${n} old ${n === 1 ? "event" : "events"}` : "Nothing older than that");
    } else {
      setMessage("Keeping every event on this phone");
    }
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
      <header className="topbar">
        <div>
          <div className="eyebrow">Family</div>
          <h1 className="baby-name">Settings</h1>
        </div>
      </header>

      <section className="card quiet">
        <h2>This phone</h2>
        <p className="muted">
          An iPhone home-screen app has no browser refresh. Use this if the screen looks stuck, or when a new version is
          waiting.
        </p>
        <div className="stack">
          <button className="secondary" type="button" onClick={onReload}>
            {needRefresh ? "Reload new version" : "Reload app"}
          </button>
        </div>
      </section>

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
          <button className={settings.volumeUnit === "ml" ? "primary" : "secondary"} type="button" onClick={() => saveSettings({ volumeUnit: "ml" })}>
            ml
          </button>
          <button className={settings.volumeUnit === "oz" ? "primary" : "secondary"} type="button" onClick={() => saveSettings({ volumeUnit: "oz" })}>
            oz
          </button>
          <button className={settings.weightUnit === "kg" ? "primary" : "secondary"} type="button" onClick={() => saveSettings({ weightUnit: "kg" })}>
            kg
          </button>
          <button className={settings.weightUnit === "lb" ? "primary" : "secondary"} type="button" onClick={() => saveSettings({ weightUnit: "lb" })}>
            lb
          </button>
          <button className={settings.tempUnit === "C" ? "primary" : "secondary"} type="button" onClick={() => saveSettings({ tempUnit: "C" })}>
            °C
          </button>
          <button className={settings.tempUnit === "F" ? "primary" : "secondary"} type="button" onClick={() => saveSettings({ tempUnit: "F" })}>
            °F
          </button>
        </div>
      </section>

      <section className="card quiet">
        <h2>Backup</h2>
        <p className="muted">
          Export is the backup. The Report tab can print any time range to PDF. Free-tier databases do not keep
          point-in-time history.
        </p>
        <div className="stack">
          <button className="secondary" type="button" onClick={copySummary}>
            Copy last 48 hours
          </button>
          <button className="secondary" type="button" onClick={exportReport}>
            Download 72-hour HTML
          </button>
          <button className="secondary" type="button" onClick={printReport}>
            Print 72-hour PDF
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
        <h2>Data on this phone</h2>
        <p className="muted">
          Care events stay here until you delete them. There is no automatic expiry. A few years of logs is still a
          small IndexedDB. Safari can still evict storage under pressure — JSON export is the copy that survives a
          wipe.
        </p>
        <p className="faint">
          Keep forever, or delete finished events older than a chosen window. In-progress timers stay. After the next
          Wi-Fi sync, the other phone will delete them too.
        </p>
        <div className="row" style={{ marginTop: 8 }}>
          {RETENTION_CHOICES.map((days) => (
            <button
              key={days}
              className={settings.eventRetentionDays === days ? "primary" : "secondary"}
              type="button"
              onClick={() => void applyRetention(days)}
            >
              {retentionLabel(days)}
            </button>
          ))}
        </div>
      </section>

      <LanCard settings={settings} />

      <section className="card quiet">
        <h2>Guides</h2>
        <p className="muted">
          How to log a night, sync two phones without typing the passkey every time, set up the crib camera, and what
          stays on the device. The same pages are on this site at <span className="mono">guide/</span> and{" "}
          <span className="mono">tech/</span>.
        </p>
        <div className="stack">
          <button className="primary" type="button" onClick={onGuide}>
            User guide
          </button>
          <button className="secondary" type="button" onClick={onTech}>
            Technical notes
          </button>
        </div>
      </section>

      <section className="card quiet">
        <h2>Privacy</h2>
        <p className="muted">
        Events stay on this phone until you link on this Wi-Fi. A 6-digit passkey matches the two phones, then logs copy
        over the local network — not into a cloud baby record. After the first link, Sync reuses that passkey for a day
        or a week. There is still no catch-up while the other phone is off the network. Crib video lives on the Camera
        tab: live on this Wi-Fi only, camera off until someone watches.
        </p>
      </section>

      <section className="card quiet">
        <h2>Sync</h2>
        {!supabaseConfigured() && (
          <p className="muted">
            Sync is off. This is the private default. A JSON/CSV export is the way to copy data to another device today.
          </p>
        )}
        {supabaseConfigured() && (
          <>
            <p className="warn-text">
              Connected sync currently stores events in the cloud in a form the host can read. Do not turn this on for real baby data until on-device encryption exists.
            </p>
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
