import { useState, type ReactNode } from "react";
import type {
  BreastSide,
  CareEvent,
  DiaperData,
  DiaperKind,
  FeedData,
  FeedMethod,
  PumpData,
  Settings,
  SleepData,
  TempData,
  VitaminData,
  WeightData,
} from "../lib/types";
import { milkSplit, vitaminLabel } from "../lib/domain";
import { DurationChips, VolumeChips, WhenField } from "./Bits";
import {
  celsiusToDisplay,
  displayToCelsius,
  displayToGrams,
  displayToMl,
  formatMl,
  gramsToDisplay,
  mlToDisplay,
} from "../lib/units";
import { formatDuration, minutesAgoIso, orderedInstants } from "../lib/time";
import { removeEvent, updateEvent } from "../lib/repo";

export function FeedSheet({
  next,
  timezone,
  unit,
  lastBottle,
  lastBreast,
  onBreast,
  onLogBreast,
  onPickBottle,
  onRepeatLast,
}: {
  next: BreastSide;
  timezone: string;
  unit: Settings["volumeUnit"];
  lastBottle?: { method: Extract<FeedMethod, "expressed" | "formula" | "mixed">; ml: number };
  lastBreast?: { left: number; right: number };
  onBreast: (side: BreastSide, iso: string) => void;
  onLogBreast: (input: { startedOn: BreastSide; leftSeconds: number; rightSeconds: number; iso: string }) => void;
  onPickBottle: (method: Extract<FeedMethod, "expressed" | "formula" | "mixed">) => void;
  onRepeatLast: (iso: string) => void;
}) {
  const [whenIso, setWhenIso] = useState(() => new Date().toISOString());
  const [view, setView] = useState<"main" | "breast">("main");
  const [leftMin, setLeftMin] = useState(lastBreast?.left ?? 10);
  const [rightMin, setRightMin] = useState(lastBreast?.right ?? 10);
  const [startedOn, setStartedOn] = useState<BreastSide>(next);

  if (view === "breast") {
    const canSave = leftMin > 0 || rightMin > 0;
    return (
      <>
        <h2>Breast times</h2>
        <p className="muted">How long the baby spent on each side.</p>
        <WhenField timezone={timezone} valueIso={whenIso} onChangeIso={setWhenIso} label="Started" />
        <label className="field">
          Left (minutes)
          <input type="number" min={0} step={1} value={leftMin} onChange={(e) => setLeftMin(Number(e.target.value))} />
        </label>
        <DurationChips value={leftMin} onChange={setLeftMin} />
        <label className="field">
          Right (minutes)
          <input type="number" min={0} step={1} value={rightMin} onChange={(e) => setRightMin(Number(e.target.value))} />
        </label>
        <DurationChips value={rightMin} onChange={setRightMin} />
        <p className="muted">Started on</p>
        <div className="row" style={{ marginBottom: 12 }}>
          <button className={startedOn === "left" ? "primary grow" : "secondary grow"} type="button" onClick={() => setStartedOn("left")}>
            Left
          </button>
          <button className={startedOn === "right" ? "primary grow" : "secondary grow"} type="button" onClick={() => setStartedOn("right")}>
            Right
          </button>
        </div>
        <button
          className="primary grow"
          type="button"
          disabled={!canSave}
          onClick={() =>
            onLogBreast({
              startedOn,
              leftSeconds: Math.max(0, leftMin) * 60,
              rightSeconds: Math.max(0, rightMin) * 60,
              iso: whenIso,
            })
          }
        >
          Save breast feed
        </button>
        <button className="ghost" type="button" onClick={() => setView("main")}>
          Back
        </button>
      </>
    );
  }

  return (
    <>
      <h2>Feed</h2>
      <WhenField timezone={timezone} valueIso={whenIso} onChangeIso={setWhenIso} />
      <div className="choices sides">
        <button className={`choice start ${next === "left" ? "hl" : ""}`} type="button" onClick={() => onBreast("left", whenIso)}>
          Start left
          {next === "left" ? <span className="faint">next</span> : null}
        </button>
        <button className={`choice start ${next === "right" ? "hl" : ""}`} type="button" onClick={() => onBreast("right", whenIso)}>
          Start right
          {next === "right" ? <span className="faint">next</span> : null}
        </button>
      </div>
      <div className="choices">
        {lastBottle && lastBottle.ml > 0 ? (
          <button className="choice" type="button" onClick={() => onRepeatLast(whenIso)}>
            Same as last
            <span className="faint">
              {formatMl(lastBottle.ml, unit)}{" "}
              {lastBottle.method === "formula" ? "formula" : lastBottle.method === "expressed" ? "expressed" : "mixed"}
            </span>
          </button>
        ) : null}
        <button className="choice" type="button" onClick={() => onPickBottle("formula")}>
          Formula bottle
        </button>
        <button className="choice" type="button" onClick={() => onPickBottle("expressed")}>
          Expressed milk
        </button>
        <button className="choice" type="button" onClick={() => onPickBottle("mixed")}>
          Mixed / top-up later
        </button>
      </div>
      <button className="ghost" type="button" onClick={() => setView("breast")}>
        Log times on each breast
      </button>
    </>
  );
}

