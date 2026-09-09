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
import { VoiceSheet, useVoiceListen } from "./components/VoiceLog";
import { CribWatchPage } from "./components/CribWatch";
import { CameraPage } from "./components/Camera";
import { GuidePage, TechPage } from "./components/Docs";
import { Dock } from "./components/Dock";
import { SettingsPage } from "./components/Settings";
import {
  activeSession,
  bottleMl,
  dayTotals,
  feedSeconds,
  fridgeEstimateMl,
  lastBottleFeed,
  lastBottleMlForMethod,
  lastBreastMinutes,
  lastFinishedSleepMinutes,
  lastPumpMl,
  lastTempCelsius,
  lastWeightGrams,
  nextBreastSide,
  vitaminLabel,
} from "./lib/domain";
import { careDayFor, formatCareDayLabel, formatDuration, formatDurationClock } from "./lib/time";
import { displayToMl, mlToDisplay } from "./lib/units";
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
import { syncLan, useLan } from "./lib/lan";
import { startCrib } from "./lib/lanMedia";
import { isLanPasskeyFresh } from "./lib/lanRemember";
import { applyVoiceIntent } from "./lib/voiceApply";
import { parseVoiceLog } from "./lib/voiceIntent";
import type { AppPage } from "./lib/pages";
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
  | "voice"
  | null;

