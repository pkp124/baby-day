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
  WeightData,
} from "../lib/types";
import { DurationChips, VolumeChips, WhenField } from "./Bits";
import { displayToCelsius, displayToGrams, displayToMl, formatWeight, celsiusToDisplay } from "../lib/units";
import { formatDuration, orderedInstants } from "../lib/time";
import { removeEvent, updateEvent } from "../lib/repo";

export function FeedSheet({
  next,
  timezone,
  onBreast,
  onLogBreast,
  onPickBottle,
}: {
  next: BreastSide;
  timezone: string;
  onBreast: (side: BreastSide, iso: string) => void;
  onLogBreast: (input: { startedOn: BreastSide; leftSeconds: number; rightSeconds: number; iso: string }) => void;
  onPickBottle: (method: Extract<FeedMethod, "expressed" | "formula" | "mixed">) => void;
}) {
  const [whenIso, setWhenIso] = useState(() => new Date().toISOString());
  const [view, setView] = useState<"main" | "breast">("main");
  const [leftMin, setLeftMin] = useState(10);
  const [rightMin, setRightMin] = useState(10);
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
      <div className="choices">
        <button className={`choice ${next === "left" ? "hl" : ""}`} type="button" onClick={() => onBreast("left", whenIso)}>
          Start left
          {next === "left" ? <span className="faint">next</span> : null}
        </button>
        <button className={`choice ${next === "right" ? "hl" : ""}`} type="button" onClick={() => onBreast("right", whenIso)}>
          Start right
          {next === "right" ? <span className="faint">next</span> : null}
        </button>
        <button className="choice" type="button" onClick={() => setView("breast")}>
          Log times on each breast
          <span className="faint">after the fact</span>
        </button>
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
    </>
  );
}

export function BottleSheet({
  method,
  unit,
  timezone,
  onSave,
}: {
  method: Extract<FeedMethod, "expressed" | "formula" | "mixed">;
  unit: Settings["volumeUnit"];
  timezone: string;
  onSave: (volumeDisplay: number, iso: string) => void;
}) {
  const [whenIso, setWhenIso] = useState(() => new Date().toISOString());
  const [amount, setAmount] = useState(unit === "oz" ? 2 : 60);
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
  onSave,
}: {
  unit: Settings["volumeUnit"];
  timezone: string;
  onSave: (left: number, right: number, iso: string) => void;
}) {
  const [whenIso, setWhenIso] = useState(() => new Date().toISOString());
  const [left, setLeft] = useState(0);
  const [right, setRight] = useState(0);
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
  onSave,
}: {
  unit: Settings["weightUnit"];
  timezone: string;
  onSave: (grams: number, iso: string) => void;
}) {
  const [whenIso, setWhenIso] = useState(() => new Date().toISOString());
  const [value, setValue] = useState(unit === "lb" ? 7.5 : 3.4);
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
  onSave,
}: {
  unit: Settings["tempUnit"];
  timezone: string;
  onSave: (celsius: number, iso: string) => void;
}) {
  const [whenIso, setWhenIso] = useState(() => new Date().toISOString());
  const [value, setValue] = useState(unit === "F" ? 98.6 : 37);
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
  onStart,
  onLog,
}: {
  timezone: string;
  onStart: (iso: string) => void;
  onLog: (startIso: string, endIso: string) => void;
}) {
  const [startIso, setStartIso] = useState(() => new Date().toISOString());
  const [endIso, setEndIso] = useState(() => new Date().toISOString());
  const durationSec = (new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000;
  return (
    <>
      <h2>Sleep</h2>
      <WhenField timezone={timezone} valueIso={startIso} onChangeIso={setStartIso} label="Started" />
      <button className="primary sleep grow" type="button" onClick={() => onStart(startIso)}>
        Start sleep
      </button>
      <p className="muted sheet-split">
        Or log a finished nap
      </p>
      <WhenField timezone={timezone} valueIso={endIso} onChangeIso={setEndIso} label="Woke" />
      {durationSec > 0 ? <p className="muted">{formatDuration(durationSec)}</p> : <p className="warn-text">Wake time needs to be after the start.</p>}
      <button className="secondary" type="button" disabled={durationSec <= 0} onClick={() => onLog(startIso, endIso)}>
        Save nap
      </button>
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
  const temp = event.type === "temp" ? (event.data as TempData) : null;
  const [tempDisplay, setTempDisplay] = useState(temp ? celsiusToDisplay(temp.celsius, settings.tempUnit) : 0);
  const showBreastTimes = Boolean(feed && (feed.method === "breast" || feed.method === "mixed"));

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
        await updateEvent(event.id, { time: whenIso, endedAt: whenIso, data: { ...(event.data as WeightData), note } });
        break;
      case "diaper":
        await updateEvent(event.id, { time: whenIso, endedAt: whenIso, data: { ...(event.data as DiaperData), note } });
        break;
      case "pump":
        await updateEvent(event.id, { time: whenIso, endedAt: whenIso, data: { ...(event.data as PumpData), note } });
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
      <p className="muted">{event.type === "temp" ? "temperature" : event.type}</p>
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
      {event.type === "feed" && (event.data as FeedData).method !== "formula" && (
        <div className="row" style={{ margin: "12px 0" }}>
          <button className="secondary grow" type="button" onClick={() => topUp(settings.volumeUnit === "oz" ? 1 : 30)}>
            Add {settings.volumeUnit === "oz" ? "1 oz" : "30 ml"} formula
          </button>
        </div>
      )}
      {event.type === "weight" && (
        <p className="muted">{formatWeight((event.data as { grams: number }).grams, settings.weightUnit)}</p>
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