export function BottleSheet({
  method,
  unit,
  timezone,
  lastAmount,
  onSave,
}: {
  method: Extract<FeedMethod, "expressed" | "formula" | "mixed">;
  unit: Settings["volumeUnit"];
  timezone: string;
  lastAmount?: number;
  onSave: (volumeDisplay: number, iso: string) => void;
}) {
  const [whenIso, setWhenIso] = useState(() => new Date().toISOString());
  const [amount, setAmount] = useState(lastAmount ?? (unit === "oz" ? 2 : 60));
  const label = method === "formula" ? "Formula" : method === "expressed" ? "Expressed milk" : "Bottle top-up";
  return (
    <>
      <h2>{label}</h2>
      <WhenField timezone={timezone} valueIso={whenIso} onChangeIso={setWhenIso} />
      <VolumeChips value={amount} unitLabel={unit} onChange={setAmount} />
      <label className="field">
        Amount ({unit})
        <input type="number" min={0} step={unit === "oz" ? 0.5 : 5} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
      </label>
      <button className="primary grow" type="button" onClick={() => onSave(amount, whenIso)}>
        Save {amount} {unit}
      </button>
    </>
  );
}

export function DiaperSheet({ timezone, onSave }: { timezone: string; onSave: (kind: DiaperKind, iso: string) => void }) {
  const [whenIso, setWhenIso] = useState(() => new Date().toISOString());
  return (
    <>
      <h2>Diaper</h2>
      <WhenField timezone={timezone} valueIso={whenIso} onChangeIso={setWhenIso} />
      <div className="choices">
        <button className="choice" type="button" onClick={() => onSave("wet", whenIso)}>
          Wet
        </button>
        <button className="choice" type="button" onClick={() => onSave("dirty", whenIso)}>
          Dirty
        </button>
        <button className="choice" type="button" onClick={() => onSave("both", whenIso)}>
          Wet + dirty
        </button>
      </div>
    </>
  );
}

export function PumpSheet({
  unit,
  timezone,
  lastLeft,
  lastRight,
  onSave,
}: {
  unit: Settings["volumeUnit"];
  timezone: string;
  lastLeft?: number;
  lastRight?: number;
  onSave: (left: number, right: number, iso: string) => void;
}) {
  const [whenIso, setWhenIso] = useState(() => new Date().toISOString());
  const [left, setLeft] = useState(lastLeft ?? 0);
  const [right, setRight] = useState(lastRight ?? 0);
  return (
    <>
      <h2>Pump</h2>
      <WhenField timezone={timezone} valueIso={whenIso} onChangeIso={setWhenIso} />
      <label className="field">
        Left ({unit})
        <input type="number" min={0} value={left} onChange={(e) => setLeft(Number(e.target.value))} />
      </label>
      <VolumeChips value={left} unitLabel={unit} onChange={setLeft} />
      <label className="field">
        Right ({unit})
        <input type="number" min={0} value={right} onChange={(e) => setRight(Number(e.target.value))} />
      </label>
      <VolumeChips value={right} unitLabel={unit} onChange={setRight} />
      <button className="primary" type="button" onClick={() => onSave(left, right, whenIso)}>
        Save pump
      </button>
    </>
  );
}

