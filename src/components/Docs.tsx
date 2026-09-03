import { useEffect, useState } from "react";
import { pageSectionFromHash } from "../lib/pages";

function useHashSection() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    const section = pageSectionFromHash(hash);
    if (!section) {
      window.scrollTo(0, 0);
      return;
    }
    document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);
}

export function GuidePage({ onTech }: { onTech: () => void }) {
  useHashSection();
  return (
    <article className="docs">
      <header className="topbar">
        <div>
          <div className="eyebrow">User guide</div>
          <h1 className="baby-name">How to use Baby Day</h1>
        </div>
      </header>
      <p className="lede">
        Baby Day is a night-first log for two parents. Either of you records a feed, sleep, diaper, or note in a few
        taps. The home screen answers “what happened?” and “what needs attention?” It is a handover layer, not a medical
        app, and it does not need an account.
      </p>

      <nav className="toc" aria-label="Guide sections">
        <a href="#/guide/install">Install</a>
        <a href="#/guide/log">Log care</a>
        <a href="#/guide/night">Night shift</a>
        <a href="#/guide/sync">Sync phones</a>
        <a href="#/guide/camera">Crib camera</a>
        <a href="#/guide/clinic">Clinic visit</a>
        <a href="#/guide/backup">Backup</a>
        <a href="#/guide/privacy">Privacy</a>
        <a href="#/guide/fix">If something fails</a>
      </nav>

      <section id="install">
        <h2>First five minutes</h2>
        <ol className="docs-list">
          <li>
            On iPhone: Safari → Share → <strong>Add to Home Screen</strong>. On Android: the browser’s{" "}
            <strong>Install app</strong> prompt. The home-screen icon is the real app — it has no browser refresh bar.
          </li>
          <li>Enter the baby’s name and your name. Names stay on the phone so the timeline can say who logged what.</li>
          <li>Log the next real event, not a test. Undo is on the toast if you tap the wrong thing.</li>
        </ol>
        <p>
          Everything is saved on this phone first (IndexedDB). Nothing is uploaded unless you later turn on sharing. The
          care day starts at 5:00 local by default, not midnight — change that in Settings if your nights run later.
        </p>
      </section>

      <section id="log">
        <h2>Logging care</h2>
        <h3>Live breastfeed</h3>
        <p>
          Home → <strong>Feed</strong> → Start left or right. The timer stays on the home screen. Switch side when you
          swap. End feed when you are done. If you also gave formula, tap <strong>Add formula top-up</strong> on the
          running timer, or edit the event after.
        </p>
        <h3>A feed that already happened</h3>
        <p>
          Feed → <strong>Log times on each breast</strong> if you remember minutes. For a bottle, pick expressed,
          formula, or mixed and enter the amount. Every sheet has <strong>Now / 10m / 20m / 1h</strong> chips and a
          clock picker so the timestamp is the real one, not “whenever you found the phone.”
        </p>
        <h3>Sleep</h3>
        <p>
          Sleep opens a sheet: start now, or save a finished nap with started and woke times. If a sleep timer is
          already running, the home Sleep button ends it. A leftover timer older than three hours shows a warning.
        </p>
        <h3>Diaper, pump, temp, weight, note</h3>
        <p>
          One sheet each. Pump is left and right volume. Temp and weight follow the units in Settings (ml/oz, kg/lb,
          °C/°F). Storage is always millilitres, grams, and Celsius underneath.
        </p>
        <h3>Vitamin D and K</h3>
        <p>
          The red/green cards under the glance. Red means not given this care day — tap to log now. Green shows the
          clock time; tap to edit or undo.
        </p>
        <h3>Fix a mistake</h3>
        <p>
          Tap a timeline row. Change the time, breast minutes, notes, or delete. Delete offers Undo for a few seconds.
        </p>
      </section>

      <section id="night">
        <h2>Use case: night shift</h2>
        <p>
          One parent has the phone. Log feeds and diapers as they happen. When you put the phone down for more than a
          couple of minutes, the next open can show a <strong>handover</strong> card — events the other person logged
          while you were away, once those events are on this phone.
        </p>
        <p>
          Handover is not magic across town. If the other parent logged on their own phone, those events arrive when you
          <a href="#/guide/sync">sync on this Wi-Fi</a>. Until then, each phone has its own night.
        </p>
        <p>
          Keep the screen awake during a live feed or sleep timer; the app requests a wake lock while a timer runs. If
          iOS still dims, Auto-Lock → Never for that stretch, then put it back.
        </p>
      </section>

      <section id="sync">
        <h2>Use case: two phones on home Wi-Fi</h2>
        <p>
          Settings → <strong>This Wi-Fi</strong>. The first time, one parent taps <strong>Show a passkey</strong>, the
          other taps <strong>Enter a passkey</strong> and types the six digits. Both apps stay open on the same home
          network. Logs copy phone-to-phone. They do not go to a baby cloud.
        </p>
        <p>
          After that first link, each phone remembers the passkey for <strong>a day or a week</strong> (you choose). The
          next catch-up is one tap: <strong>Sync</strong> on Home or in Settings. You do not type the code again until
          it expires. Tap Sync on both phones while you are home.
        </p>
        <ul className="docs-list">
          <li>One phone starts the link, the other joins. That role is remembered; you can swap it in Settings.</li>
          <li>If the other phone’s saved code expired, they can still type the digits shown on your Sync card.</li>
          <li>Locking a phone drops the live link. Already-copied events stay. Sync again later to catch up.</li>
          <li>Guest Wi-Fi with “client isolation” or a mesh that splits you onto two networks will fail.</li>
          <li>QR codes remain under “Use a QR code instead” if a phone has no internet for the handshake.</li>
        </ul>
        <p>
          There is still no catch-up while the other phone is off the network or in another city. Optional cloud sync
          exists in Settings but stores events in a form the host can read — leave it off for real baby data.
        </p>
      </section>

      <section id="camera">
        <h2>Use case: crib camera on a spare phone</h2>
        <p>
          Camera is its own tab, not a setting. It is a live window on the home Wi-Fi, not part of the care log, and
          nothing is recorded.
        </p>
        <ol className="docs-list">
          <li>Spare phone upstairs → Camera → <strong>Use this phone as crib</strong>.</li>
          <li>Plug it in. Set Auto-Lock to Never. Leave that screen open.</li>
          <li>Save the crib passkey on each parent phone (type it, or Sync This Wi-Fi once — that copies it).</li>
          <li>Downstairs → Camera → <strong>Watch the crib</strong>. Same home Wi-Fi reaches another floor.</li>
        </ol>
        <p>
          The crib camera stays off until someone watches, then turns off when the last watcher leaves. Both parents can
          watch at once. Sound is off until you unmute (phones will not autoplay audio).
        </p>
        <p>
          A phone cannot see in the dark. Use a dim night light, not the torch on the baby’s face. If the crib phone
          sleeps or you swipe the app away, Watch cannot start until you unlock it again.
        </p>
      </section>

      <section id="clinic">
        <h2>Use case: pediatrician or a worried night</h2>
        <p>
          The <strong>Report</strong> tab defaults to the last 72 hours. You can switch to 24h, 48h, 7 days, or pick
          start and end timestamps. Sleep, milk, diapers, gaps, and the printable HTML file follow that range. Settings
          can copy the last 48 hours as plain text for a message, or print a 72-hour snapshot to PDF.
        </p>
        <p>
          Home glance: last feed, last pump, last diaper, time awake. Milk splits fed / formula / pumped / fridge
          estimate (all pumped minus all expressed bottles, not only today). Trends on Report fill in as days
          accumulate.
        </p>
        <p>This is a log, not advice. If the baby looks unwell, use the clinic — the app will not tell you what to do.</p>
      </section>

      <section id="backup">
        <h2>Use case: keep a copy, or leave the app</h2>
        <p>
          Settings → Backup. JSON is the full local record. CSV is a spreadsheet of events. The HTML report is a chosen
          time slice, not a backup. Free-tier databases do not keep point-in-time history; export is the backup.
        </p>
        <p>
          Events stay on this phone until you delete them. There is no automatic expiry. Safari can still evict IndexedDB
          under pressure, so export occasionally if this phone is the only copy. Settings → Data on this phone can
          delete finished events older than 90 days, 1 year, or 2 years. After the next Wi-Fi sync, the other phone
          applies the same deletes.
        </p>
        <p>If you only have one phone, you can skip Sync entirely.</p>
      </section>

      <section id="privacy">
        <h2>What stays on the phone</h2>
        <p>
          Default: events never leave the device. This Wi-Fi copies them over the local network after a short handshake.
          Crib video frames stay on the LAN and are not stored. The public passkey mailbox only carries WebRTC signaling,
          not feeds or video.
        </p>
        <p>
          Signing in with Google, if you ever enable cloud sync, tells Google that this email uses the app. That is
          separate from feeding data. Leave cloud sync off until on-device encryption exists.
        </p>
      </section>

      <section id="fix">
        <h2>If something fails</h2>
        <ul className="docs-list">
          <li>
            <strong>Stuck screen on iPhone:</strong> Settings → Reload app. Home-screen PWAs have no pull-to-refresh.
          </li>
          <li>
            <strong>New version:</strong> a banner on the dock. Reload. Phones can keep an old copy until you do.
          </li>
          <li>
            <strong>Sync does nothing:</strong> both on the same Wi-Fi, both apps open, saved passkey not expired, one
            phone set to start and the other to join.
          </li>
          <li>
            <strong>Watch is black:</strong> crib phone still on the Camera crib screen, same Wi-Fi, night light on,
            camera permission allowed.
          </li>
          <li>
            <strong>Timer you forgot:</strong> end it. Events older than three hours warn you. You can edit the end time.
          </li>
        </ul>
        <p>
          Technical notes for how the pieces fit together live in the{" "}
          <button className="text-link" type="button" onClick={onTech}>
            technical guide
          </button>
          .
        </p>
      </section>
    </article>
  );
}