export default function App() {
  const store = useBabyDay();
  const lan = useLan();
  const { needRefresh, reload } = usePwaUpdate();
  const active = activeSession(store.events);
  const now = useNow(Boolean(active));
  useWakeLock(Boolean(active));
  const voice = useVoiceListen();
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
          onGuide={() => store.setPage("guide")}
          onTech={() => store.setPage("tech")}
        />
        <AppDock page="settings" store={store} needRefresh={needRefresh} reload={reload} />
      </div>
    );
  }

  if (store.page === "guide") {
    return (
      <div className={needRefresh ? "app has-update" : "app"}>
        <GuidePage onTech={() => store.setPage("tech")} />
        <AppDock page="docs" store={store} needRefresh={needRefresh} reload={reload} />
      </div>
    );
  }

  if (store.page === "tech") {
    return (
      <div className={needRefresh ? "app has-update" : "app"}>
        <TechPage onGuide={() => store.setPage("guide")} />
        <AppDock page="docs" store={store} needRefresh={needRefresh} reload={reload} />
      </div>
    );
  }

  if (store.page === "camera") {
    return (
      <div className={needRefresh ? "app has-update" : "app"}>
        <CameraPage
          settings={store.settings}
          onCrib={() => {
            store.setPage("crib");
            void startCrib();
          }}
          onWatch={() => store.setPage("watch")}
          onGuide={() => store.setPage("guide", "camera")}
        />
        <AppDock page="camera" store={store} needRefresh={needRefresh} reload={reload} />
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
        <AppDock page="report" store={store} needRefresh={needRefresh} reload={reload} />
      </div>
    );
  }

  if (store.page === "crib" || store.page === "watch") {
    return (
      <div className={needRefresh ? "app media-app has-update" : "app media-app"}>
        <CribWatchPage mode={store.page} onBack={() => store.setPage("camera")} />
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
  const lastBottle = lastBottleFeed(store.events);
  const lastBottleData = lastBottle?.type === "feed" ? (lastBottle.data as FeedData) : null;
  const lastPump = lastPumpMl(store.events);
  const volumeUnit = store.settings.volumeUnit;
  const lastBottleAmount = lastBottleMlForMethod(store.events, bottleMethod);
  const commitVoice = (intent: ReturnType<typeof parseVoiceLog>) => {
    void applyVoiceIntent(intent, {
      active,
      settings: store.settings,
      lastBottle,
    }).then((result) => {
      if (!result.ok) {
        store.flash(result.message);
        return;
      }
      setSheet(null);
      voice.reset();
      store.flash(result.message, result.eventId ? () => void removeEvent(result.eventId as string) : undefined);
    });
  };
  const startVoice = () => {
    voice.reset();
    setSheet("voice");
    voice.start((spoken) => {
      const intent = parseVoiceLog(spoken, next);
      if (intent.type === "unknown") return;
      commitVoice(intent);
    });
  };
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
          <div className="sync-bar">
            <button className={`pill-btn ${syncClass}`} type="button" onClick={() => store.setPage("settings")}>
              <span className="dot" />
              {syncLabel}
            </button>
            {(isLanPasskeyFresh(store.settings) || lan.phase === "connected") && (
              <button
                className="primary sync-now"
                type="button"
                disabled={lan.phase === "host-offer" || lan.phase === "guest-wait" || lan.phase === "guest-answer"}
                onClick={() =>
                  void syncLan().catch((err: unknown) =>
                    store.flash(err instanceof Error ? err.message : "Could not sync"),
                  )
                }
              >
                {lan.phase === "connected"
                  ? "Sync"
                  : lan.phase === "host-offer" || lan.phase === "guest-wait" || lan.phase === "guest-answer"
                    ? "Linking…"
                    : "Sync"}
              </button>
            )}
          </div>

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

          <Glance
            events={store.events}
            settings={store.settings}
            now={now}
            onFeed={() => setSheet("feed")}
            onPump={() => setSheet("pump")}
            onDiaper={() => setSheet("diaper")}
            onSleep={() => {
              if (active?.type === "sleep") {
                setEditing(active);
                setSheet("event");
              } else {
                setSheet("sleep");
              }
            }}
          />

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
            <button className="action wide voice" type="button" onClick={startVoice}>
              <div className="label">Speak</div>
              <div className="hint">wet diaper · start left · formula 90</div>
            </button>
            <button className="action wide feed" type="button" onClick={() => setSheet("feed")}>
              <div className="label">Feed</div>
              <div className="hint">Start {next} · bottle or mixed</div>
            </button>
            <button
              className="action sleep"
              type="button"
              onClick={() => {
                if (active?.type === "sleep") {
                  void endTimedEvent(active.id).then(() => store.flash("Saved"));
                } else if (active) {
                  store.flash("End the feed first");
                } else {
                  void startSleep().then((event) => store.flash("Sleeping", () => void removeEvent(event.id)));
                }
              }}
            >
              <div className="label">{active?.type === "sleep" ? "End sleep" : "Sleep"}</div>
              <div className="hint">{active?.type === "sleep" ? "tap to wake" : "tap to start"}</div>
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
            voice.stop();
            setSheet(null);
            setEditing(null);
          }}
        >
          {sheet === "feed" && (
            <FeedSheet
              next={next}
              timezone={store.settings.timezone}
              unit={volumeUnit}
              lastBottle={
                lastBottleData && lastBottleData.method !== "breast"
                  ? { method: lastBottleData.method, ml: bottleMl(lastBottleData) }
                  : undefined
              }
              lastBreast={lastBreastMinutes(store.events)}
              onBreast={async (side, iso) => {
                if (active) await endTimedEvent(active.id);
                const event = await startBreastFeed(side, { iso });
                setSheet(null);
                store.flash("Feed started", () => void removeEvent(event.id));
              }}
              onLogBreast={async ({ startedOn, leftSeconds, rightSeconds, iso }) => {
                const event = await logBreastFeed({ startedOn, leftSeconds, rightSeconds, when: { iso } });
                setSheet(null);
                store.flash("Feed saved", () => void removeEvent(event.id));
              }}
              onPickBottle={(method) => {
                setBottleMethod(method);
                setSheet("bottle");
              }}
              onRepeatLast={async (iso) => {
                if (!lastBottleData || lastBottleData.method === "breast") return;
                const event = await logBottleFeed({
                  method: lastBottleData.method,
                  volumeMl: lastBottleData.volumeMl,
                  formulaMl: lastBottleData.formulaMl,
                  expressedMl: lastBottleData.expressedMl,
                  when: { iso },
                });
                setSheet(null);
                store.flash("Feed saved", () => void removeEvent(event.id));
              }}
            />
          )}
          {sheet === "bottle" && (
            <BottleSheet
              method={bottleMethod}
              unit={volumeUnit}
              timezone={store.settings.timezone}
              lastAmount={lastBottleAmount != null ? mlToDisplay(lastBottleAmount, volumeUnit) : undefined}
              onSave={async (amount, iso) => {
                const ml = displayToMl(amount, volumeUnit);
                if (active?.type === "feed" && bottleMethod === "mixed") {
                  await addBottleToFeed(active.id, { formulaMl: ml, method: "mixed" });
                  setSheet(null);
                  store.flash("Feed saved");
                  return;
                }
                const event = await logBottleFeed({
                  method: bottleMethod,
                  volumeMl: ml,
                  formulaMl: bottleMethod === "formula" || bottleMethod === "mixed" ? ml : undefined,
                  expressedMl: bottleMethod === "expressed" ? ml : undefined,
                  when: { iso },
                });
                setSheet(null);
                store.flash("Feed saved", () => void removeEvent(event.id));
              }}
            />
          )}
          {sheet === "diaper" && (
            <DiaperSheet
              timezone={store.settings.timezone}
              onSave={async (kind, iso) => {
                const event = await logDiaper(kind, { iso });
                setSheet(null);
                store.flash("Diaper saved", () => void removeEvent(event.id));
              }}
            />
          )}
          {sheet === "pump" && (
            <PumpSheet
              unit={volumeUnit}
              timezone={store.settings.timezone}
              lastLeft={lastPump ? mlToDisplay(lastPump.leftMl, volumeUnit) : undefined}
              lastRight={lastPump ? mlToDisplay(lastPump.rightMl, volumeUnit) : undefined}
              onSave={async (left, right, iso) => {
                const event = await logPump({
                  leftMl: displayToMl(left, volumeUnit),
                  rightMl: displayToMl(right, volumeUnit),
                  when: { iso },
                });
                setSheet(null);
                store.flash("Pump saved", () => void removeEvent(event.id));
              }}
            />
          )}
          {sheet === "weight" && (
            <WeightSheet
              unit={store.settings.weightUnit}
              timezone={store.settings.timezone}
              lastGrams={lastWeightGrams(store.events)}
              onSave={async (grams, iso) => {
                const event = await logWeight(grams, { iso });
                setSheet(null);
                store.flash("Weight saved", () => void removeEvent(event.id));
              }}
            />
          )}
          {sheet === "temp" && (
            <TempSheet
              unit={store.settings.tempUnit}
              timezone={store.settings.timezone}
              lastCelsius={lastTempCelsius(store.events)}
              onSave={async (celsius, iso) => {
                const event = await logTemperature(celsius, { iso });
                setSheet(null);
                store.flash("Temperature saved", () => void removeEvent(event.id));
              }}
            />
          )}
          {sheet === "sleep" && (
            <SleepSheet
              timezone={store.settings.timezone}
              past
              lastNapMinutes={lastFinishedSleepMinutes(store.events)}
              onStart={async (iso) => {
                const event = await startSleep({ iso });
                setSheet(null);
                store.flash("Sleeping", () => void removeEvent(event.id));
              }}
              onLog={async (startIso, endIso) => {
                const event = await logSleep({ start: { iso: startIso }, endedAt: endIso });
                setSheet(null);
                store.flash("Sleep saved", () => void removeEvent(event.id));
              }}
            />
          )}
          {sheet === "note" && (
            <NoteSheet
              timezone={store.settings.timezone}
              onSave={async (text, iso) => {
                const event = await logNote(text, { iso });
                setSheet(null);
                store.flash("Note saved", () => void removeEvent(event.id));
              }}
            />
          )}
          {sheet === "voice" && (
            <VoiceSheet
              nextSide={next}
              phase={voice.phase}
              text={voice.text}
              error={voice.error}
              canListen={voice.canListen}
              onText={voice.setText}
              onListen={() =>
                voice.start((spoken) => {
                  const intent = parseVoiceLog(spoken, next);
                  if (intent.type === "unknown") return;
                  commitVoice(intent);
                })
              }
              onStop={voice.stop}
              onSubmit={commitVoice}
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
        <div className="toast" role="status">
          {store.toast.undo ? (
            <button
              type="button"
              className="toast-undo"
              aria-label={`Undo ${store.toast.message}`}
              onClick={() => {
                store.toast?.undo?.();
                store.setToast(null);
              }}
            >
              <span>{store.toast.message}</span>
              <strong>Undo</strong>
            </button>
          ) : (
            <span>{store.toast.message}</span>
          )}
        </div>
      )}
      <AppDock page="home" store={store} needRefresh={needRefresh} reload={reload} />
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

function AppDock({
  page,
  store,
  needRefresh,
  reload,
}: {
  page: "home" | "report" | "camera" | "settings" | "docs";
  store: { setPage: (page: AppPage) => void };
  needRefresh: boolean;
  reload: () => void;
}) {
  return (
    <Dock
      page={page}
      onHome={() => store.setPage("home")}
      onReport={() => store.setPage("report")}
      onCamera={() => store.setPage("camera")}
      onSettings={() => store.setPage("settings")}
      needRefresh={needRefresh}
      onReload={reload}
    />
  );
}
