import { useState } from "react";
import { useBabyDay, usePwaUpdate } from "./hooks/useBabyDay";
import { useNow, useWakeLock } from "./hooks/useNow";
import { Onboarding } from "./components/Onboarding";
import { Glance, HandoverCard, Timeline, WeightLine } from "./components/Bits";
import {
  BottleSheet,
  DiaperSheet,
  EventEditor,
  FeedSheet,
  Modal,
  NoteSheet,
  PumpSheet,
  WeightSheet,
} from "./components/Sheets";
import { SettingsPage } from "./components/Settings";
import { activeSession, dayTotals, feedSeconds, nextBreastSide } from "./lib/domain";
import { careDayFor, formatCareDayLabel, formatDuration, formatDurationClock } from "./lib/time";
import { formatMl, displayToMl } from "./lib/units";
import {
  addBottleToFeed,
  endTimedEvent,
  logBottleFeed,
  logDiaper,
  logNote,
  logPump,
  logWeight,
  restoreEvent,
  startBreastFeed,
  startSleep,
  switchFeedSide,
} from "./lib/repo";
import { useLan } from "./lib/lan";
import type { CareEvent, FeedData, FeedMethod } from "./lib/types";

type SheetKind =
  | "feed"
  | "bottle"
  | "diaper"
  | "pump"
  | "weight"
  | "note"
  | "event"
  | null;

