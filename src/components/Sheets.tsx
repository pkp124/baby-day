import { useState, type ReactNode } from "react";
import type { BreastSide, CareEvent, DiaperKind, FeedData, FeedMethod, Settings } from "../lib/types";
import { TimeChips, VolumeChips } from "./Bits";
import { displayToGrams, displayToMl, formatWeight } from "../lib/units";
import { removeEvent, updateEvent } from "../lib/repo";

export function FeedSheet({
  next,
  onBreast,
  onPickBottle,
}: {
  next: BreastSide;
  onBreast: (side: BreastSide, minutesAgo: number) => void;
  onPickBottle: (method: Extract<FeedMethod, "expressed" | "formula" | "mixed">) => void;
}) {
  const [minutesAgo, setMinutesAgo] = useState(0);
  return (
    <>
      <h2>Feed</h2>
      <TimeChips minutesAgo={minutesAgo} onChange={setMinutesAgo} />
      <div className="choices">
        <button className={`choice ${next === "left" ? "hl" : ""}`} type="button" onClick={() => onBreast("left", minutesAgo)}>
          Start left
          {next === "left" ? <span className="faint">next</span> : null}
        </button>
        <button className={`choice ${next === "right" ? "hl" : ""}`} type="button" onClick={() => onBreast("right", minutesAgo)}>
          Start right
          {next === "right" ? <span className="faint">next</span> : null}
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
  onSave,
}: {
  method: Extract<FeedMethod, "expressed" | "formula" | "mixed">;
  unit: Settings["volumeUnit"];
  onSave: (volumeDisplay: number, minutesAgo: number) => void;
}) {
  const [minutesAgo, setMinutesAgo] = useState(0);
  const [amount, setAmount] = useState(unit === "oz" ? 2 : 60);
  const label = method === "formula" ? "Formula" : method === "expressed" ? "Expressed milk" : "Bottle top-up";
  return (
    <>
      <h2>{label}</h2>
      <TimeChips minutesAgo={minutesAgo} onChange={setMinutesAgo} />
      <VolumeChips value={amount} unitLabel={unit} onChange={setAmount} />
      <label className="field">
        Amount ({unit})
        <input type="number" min={0} step={unit === "oz" ? 0.5 : 5} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
      </label>
      <button className="primary grow" type="button" onClick={() => onSave(amount, minutesAgo)}>
        Save {amount} {unit}
      </button>
    </>
  );
}

export function DiaperSheet({ onSave }: { onSave: (kind: DiaperKind, minutesAgo: number) => void }) {
  const [minutesAgo, setMinutesAgo] = useState(0);
  return (
    <>
      <h2>Diaper</h2>
      <TimeChips minutesAgo={minutesAgo} onChange={setMinutesAgo} />
      <div className="choices">
        <button className="choice" type="button" onClick={() => onSave("wet", minutesAgo)}>
          Wet
        </button>
        <button className="choice" type="button" onClick={() => onSave("dirty", minutesAgo)}>
          Dirty
        </button>
        <button className="choice" type="button" onClick={() => onSave("both", minutesAgo)}>
          Wet + dirty
        </button>
      </div>
    </>
  );
}

export function PumpSheet({
  unit,
  onSave,
}: {
  unit: Settings["volumeUnit"];
  onSave: (left: number, right: number, minutesAgo: number) => void;
}) {
  const [minutesAgo, setMinutesAgo] = useState(0);
  const [left, setLeft] = useState(0);
  const [right, setRight] = useState(0);
  return (
    <>
      <h2>Pump</h2>
      <TimeChips minutesAgo={minutesAgo} onChange={setMinutesAgo} />
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
      <button className="primary" type="button" onClick={() => onSave(left, right, minutesAgo)}>
        Save pump
      </button>
    </>
  );
}

export function WeightSheet({
  unit,
  onSave,
}: {
  unit: Settings["weightUnit"];
  onSave: (grams: number, minutesAgo: number) => void;
}) {
  const [minutesAgo, setMinutesAgo] = useState(0);
  const [value, setValue] = useState(unit === "lb" ? 7.5 : 3.4);
  return (
    <>
      <h2>Weight</h2>
      <TimeChips minutesAgo={minutesAgo} onChange={setMinutesAgo} />
      <label className="field">
        Weight ({unit})
        <input type="number" min={0} step={unit === "lb" ? 0.1 : 0.01} value={value} onChange={(e) => setValue(Number(e.target.value))} />
      </label>
      <button className="primary" type="button" onClick={() => onSave(displayToGrams(value, unit), minutesAgo)}>
        Save {value} {unit}
      </button>
    </>
  );
}

export function NoteSheet({ onSave }: { onSave: (text: string, minutesAgo: number) => void }) {
  const [minutesAgo, setMinutesAgo] = useState(0);
  const [text, setText] = useState("");
  return (
    <>
      <h2>Note</h2>
      <TimeChips minutesAgo={minutesAgo} onChange={setMinutesAgo} />
      <label className="field">
        What happened?
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} />
      </label>
      <button className="primary" type="button" disabled={!text.trim()} onClick={() => onSave(text.trim(), minutesAgo)}>
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

  async function save() {
    if (event.type === "note") await updateEvent(event.id, { data: { text: note } });
    else await updateEvent(event.id, { data: { ...event.data, note } });
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
      <p className="muted">{event.type}</p>
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