export function WeightSheet({
  unit,
  timezone,
  lastGrams,
  onSave,
}: {
  unit: Settings["weightUnit"];
  timezone: string;
  lastGrams?: number;
  onSave: (grams: number, iso: string) => void;
}) {
  const [whenIso, setWhenIso] = useState(() => new Date().toISOString());
  const [value, setValue] = useState(lastGrams != null ? gramsToDisplay(lastGrams, unit) : unit === "lb" ? 7.5 : 3.4);
  return (
    <>
      <h2>Weight</h2>
      <WhenField timezone={timezone} valueIso={whenIso} onChangeIso={setWhenIso} />
      <label className="field">
        Weight ({unit})
        <input type="number" min={0} step={unit === "lb" ? 0.1 : 0.01} value={value} onChange={(e) => setValue(Number(e.target.value))} />
      </label>
      <button className="primary" type="button" onClick={() => onSave(displayToGrams(value, unit), whenIso)}>
        Save {value} {unit}
      </button>
    </>
  );
}

export function TempSheet({
  unit,
  timezone,
  lastCelsius,
  onSave,
}: {
  unit: Settings["tempUnit"];
  timezone: string;
  lastCelsius?: number;
  onSave: (celsius: number, iso: string) => void;
}) {
  const [whenIso, setWhenIso] = useState(() => new Date().toISOString());
  const [value, setValue] = useState(lastCelsius != null ? celsiusToDisplay(lastCelsius, unit) : unit === "F" ? 98.6 : 37);
  const presets = unit === "F" ? [97, 98.6, 99.5, 100.4, 101.3, 102.2] : [36.5, 37, 37.5, 38, 38.5, 39];
  const unitLabel = unit === "F" ? "°F" : "°C";
  return (
    <>
      <h2>Temperature</h2>
      <WhenField timezone={timezone} valueIso={whenIso} onChangeIso={setWhenIso} />
      <div className="stepper">
        {presets.map((n) => (
          <button key={n} type="button" className={value === n ? "on" : ""} onClick={() => setValue(n)}>
            {n}
            {unitLabel}
          </button>
        ))}
      </div>
      <label className="field">
        Temperature ({unitLabel})
        <input type="number" min={0} step={0.1} value={value} onChange={(e) => setValue(Number(e.target.value))} />
      </label>
      <button className="primary" type="button" onClick={() => onSave(displayToCelsius(value, unit), whenIso)}>
        Save {value.toFixed(1)} {unitLabel}
      </button>
    </>
  );
}

export function SleepSheet({
  timezone,
  past = false,
  lastNapMinutes,
  onStart,
  onLog,
}: {
  timezone: string;
  past?: boolean;
  lastNapMinutes?: number;
  onStart: (iso: string) => void;
  onLog: (startIso: string, endIso: string) => void;
}) {
  const [startIso, setStartIso] = useState(() => (past ? minutesAgoIso(lastNapMinutes && lastNapMinutes > 0 ? lastNapMinutes : 30) : new Date().toISOString()));
  const [endIso, setEndIso] = useState(() => new Date().toISOString());
  const durationSec = (new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000;
  return (
    <>
      <h2>{past ? "Log a nap" : "Sleep"}</h2>
      <WhenField timezone={timezone} valueIso={startIso} onChangeIso={setStartIso} label="Started" />
      {!past ? (
        <button className="primary sleep grow" type="button" onClick={() => onStart(startIso)}>
          Start sleep
        </button>
      ) : null}
      <p className={past ? "muted" : "muted sheet-split"}>{past ? "When the baby woke." : "Or log a finished nap"}</p>
      <WhenField timezone={timezone} valueIso={endIso} onChangeIso={setEndIso} label="Woke" />
      {durationSec > 0 ? <p className="muted">{formatDuration(durationSec)}</p> : <p className="warn-text">Wake time needs to be after the start.</p>}
      <button className={past ? "primary sleep grow" : "secondary"} type="button" disabled={durationSec <= 0} onClick={() => onLog(startIso, endIso)}>
        Save nap
      </button>
      {past ? (
        <button className="ghost" type="button" onClick={() => onStart(new Date().toISOString())}>
          Start sleep now
        </button>
      ) : null}
    </>
  );
}

export function NoteSheet({ timezone, onSave }: { timezone: string; onSave: (text: string, iso: string) => void }) {
  const [whenIso, setWhenIso] = useState(() => new Date().toISOString());
  const [text, setText] = useState("");
  return (
    <>
      <h2>Note</h2>
      <WhenField timezone={timezone} valueIso={whenIso} onChangeIso={setWhenIso} />
      <label className="field">
        What happened?
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} />
      </label>
      <button className="primary" type="button" disabled={!text.trim()} onClick={() => onSave(text.trim(), whenIso)}>
        Save note
      </button>
    </>
  );
}

