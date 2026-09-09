import type { CareEvent, FeedData, Settings } from "./types";
import { bottleMl } from "./domain";
import { displayToCelsius, displayToGrams, displayToMl } from "./units";
import {
  addBottleToFeed,
  endTimedEvent,
  logBottleFeed,
  logDiaper,
  logNote,
  logPump,
  logTemperature,
  logVitamin,
  logWeight,
  startBreastFeed,
  startSleep,
  switchFeedSide,
} from "./repo";
import { describeVoiceIntent, type VoiceIntent } from "./voiceIntent";

export type VoiceApplyCtx = {
  active?: CareEvent;
  settings: Settings;
  lastBottle?: CareEvent;
};

export type VoiceApplyResult =
  | { ok: true; message: string; eventId?: string }
  | { ok: false; message: string };

function when(minutesAgo?: number) {
  return minutesAgo ? { minutesAgo } : undefined;
}

function bottleFromLast(last: CareEvent | undefined) {
  if (!last || last.type !== "feed") return undefined;
  const data = last.data as FeedData;
  if (data.method === "breast") return undefined;
  return data;
}

export async function applyVoiceIntent(intent: VoiceIntent, ctx: VoiceApplyCtx): Promise<VoiceApplyResult> {
  const label = describeVoiceIntent(intent);
  switch (intent.type) {
    case "unknown":
      return { ok: false, message: "Try “wet diaper”, “start left”, or “formula 90”." };
    case "diaper": {
      const event = await logDiaper(intent.kind, when(intent.minutesAgo));
      return { ok: true, message: `${label} saved`, eventId: event.id };
    }
    case "startSleep": {
      if (ctx.active?.type === "feed") return { ok: false, message: "End the feed first" };
      if (ctx.active?.type === "sleep") return { ok: false, message: "Already sleeping" };
      const event = await startSleep(when(intent.minutesAgo));
      return { ok: true, message: "Sleeping", eventId: event.id };
    }
    case "endSleep": {
      if (ctx.active?.type !== "sleep") return { ok: false, message: "No sleep timer" };
      await endTimedEvent(ctx.active.id);
      return { ok: true, message: "Saved" };
    }
    case "startFeed": {
      if (ctx.active) await endTimedEvent(ctx.active.id);
      const event = await startBreastFeed(intent.side, when(intent.minutesAgo));
      return { ok: true, message: "Feed started", eventId: event.id };
    }
    case "endFeed": {
      if (ctx.active?.type !== "feed") return { ok: false, message: "No feed timer" };
      await endTimedEvent(ctx.active.id);
      return { ok: true, message: "Saved" };
    }
    case "switchSide": {
      if (ctx.active?.type !== "feed") return { ok: false, message: "No feed timer" };
      await switchFeedSide(ctx.active.id);
      return { ok: true, message: "Switched side" };
    }
    case "repeatBottle": {
      const data = bottleFromLast(ctx.lastBottle);
      if (!data || data.method === "breast") return { ok: false, message: "No last bottle to repeat" };
      const event = await logBottleFeed({
        method: data.method,
        volumeMl: data.volumeMl,
        formulaMl: data.formulaMl,
        expressedMl: data.expressedMl,
        when: when(intent.minutesAgo),
      });
      return { ok: true, message: "Feed saved", eventId: event.id };
    }
    case "bottle": {
      const unit = intent.unit ?? ctx.settings.volumeUnit;
      const last = bottleFromLast(ctx.lastBottle);
      let ml: number;
      if (intent.displayAmount != null) ml = displayToMl(intent.displayAmount, unit);
      else if (last && bottleMl(last) > 0) ml = bottleMl(last);
      else ml = displayToMl(unit === "oz" ? 2 : 60, unit);
      if (ctx.active?.type === "feed" && intent.method === "mixed") {
        await addBottleToFeed(ctx.active.id, { formulaMl: ml, method: "mixed" });
        return { ok: true, message: "Feed saved" };
      }
      const event = await logBottleFeed({
        method: intent.method,
        volumeMl: ml,
        formulaMl: intent.method === "formula" || intent.method === "mixed" ? ml : undefined,
        expressedMl: intent.method === "expressed" ? ml : undefined,
        when: when(intent.minutesAgo),
      });
      return { ok: true, message: "Feed saved", eventId: event.id };
    }
    case "pump": {
      const unit = intent.unit ?? ctx.settings.volumeUnit;
      const left = displayToMl(intent.leftDisplay ?? 0, unit);
      const right = displayToMl(intent.rightDisplay ?? 0, unit);
      if (left <= 0 && right <= 0) return { ok: false, message: "Say how much, like “pump 40 left 50 right”." };
      const event = await logPump({ leftMl: left, rightMl: right, when: when(intent.minutesAgo) });
      return { ok: true, message: "Pump saved", eventId: event.id };
    }
    case "vitamin": {
      const event = await logVitamin(intent.which);
      return { ok: true, message: `${label} saved`, eventId: event.id };
    }
    case "temp": {
      const event = await logTemperature(displayToCelsius(intent.value, intent.unit), when(intent.minutesAgo));
      return { ok: true, message: "Temperature saved", eventId: event.id };
    }
    case "weight": {
      const event = await logWeight(displayToGrams(intent.value, intent.unit), when(intent.minutesAgo));
      return { ok: true, message: "Weight saved", eventId: event.id };
    }
    case "note": {
      const text = intent.text.trim();
      if (!text) return { ok: false, message: "Empty note" };
      const event = await logNote(text, when(intent.minutesAgo));
      return { ok: true, message: "Note saved", eventId: event.id };
    }
    default: {
      const _exhaustive: never = intent;
      return _exhaustive;
    }
  }
}