export function TechPage({ onGuide }: { onGuide: () => void }) {
  useHashSection();
  return (
    <article className="docs">
      <header className="topbar">
        <div>
          <div className="eyebrow">Technical</div>
          <h1 className="baby-name">How Baby Day is built</h1>
        </div>
      </header>
      <p className="lede">
        This page is for someone installing, hosting, or changing the app. Parents who only want to log a feed should
        read the{" "}
        <button className="text-link" type="button" onClick={onGuide}>
          user guide
        </button>
        .
      </p>

      <nav className="toc" aria-label="Technical sections">
        <a href="#/tech/stack">Stack</a>
        <a href="#/tech/data">Data</a>
        <a href="#/tech/routes">Routes</a>
        <a href="#/tech/lan">LAN sync</a>
        <a href="#/tech/media">Crib media</a>
        <a href="#/tech/privacy">Privacy</a>
        <a href="#/tech/host">Hosting</a>
      </nav>

      <section id="stack">
        <h2>Stack</h2>
        <p>
          Vite + TypeScript + React PWA. Dexie (IndexedDB) is the source of truth on the device. The service worker
          caches the app shell only, not care events. Vitest covers domain, merge, report, and passkey helpers.
        </p>
        <p>
          There is no required backend. Optional Supabase exists for an invite-based cloud mailbox; it currently stores
          plaintext event rows and must stay off for real baby data until payloads are encrypted on the device.
        </p>
      </section>

      <section id="data">
        <h2>Data model</h2>
        <p>
          Events are append-first with client UUIDs, <code>rev</code>, <code>updatedAt</code>, and <code>deletedAt</code>{" "}
          tombstones. Last-write-wins on sync. Canonical units: millilitres, grams, seconds, Celsius. Display units are
          a settings concern.
        </p>
        <p>
          A breastfeed is a session: <code>startedOn</code>, per-side seconds, optional <code>activeSide</code> while
          the timer runs. Bottles carry <code>volumeMl</code> / <code>formulaMl</code> / <code>expressedMl</code>. The
          care day is a timezone + start-hour window (default 05:00).
        </p>
        <p>
          Settings live in the Dexie <code>meta</code> table. Beside baby identity they now include{" "}
          <code>cribPasskey</code> (stable) and <code>lanPasskey</code> + <code>lanPasskeyRememberUntil</code> +{" "}
          <code>lanPasskeyTtl</code> (<code>day</code> | <code>week</code>) + <code>lanPasskeyRole</code> (
          <code>host</code> | <code>guest</code>) for one-tap Sync, plus <code>eventRetentionDays</code> (
          <code>0</code> keeps every event).
        </p>
      </section>

      <section id="routes">
        <h2>Hash routes</h2>
        <p>GitHub Pages has no server rewrites. Navigation is hash-based:</p>
        <ul className="docs-list">
          <li>
            <code>#/</code> home
          </li>
          <li>
            <code>#/report</code> time-range report and trends
          </li>
          <li>
            <code>#/camera</code> crib / watch hub
          </li>
          <li>
            <code>#/crib</code> and <code>#/watch</code> full-screen media
          </li>
          <li>
            <code>#/settings</code> family, backup, This Wi-Fi
          </li>
          <li>
            <code>#/guide</code> and <code>#/tech</code> these documents; extra path is an in-page section (
            <code>#/guide/sync</code>)
          </li>
        </ul>
        <p>
          Static copies also ship at <code>guide/</code> and <code>tech/</code> on the GitHub Pages site so the same
          writing can be opened without installing the PWA.
        </p>
      </section>

      <section id="lan">
        <h2>LAN event sync</h2>
        <p>
          WebRTC data channel, host-only ICE (no STUN, no TURN). A 6-digit passkey names a short-lived public mailbox
          (default <code>ntfy.sh</code>, topic <code>bdpairNNNNNN</code>) that carries compressed SDP only. Care events
          then move on the LAN. QR remains an offline fallback.
        </p>
        <p>
          First pairing still shows or types the passkey. On <code>datachannel</code> open the app persists that code
          with an expiry of 24 hours or 7 days. Later, <code>syncLan()</code> reuses the saved code: the remembered host
          calls <code>startLanHostPasskey(code)</code>, the remembered guest calls <code>joinLanPasskey(code)</code>. If
          the channel is already open, Sync re-sends <code>hello</code> so both sides exchange digests again.
        </p>
        <p>
          Reusing a 6-digit topic is the same threat model as the crib passkey: anyone who saw the digits could try to
          handshake, but ICE is host-only so the media/data path still has to be on the LAN. Forget the saved key, or
          show a new one, to rotate.
        </p>
      </section>

      <section id="media">
        <h2>Crib media</h2>
        <p>
          Separate <code>RTCPeerConnection</code> for media tracks. Mailbox topic <code>bdcribNNNNNN</code> so it cannot
          collide with event pairing. Crib ICE may keep STUN <code>srflx</code> so iOS mDNS addresses can still find a
          LAN path; relay/TURN candidates are dropped. Camera and mic start only while <code>watchers.size &gt; 0</code>.
        </p>
        <p>
          The crib passkey is stable and stored in settings. Watch remembers it after the first successful join. The
          Camera tab is the hub; crib/watch routes are full-screen and stop media on unmount.
        </p>
      </section>

      <section id="privacy">
        <h2>Privacy stance</h2>
        <p>
          Default A: on this phone only. Path B: LAN copy while both apps are open. Path C (not built): end-to-end
          encrypted mailbox. Do not put plaintext events in git, gists, or Supabase. Do not record crib video. Do not
          add TURN “so it works from the office.”
        </p>
      </section>

      <section id="host">
        <h2>Hosting and development</h2>
        <p>
          Static PWA. GitHub Actions builds <code>dist/</code> and deploys GitHub Pages on push to <code>main</code>.
          Vite <code>base</code> is <code>./</code> so a project site or a custom domain both work. Leave Supabase
          secrets empty for a private default.
        </p>
        <pre>
          {`npm install
npm test
npm run dev
npm run build`}
        </pre>
        <p>Node 22. Open the Vite URL from the phone on the same network, or Chrome device emulation.</p>
      </section>
    </article>
  );
}
