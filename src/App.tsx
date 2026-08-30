import { useState } from "react";
import { useBabyDay, usePwaUpdate } from "./hooks/useBabyDay";
import { useNow, useWakeLock } from "./hooks/useNow";
import { Onboarding } from "./components/Onboarding";
import { Glance, HandoverCard, MilkCard, TempLine, Timeline, VitaminCards, WeightLine } from "./components/Bits";
import { ReportPage, SeventyTwoCard } from "./components/Report";
import {
  BottleSheet,
  DiaperSheet,
  EventEditor,
  FeedSheet,
  Modal,
  NoteSheet,
  PumpSheet,
  SleepSheet,
  TempSheet,
  WeightSheet,
} from "./components/Sheets";
import { SettingsPage } from "./components/Settings";
import { Dock } from "./components/Dock";
import { activeSession, dayTotals, feedSeconds, fridgeEstimateMl, nextBreastSide, vitaminLabel } from "./lib/domain";
import { careDayFor, formatCareDayLabel, formatDuration, formatDurationClock } from "./lib/time";
import { displayToMl } from "./lib/units";
import {
  addBottleToFeed,
  endTimedEvent,
  logBottleFeed,
  logBreastFeed,
  logDiaper,
  logNote,
  logPump,
  logSleep,
  logTemperature,
  logVitamin,
  logWeight,
  removeEvent,
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
  | "temp"
  | "sleep"
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
      <div className={needRefresh ? "app has-update" : "app"}>
        <SettingsPage
          settings={store.settings}
          sync={store.sync}
          needRefresh={needRefresh}
          onReload={reload}
          onRefreshSync={() => void store.refreshSync()}
        />
        <Dock
          page="settings"
          onHome={() => store.setPage("home")}
          onReport={() => store.setPage("report")}
          onSettings={() => store.setPage("settings")}
          needRefresh={needRefresh}
          onReload={reload}
        />
      </div>
    );
  }

  if (store.page === "report") {
    return (
      <div className={needRefresh ? "app has-update" : "app"}>
        <ReportPage
          events={store.events}
          settings={store.settings}
          now={now}
          onHome={() => store.setPage("home")}
        />
        <Dock
          page="report"
          onHome={() => store.setPage("home")}
          onReport={() => store.setPage("report")}
          onSettings={() => store.setPage("settings")}
          needRefresh={needRefresh}
          onReload={reload}
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
  const fridgeMl = fridgeEstimateMl(store.events);
  const next = nextBreastSide(store.events);
  const syncClass =
    lan.phase === "connected" ? "" : store.sync.status === "error" ? "bad" : store.sync.pending > 0 || store.sync.status === "local" ? "warn" : "";
  const syncLabel =
    lan.phase === "connected"
      ? `Wi-Fi · ${lan.partnerName || "linked"}`
      : lan.phase === "host-offer" || lan.phase === "guest-wait" || lan.phase === "guest-answer"
        ? "Wi-Fi · linking…"
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
    <div className={needRefresh ? "app has-update" : "app"}>
      <div className="app-grid">
        <div>
          <header className="topbar">
            <div>
              <div className="eyebrow">{formatCareDayLabel(day, store.settings.timezone, store.settings.careDayStartHour, now)}</div>
              <h1 className="baby-name">{store.settings.babyName}</h1>
            </div>
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

          <VitaminCards
            events={store.events}
            settings={store.settings}
            start={day.start}
            end={day.end}
            onGive={(type) =>
              void logVitamin(type).then((event) =>
                store.flash(`${vitaminLabel(type)} saved`, () => void removeEvent(event.id)),
              )
            }
            onOpen={(event) => {
              setEditing(event);
              setSheet("event");
            }}
          />

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
                else setSheet("sleep");
              }}
            >
              <div className="label">{active?.type === "sleep" ? "End sleep" : "Sleep"}</div>
              <div className="hint">{active?.type === "sleep" ? "tap to wake" : "start or log times"}</div>
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
            <button className="action" type="button" onClick={() => setSheet("temp")}>
              <div className="label">Temp</div>
              <div className="hint">°C or °F</div>
            </button>
            <button className="action" type="button" onClick={() => setSheet("note")}>
              <div className="label">Note</div>
              <div className="hint">anything else</div>
            </button>
          </div>

          <MilkCard today={totals} fridgeMl={fridgeMl} unit={store.settings.volumeUnit} />

          <div className="totals">
            <div className="chip">{totals.feeds} feeds</div>
            <div className="chip">{totals.wet} wet</div>
            <div className="chip">{totals.dirty} dirty</div>
            <div className="chip">{formatDuration(totals.sleepSeconds)} sleep</div>
            <WeightLine events={store.events} settings={store.settings} />
            <TempLine events={store.events} settings={store.settings} />
          </div>

          <SeventyTwoCard
            events={store.events}
            settings={store.settings}
            now={now}
            onOpen={() => store.setPage("report")}
          />
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
              timezone={store.settings.timezone}
              onBreast={async (side, iso) => {
                if (active) await endTimedEvent(active.id);
                await startBreastFeed(side, { iso });
                setSheet(null);
              }}
              onLogBreast={async ({ startedOn, leftSeconds, rightSeconds, iso }) => {
                await logBreastFeed({ startedOn, leftSeconds, rightSeconds, when: { iso } });
                setSheet(null);
                store.flash("Feed saved");
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
              timezone={store.settings.timezone}
              onSave={async (amount, iso) => {
                const ml = displayToMl(amount, store.settings.volumeUnit);
                if (active?.type === "feed" && bottleMethod === "mixed") {
                  await addBottleToFeed(active.id, { formulaMl: ml, method: "mixed" });
                } else {
                  await logBottleFeed({
                    method: bottleMethod,
                    volumeMl: ml,
                    formulaMl: bottleMethod === "formula" || bottleMethod === "mixed" ? ml : undefined,
                    expressedMl: bottleMethod === "expressed" ? ml : undefined,
                    when: { iso },
                  });
                }
                setSheet(null);
                store.flash("Feed saved");
              }}
            />
          )}
          {sheet === "diaper" && (
            <DiaperSheet
              timezone={store.settings.timezone}
              onSave={async (kind, iso) => {
                await logDiaper(kind, { iso });
                setSheet(null);
                store.flash("Diaper saved");
              }}
            />
          )}
          {sheet === "pump" && (
            <PumpSheet
              unit={store.settings.volumeUnit}
              timezone={store.settings.timezone}
              onSave={async (left, right, iso) => {
                await logPump({
                  leftMl: displayToMl(left, store.settings.volumeUnit),
                  rightMl: displayToMl(right, store.settings.volumeUnit),
                  when: { iso },
                });
                setSheet(null);
                store.flash("Pump saved");
              }}
            />
          )}
          {sheet === "weight" && (
            <WeightSheet
              unit={store.settings.weightUnit}
              timezone={store.settings.timezone}
              onSave={async (grams, iso) => {
                await logWeight(grams, { iso });
                setSheet(null);
                store.flash("Weight saved");
              }}
            />
          )}
          {sheet === "temp" && (
            <TempSheet
              unit={store.settings.tempUnit}
              timezone={store.settings.timezone}
              onSave={async (celsius, iso) => {
                await logTemperature(celsius, { iso });
                setSheet(null);
                store.flash("Temperature saved");
              }}
            />
          )}
          {sheet === "sleep" && (
            <SleepSheet
              timezone={store.settings.timezone}
              onStart={async (iso) => {
                await startSleep({ iso });
                setSheet(null);
              }}
              onLog={async (startIso, endIso) => {
                await logSleep({ start: { iso: startIso }, endedAt: endIso });
                setSheet(null);
                store.flash("Sleep saved");
              }}
            />
          )}
          {sheet === "note" && (
            <NoteSheet
              timezone={store.settings.timezone}
              onSave={async (text, iso) => {
                await logNote(text, { iso });
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
      <Dock
        page="home"
        onHome={() => store.setPage("home")}
        onReport={() => store.setPage("report")}
        onSettings={() => store.setPage("settings")}
        needRefresh={needRefresh}
        onReload={reload}
      />
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