export default function App() {
  const store = useBabyDay();
  const lan = useLan();
  const { needRefresh, reload } = usePwaUpdate();
  const active = activeSession(store.events);
  const now = useNow(Boolean(active));
  useWakeLock(Boolean(active));
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [bottleMethod, setBottleMethod] = useState<Extract<FeedMethod, "expressed" | "formula" | "mixed">>("formula");
  const [editing, setEditing] = useState<CareEvent | null>(null);

  if (!store.ready) return <div className="onboard">Loading…</div>;
  if (!store.settings.onboardedAt) return <Onboarding onDone={() => undefined} />;

  if (store.page === "settings") {
    return (
      <div className="app">
        <SettingsPage
          settings={store.settings}
          sync={store.sync}
          onBack={() => store.setPage("home")}
          onRefreshSync={() => void store.refreshSync()}
        />
      </div>
    );
  }

  const day = careDayFor(now, store.settings.timezone, store.settings.careDayStartHour);
  const todayEvents = store.events
    .filter((e) => {
      const t = new Date(e.time).getTime();
      return t >= day.start.getTime() && t < day.end.getTime();
    })
    .sort((a, b) => (a.time < b.time ? 1 : -1));
  const totals = dayTotals(store.events, day.start, day.end, now);
  const next = nextBreastSide(store.events);
  const syncClass =
    lan.phase === "connected" ? "" : store.sync.status === "error" ? "bad" : store.sync.pending > 0 || store.sync.status === "local" ? "warn" : "";
  const syncLabel =
    lan.phase === "connected"
      ? `Wi-Fi · ${lan.partnerName || "linked"}`
      : store.sync.status === "local"
        ? "On this phone"
        : store.sync.pending > 0
          ? `${store.sync.pending} waiting to sync`
          : store.sync.status === "needs-login"
            ? "Sign in to share"
            : store.sync.status === "error"
              ? "Sync issue"
              : "Synced";

  return (
    <div className="app">
      {needRefresh && (
        <div className="update-banner">
          New version ready
          <button type="button" onClick={() => reload()}>
            Reload
          </button>
        </div>
      )}
      <div className="app-grid">
        <div>
          <header className="topbar">
            <div>
              <div className="eyebrow">{formatCareDayLabel(day, store.settings.timezone, store.settings.careDayStartHour, now)}</div>
              <h1 className="baby-name">{store.settings.babyName}</h1>
            </div>
            <button className="icon-btn" type="button" onClick={() => store.setPage("settings")} aria-label="Settings">
              ⚙
            </button>
          </header>
          <button className={`pill-btn ${syncClass}`} type="button" onClick={() => store.setPage("settings")}>
            <span className="dot" />
            {syncLabel}
          </button>

          {active && (
            <ActiveTimer
              event={active}
              now={now}
              onSwitch={() => void switchFeedSide(active.id)}
              onEnd={() => void endTimedEvent(active.id).then(() => store.flash("Saved"))}
              onTopUp={() => {
                setEditing(active);
                setSheet("event");
              }}
            />
          )}

          <Glance events={store.events} settings={store.settings} now={now} />

          <div className="actions">
            <button className="action wide feed" type="button" onClick={() => setSheet("feed")}>
              <div className="label">Feed</div>
              <div className="hint">Start {next} · bottle or mixed</div>
            </button>
            <button
              className="action sleep"
              type="button"
              onClick={() => {
                if (active?.type === "sleep") void endTimedEvent(active.id);
                else if (active) store.flash("End the feed first");
                else void startSleep();
              }}
            >
              <div className="label">{active?.type === "sleep" ? "End sleep" : "Sleep"}</div>
              <div className="hint">{active?.type === "sleep" ? "tap to wake" : "one tap to start"}</div>
            </button>
            <button className="action" type="button" onClick={() => setSheet("diaper")}>
              <div className="label">Diaper</div>
              <div className="hint">wet · dirty</div>
            </button>
            <button className="action" type="button" onClick={() => setSheet("pump")}>
              <div className="label">Pump</div>
              <div className="hint">left / right</div>
            </button>
            <button className="action" type="button" onClick={() => setSheet("weight")}>
              <div className="label">Weight</div>
              <div className="hint">optional</div>
            </button>
            <button className="action" type="button" onClick={() => setSheet("note")}>
              <div className="label">Note</div>
              <div className="hint">anything else</div>
            </button>
          </div>

          <div className="totals">
            <div className="chip">{totals.feeds} feeds</div>
            <div className="chip">{formatMl(totals.bottleMl, store.settings.volumeUnit)} bottle</div>
            <div className="chip">{totals.wet} wet</div>
            <div className="chip">{totals.dirty} dirty</div>
            <div className="chip">{formatDuration(totals.sleepSeconds)} sleep</div>
            <WeightLine events={store.events} settings={store.settings} />
          </div>
        </div>

        <div>
          <HandoverCard events={store.handover} settings={store.settings} now={now} onDismiss={store.dismissHandover} />
          <h2 style={{ margin: "8px 0 12px" }}>Today</h2>
          <Timeline
            events={todayEvents}
            settings={store.settings}
            now={now}
            onOpen={(event) => {
              setEditing(event);
              setSheet("event");
            }}
          />
        </div>
      </div>

      {sheet && (
        <Modal
          onClose={() => {
            setSheet(null);
            setEditing(null);
          }}
        >
          {sheet === "feed" && (
            <FeedSheet
              next={next}
              onBreast={async (side, minutesAgo) => {
                if (active) await endTimedEvent(active.id);
                await startBreastFeed(side, { minutesAgo });
                setSheet(null);
              }}
              onPickBottle={(method) => {
                setBottleMethod(method);
                setSheet("bottle");
              }}
            />
          )}
          {sheet === "bottle" && (
            <BottleSheet
              method={bottleMethod}
              unit={store.settings.volumeUnit}
              onSave={async (amount, minutesAgo) => {
                const ml = displayToMl(amount, store.settings.volumeUnit);
                if (active?.type === "feed" && bottleMethod === "mixed") {
                  await addBottleToFeed(active.id, { formulaMl: ml, method: "mixed" });
                } else {
                  await logBottleFeed({
                    method: bottleMethod,
                    volumeMl: ml,
                    formulaMl: bottleMethod === "formula" || bottleMethod === "mixed" ? ml : undefined,
                    expressedMl: bottleMethod === "expressed" ? ml : undefined,
                    when: { minutesAgo },
                  });
                }
                setSheet(null);
                store.flash("Feed saved");
              }}
            />
          )}
          {sheet === "diaper" && (
            <DiaperSheet
              onSave={async (kind, minutesAgo) => {
                await logDiaper(kind, { minutesAgo });
                setSheet(null);
                store.flash("Diaper saved");
              }}
            />
          )}
          {sheet === "pump" && (
            <PumpSheet
              unit={store.settings.volumeUnit}
              onSave={async (left, right, minutesAgo) => {
                await logPump({
                  leftMl: displayToMl(left, store.settings.volumeUnit),
                  rightMl: displayToMl(right, store.settings.volumeUnit),
                  when: { minutesAgo },
                });
                setSheet(null);
                store.flash("Pump saved");
              }}
            />
          )}
          {sheet === "weight" && (
            <WeightSheet
              unit={store.settings.weightUnit}
              onSave={async (grams, minutesAgo) => {
                await logWeight(grams, { minutesAgo });
                setSheet(null);
                store.flash("Weight saved");
              }}
            />
          )}
          {sheet === "note" && (
            <NoteSheet
              onSave={async (text, minutesAgo) => {
                await logNote(text, { minutesAgo });
                setSheet(null);
                store.flash("Note saved");
              }}
            />
          )}
          {sheet === "event" && editing && (
            <EventEditor
              event={editing}
              settings={store.settings}
              onClose={() => {
                setSheet(null);
                setEditing(null);
              }}
              onDeleted={(event) => store.flash("Deleted", () => void restoreEvent(event))}
            />
          )}
        </Modal>
      )}

      {store.toast && (
        <div className="toast">
          <span>{store.toast.message}</span>
          {store.toast.undo && (
            <button type="button" onClick={() => { store.toast?.undo?.(); store.setToast(null); }}>
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ActiveTimer({
  event,
  now,
  onSwitch,
  onEnd,
  onTopUp,
}: {
  event: CareEvent;
  now: Date;
  onSwitch: () => void;
  onEnd: () => void;
  onTopUp: () => void;
}) {
  const stale = now.getTime() - new Date(event.time).getTime() > 3 * 60 * 60 * 1000;
  if (event.type === "sleep") {
    const seconds = (now.getTime() - new Date(event.time).getTime()) / 1000;
    return (
      <section className="timer sleep">
        <div className="kicker">Sleeping</div>
        <div className="clock">{formatDurationClock(seconds)}</div>
        {stale && <p className="warn-text">Started over 3 hours ago. End it if that was a leftover timer.</p>}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary sleep grow" type="button" onClick={onEnd}>
            End sleep
          </button>
        </div>
      </section>
    );
  }
  const data = event.data as FeedData;
  const secs = feedSeconds(data, event, now);
  return (
    <section className="timer">
      <div className="kicker">Feeding {data.activeSide ?? data.startedOn}</div>
      <div className="clock">{formatDurationClock(secs.total)}</div>
      <p className="muted">
        L {formatDuration(secs.left)} · R {formatDuration(secs.right)}
      </p>
      {stale && <p className="warn-text">This feed started over 3 hours ago.</p>}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="secondary grow" type="button" onClick={onSwitch}>
          Switch side
        </button>
        <button className="primary grow" type="button" onClick={onEnd}>
          End feed
        </button>
      </div>
      <button className="ghost" type="button" onClick={onTopUp}>
        Add formula top-up
      </button>
    </section>
  );
}