function editorTypeLabel(event: CareEvent) {
  switch (event.type) {
    case "feed":
      return "feed";
    case "pump":
      return "pump";
    case "diaper":
      return "diaper";
    case "sleep":
      return "sleep";
    case "weight":
      return "weight";
    case "temp":
      return "temperature";
    case "note":
      return "note";
    case "vitaminD":
    case "vitaminK":
      return vitaminLabel(event.type);
    default: {
      const _exhaustive: never = event.type;
      return _exhaustive;
    }
  }
}

export function EventEditor({
  event,
  settings,
  onClose,
  onDeleted,
}: {
  event: CareEvent;
  settings: Settings;
  onClose: () => void;
  onDeleted: (event: CareEvent) => void;
}) {
  const [note, setNote] = useState(
    event.type === "note" ? (event.data as { text: string }).text : ((event.data as { note?: string }).note ?? ""),
  );
  const [whenIso, setWhenIso] = useState(event.time);
  const [endedIso, setEndedIso] = useState(event.endedAt ?? "");
  const feed = event.type === "feed" ? (event.data as FeedData) : null;
  const [leftMin, setLeftMin] = useState(feed ? Math.round((feed.leftSeconds ?? 0) / 60) : 0);
  const [rightMin, setRightMin] = useState(feed ? Math.round((feed.rightSeconds ?? 0) / 60) : 0);
  const milk = feed ? milkSplit(feed) : { formulaMl: 0, expressedMl: 0 };
  const [formulaDisplay, setFormulaDisplay] = useState(mlToDisplay(milk.formulaMl, settings.volumeUnit));
  const [expressedDisplay, setExpressedDisplay] = useState(mlToDisplay(milk.expressedMl, settings.volumeUnit));
  const temp = event.type === "temp" ? (event.data as TempData) : null;
  const [tempDisplay, setTempDisplay] = useState(temp ? celsiusToDisplay(temp.celsius, settings.tempUnit) : 0);
  const weight = event.type === "weight" ? (event.data as WeightData) : null;
  const [weightDisplay, setWeightDisplay] = useState(weight ? gramsToDisplay(weight.grams, settings.weightUnit) : 0);
  const pump = event.type === "pump" ? (event.data as PumpData) : null;
  const [pumpLeft, setPumpLeft] = useState(pump ? mlToDisplay(pump.leftMl ?? 0, settings.volumeUnit) : 0);
  const [pumpRight, setPumpRight] = useState(pump ? mlToDisplay(pump.rightMl ?? 0, settings.volumeUnit) : 0);
  const diaper = event.type === "diaper" ? (event.data as DiaperData) : null;
  const [kind, setKind] = useState<DiaperKind>(diaper?.kind ?? "wet");
  const showBreastTimes = Boolean(feed && (feed.method === "breast" || feed.method === "mixed"));
  const showBottleAmounts = Boolean(feed && feed.method !== "breast");

  async function save() {
    switch (event.type) {
      case "note":
        await updateEvent(event.id, { time: whenIso, endedAt: whenIso, data: { text: note } });
        break;
      case "sleep": {
        const endedAt = endedIso || event.endedAt;
        if (endedAt) {
          const [start, end] = orderedInstants(whenIso, endedAt);
          await updateEvent(event.id, { time: start, endedAt: end, data: { ...(event.data as SleepData), note } });
        } else {
          await updateEvent(event.id, { time: whenIso, endedAt: null, data: { ...(event.data as SleepData), note } });
        }
        break;
      }
      case "feed": {
        const data: FeedData = { ...(event.data as FeedData), note };
        let endedAt = event.endedAt;
        if (data.method === "breast" || data.method === "mixed") {
          data.leftSeconds = Math.max(0, leftMin) * 60;
          data.rightSeconds = Math.max(0, rightMin) * 60;
          if (endedAt) {
            endedAt = new Date(new Date(whenIso).getTime() + (data.leftSeconds + data.rightSeconds) * 1000).toISOString();
          }
        } else {
          endedAt = whenIso;
        }
        if (data.method !== "breast") {
          const formulaMl = displayToMl(Math.max(0, formulaDisplay), settings.volumeUnit);
          const expressedMl = displayToMl(Math.max(0, expressedDisplay), settings.volumeUnit);
          data.formulaMl = formulaMl || undefined;
          data.expressedMl = expressedMl || undefined;
          data.volumeMl = formulaMl + expressedMl || undefined;
          if (data.method === "formula") data.formulaMl = data.volumeMl;
          if (data.method === "expressed") data.expressedMl = data.volumeMl;
        }
        await updateEvent(event.id, { time: whenIso, endedAt, data });
        break;
      }
      case "temp":
        await updateEvent(event.id, {
          time: whenIso,
          endedAt: whenIso,
          data: { celsius: displayToCelsius(tempDisplay, settings.tempUnit), note },
        });
        break;
      case "weight":
        await updateEvent(event.id, {
          time: whenIso,
          endedAt: whenIso,
          data: { grams: displayToGrams(weightDisplay, settings.weightUnit), note },
        });
        break;
      case "diaper":
        await updateEvent(event.id, { time: whenIso, endedAt: whenIso, data: { kind, note } });
        break;
      case "pump":
        await updateEvent(event.id, {
          time: whenIso,
          endedAt: whenIso,
          data: {
            leftMl: displayToMl(Math.max(0, pumpLeft), settings.volumeUnit),
            rightMl: displayToMl(Math.max(0, pumpRight), settings.volumeUnit),
            note,
          },
        });
        break;
      case "vitaminD":
      case "vitaminK":
        await updateEvent(event.id, { time: whenIso, endedAt: whenIso, data: { ...(event.data as VitaminData), note } });
        break;
      default: {
        const _exhaustive: never = event.type;
        void _exhaustive;
      }
    }
    onClose();
  }

  async function topUp(mlDisplay: number) {
    if (event.type !== "feed") return;
    const ml = displayToMl(mlDisplay, settings.volumeUnit);
    const data = { ...(event.data as FeedData), method: "mixed" as const, formulaMl: ((event.data as FeedData).formulaMl ?? 0) + ml };
    await updateEvent(event.id, { data });
    onClose();
  }

  return (
    <>
      <h2>Edit</h2>
      <p className="muted">{editorTypeLabel(event)}</p>
      <WhenField timezone={settings.timezone} valueIso={whenIso} onChangeIso={setWhenIso} label={event.type === "sleep" ? "Started" : "When"} />
      {event.type === "sleep" && (endedIso || event.endedAt) ? (
        <WhenField timezone={settings.timezone} valueIso={endedIso || event.endedAt || whenIso} onChangeIso={setEndedIso} label="Woke" />
      ) : event.type === "sleep" ? (
        <button className="secondary" type="button" onClick={() => setEndedIso(new Date().toISOString())}>
          Set wake time
        </button>
      ) : null}
      {showBreastTimes && (
        <>
          <label className="field">
            Left (minutes)
            <input type="number" min={0} step={1} value={leftMin} onChange={(e) => setLeftMin(Number(e.target.value))} />
          </label>
          <DurationChips value={leftMin} onChange={setLeftMin} />
          <label className="field">
            Right (minutes)
            <input type="number" min={0} step={1} value={rightMin} onChange={(e) => setRightMin(Number(e.target.value))} />
          </label>
          <DurationChips value={rightMin} onChange={setRightMin} />
        </>
      )}
      {showBottleAmounts && (
        <>
          {(feed?.method === "formula" || feed?.method === "mixed") && (
            <label className="field">
              Formula ({settings.volumeUnit})
              <input type="number" min={0} step={settings.volumeUnit === "oz" ? 0.5 : 5} value={formulaDisplay} onChange={(e) => setFormulaDisplay(Number(e.target.value))} />
            </label>
          )}
          {(feed?.method === "expressed" || feed?.method === "mixed") && (
            <label className="field">
              Expressed ({settings.volumeUnit})
              <input type="number" min={0} step={settings.volumeUnit === "oz" ? 0.5 : 5} value={expressedDisplay} onChange={(e) => setExpressedDisplay(Number(e.target.value))} />
            </label>
          )}
        </>
      )}
      {event.type === "feed" && (event.data as FeedData).method !== "formula" && (
        <div className="row" style={{ margin: "12px 0" }}>
          <button className="secondary grow" type="button" onClick={() => topUp(settings.volumeUnit === "oz" ? 1 : 30)}>
            Add {settings.volumeUnit === "oz" ? "1 oz" : "30 ml"} formula
          </button>
        </div>
      )}
      {event.type === "diaper" && (
        <div className="row" style={{ margin: "12px 0" }}>
          {(["wet", "dirty", "both"] as const).map((option) => (
            <button
              key={option}
              className={kind === option ? "primary grow" : "secondary grow"}
              type="button"
              onClick={() => setKind(option)}
            >
              {option === "both" ? "Wet + dirty" : option === "wet" ? "Wet" : "Dirty"}
            </button>
          ))}
        </div>
      )}
      {event.type === "pump" && (
        <>
          <label className="field">
            Left ({settings.volumeUnit})
            <input type="number" min={0} value={pumpLeft} onChange={(e) => setPumpLeft(Number(e.target.value))} />
          </label>
          <VolumeChips value={pumpLeft} unitLabel={settings.volumeUnit} onChange={setPumpLeft} />
          <label className="field">
            Right ({settings.volumeUnit})
            <input type="number" min={0} value={pumpRight} onChange={(e) => setPumpRight(Number(e.target.value))} />
          </label>
          <VolumeChips value={pumpRight} unitLabel={settings.volumeUnit} onChange={setPumpRight} />
        </>
      )}
      {event.type === "weight" && (
        <label className="field">
          Weight ({settings.weightUnit})
          <input
            type="number"
            min={0}
            step={settings.weightUnit === "lb" ? 0.1 : 0.01}
            value={weightDisplay}
            onChange={(e) => setWeightDisplay(Number(e.target.value))}
          />
        </label>
      )}
      {event.type === "temp" && (
        <label className="field">
          Temperature ({settings.tempUnit === "F" ? "°F" : "°C"})
          <input type="number" min={0} step={0.1} value={tempDisplay} onChange={(e) => setTempDisplay(Number(e.target.value))} />
        </label>
      )}
      <label className="field">
        Note
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
      </label>
      <div className="row">
        <button className="secondary grow" type="button" onClick={save}>
          Save
        </button>
        <button
          className="danger"
          type="button"
          onClick={async () => {
            await removeEvent(event.id);
            onDeleted(event);
            onClose();
          }}
        >
          Delete
        </button>
      </div>
    </>
  );
}

export function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog">
        {children}
        <button className="ghost" type="button" onClick={onClose} style={{ marginTop: 8 }}>
          Close
        </button>
      </div>
    </div>
  );
}
