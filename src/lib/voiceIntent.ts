import type { BreastSide, DiaperKind, FeedMethod, TempUnit, VolumeUnit, WeightUnit } from "./types";

export type VoiceIntent =
  | { type: "diaper"; kind: DiaperKind; minutesAgo?: number }
  | { type: "startSleep"; minutesAgo?: number }
  | { type: "endSleep" }
  | { type: "startFeed"; side: BreastSide; minutesAgo?: number }
  | { type: "endFeed" }
  | { type: "switchSide" }
  | { type: "repeatBottle"; minutesAgo?: number }
  | {
      type: "bottle";
      method: Extract<FeedMethod, "formula" | "expressed" | "mixed">;
      displayAmount?: number;
      unit?: VolumeUnit;
      minutesAgo?: number;
    }
  | { type: "pump"; leftDisplay?: number; rightDisplay?: number; unit?: VolumeUnit; minutesAgo?: number }
  | { type: "vitamin"; which: "vitaminD" | "vitaminK" }
  | { type: "temp"; value: number; unit: TempUnit; minutesAgo?: number }
  | { type: "weight"; value: number; unit: WeightUnit; minutesAgo?: number }
  | { type: "note"; text: string; minutesAgo?: number }
  | { type: "unknown"; text: string };

const ONES: Record<string, number> = {
  zero: 0,
  oh: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

export function normalizeVoiceText(raw: string) {
  let text = raw.toLowerCase().replace(/['’]/g, "");
  text = text.replace(/(\d)\s*\.\s*(\d)/g, "$1.$2");
  for (const [tens, tv] of Object.entries(TENS)) {
    for (const [one, ov] of Object.entries(ONES)) {
      if (ov === 0 || ov >= 10) continue;
      text = text.replace(new RegExp(`\\b${tens}[\\s-]+${one}\\b`, "g"), String(tv + ov));
    }
    text = text.replace(new RegExp(`\\b${tens}\\b`, "g"), String(tv));
  }
  for (const [one, ov] of Object.entries(ONES)) {
    text = text.replace(new RegExp(`\\b${one}\\b`, "g"), String(ov));
  }
  text = text.replace(/half an hour/g, "30 minutes");
  text = text.replace(/\ban hour\b/g, "60 minutes");
  return text.replace(/[^a-z0-9.+°\s]/g, " ").replace(/\s+/g, " ").trim();
}

function takeMinutesAgo(text: string): { text: string; minutesAgo?: number } {
  const hour = text.match(/\b(\d+)\s*(hours?|hrs?)\s+ago\b/);
  if (hour) {
    return { text: text.replace(hour[0], " ").replace(/\s+/g, " ").trim(), minutesAgo: Number(hour[1]) * 60 };
  }
  const min = text.match(/\b(\d+)\s*(minutes?|mins?|m)\s+ago\b/);
  if (min) {
    return { text: text.replace(min[0], " ").replace(/\s+/g, " ").trim(), minutesAgo: Number(min[1]) };
  }
  if (/\b(just now|right now)\b/.test(text)) {
    return { text: text.replace(/\b(just now|right now)\b/g, " ").replace(/\s+/g, " ").trim() };
  }
  return { text };
}

function firstNumber(text: string) {
  const match = text.match(/\b(\d+(?:\.\d+)?)\b/);
  return match ? Number(match[1]) : undefined;
}

function volumeUnitIn(text: string): VolumeUnit | undefined {
  if (/\b(ounces?|oz)\b/.test(text)) return "oz";
  if (/\b(millilitres?|milliliters?|mls?)\b/.test(text)) return "ml";
  return undefined;
}

export function parseVoiceLog(raw: string, nextSide: BreastSide = "left"): VoiceIntent {
  const stripped = takeMinutesAgo(normalizeVoiceText(raw));
  const text = stripped.text;
  const minutesAgo = stripped.minutesAgo;
  if (!text) return { type: "unknown", text: raw.trim() };

  if (/\b(same as last|last bottle|same bottle|repeat bottle)\b/.test(text)) {
    return { type: "repeatBottle", minutesAgo };
  }

  if (/\b(vitamin k|vit k)\b/.test(text)) return { type: "vitamin", which: "vitaminK" };
  if (/\b(vitamin d|vit d|d drops)\b/.test(text)) return { type: "vitamin", which: "vitaminD" };

  if (/\b(woke|wake(?:ned)? up|end sleep|stop sleep|finished sleep|baby(?: is)? up)\b/.test(text)) {
    return { type: "endSleep" };
  }
  if (/\b(end feed|stop feed|finished feed|done feeding|end nursing)\b/.test(text)) {
    return { type: "endFeed" };
  }
  if (/\b(switch(?:ed)?(?: sides?)?|other (?:side|breast)|swap(?:ped)?(?: sides?)?)\b/.test(text)) {
    return { type: "switchSide" };
  }

  if (/\b(start(?:ed)? sleep|put down|fell asleep|going to sleep|asleep|sleeping|start(?:ed)? nap)\b/.test(text) || /^\b(sleep|nap)\b$/.test(text)) {
    return { type: "startSleep", minutesAgo };
  }

  const left = /\b(start(?:ed)? )?(left(?: side)?|left breast)\b/.test(text);
  const right = /\b(start(?:ed)? )?(right(?: side)?|right breast)\b/.test(text);
  if ((left || right) && !/\bpump/.test(text) && !/\bbottle|formula|expressed|ml|oz\b/.test(text)) {
    return { type: "startFeed", side: left && !right ? "left" : right && !left ? "right" : nextSide, minutesAgo };
  }
  if (/\b(start(?:ed)? (?:feed|feeding|nursing|breastfeed))\b/.test(text)) {
    return { type: "startFeed", side: nextSide, minutesAgo };
  }

  if (/\b(diaper|nappy|pee|poo|poop|wet|dirty|soiled|both)\b/.test(text)) {
    const both = /\b(both|wet and dirty|dirty and wet|pee and poo|poo and pee)\b/.test(text);
    const dirty = /\b(dirty|poo|poop|soiled|bowel)\b/.test(text);
    const wet = /\b(wet|pee|urine|wees?)\b/.test(text);
    const kind: DiaperKind = both || (wet && dirty) ? "both" : dirty && !wet ? "dirty" : "wet";
    return { type: "diaper", kind, minutesAgo };
  }

  if (/\bpump/.test(text)) {
    const unit = volumeUnitIn(text);
    const leftMatch = text.match(/(\d+(?:\.\d+)?)(?:\s*(?:ml|oz))?[^0-9]{0,12}left/);
    const rightMatch = text.match(/(\d+(?:\.\d+)?)(?:\s*(?:ml|oz))?[^0-9]{0,12}right/);
    const leftAlt = text.match(/left[^0-9]{0,12}(\d+(?:\.\d+)?)/);
    const rightAlt = text.match(/right[^0-9]{0,12}(\d+(?:\.\d+)?)/);
    const leftDisplay = leftMatch ? Number(leftMatch[1]) : leftAlt ? Number(leftAlt[1]) : undefined;
    const rightDisplay = rightMatch ? Number(rightMatch[1]) : rightAlt ? Number(rightAlt[1]) : undefined;
    if (leftDisplay == null && rightDisplay == null) {
      const n = firstNumber(text);
      if (n != null) return { type: "pump", leftDisplay: n, rightDisplay: 0, unit, minutesAgo };
    }
    return { type: "pump", leftDisplay, rightDisplay, unit, minutesAgo };
  }

  if (/\b(formula|bottle|expressed|breast milk|top[- ]?up|mixed)\b/.test(text)) {
    const unit = volumeUnitIn(text);
    const amount = firstNumber(text);
    const method: Extract<FeedMethod, "formula" | "expressed" | "mixed"> = /\bmixed\b|\btop[- ]?up\b/.test(text)
      ? "mixed"
      : /\bexpressed\b|\bbreast milk\b/.test(text)
        ? "expressed"
        : "formula";
    return { type: "bottle", method, displayAmount: amount, unit, minutesAgo };
  }

  if (/\b(temp|temperature|fever|degrees?|celsius|fahrenheit|°)\b/.test(text)) {
    const n = firstNumber(text);
    if (n != null) {
      const unit: TempUnit = /\b(f|fahrenheit)\b/.test(text) || n > 45 ? "F" : "C";
      return { type: "temp", value: n, unit, minutesAgo };
    }
  }

  if (/\b(weight|weighs|kg|kilos?|pounds?|lbs?)\b/.test(text)) {
    const n = firstNumber(text);
    if (n != null) {
      const unit: WeightUnit = /\b(pounds?|lbs?)\b/.test(text) ? "lb" : /\b(kg|kilos?)\b/.test(text) ? "kg" : n > 20 ? "lb" : "kg";
      return { type: "weight", value: n, unit, minutesAgo };
    }
  }

  if (/^note\b/.test(text)) {
    return { type: "note", text: text.replace(/^note\b/, "").trim() || raw.trim(), minutesAgo };
  }

  if (text.split(" ").length >= 3) return { type: "note", text: raw.trim(), minutesAgo };
  return { type: "unknown", text: raw.trim() };
}

export function describeVoiceIntent(intent: VoiceIntent) {
  switch (intent.type) {
    case "diaper":
      return intent.kind === "both" ? "Wet + dirty" : intent.kind === "dirty" ? "Dirty diaper" : "Wet diaper";
    case "startSleep":
      return "Start sleep";
    case "endSleep":
      return "End sleep";
    case "startFeed":
      return `Start ${intent.side}`;
    case "endFeed":
      return "End feed";
    case "switchSide":
      return "Switch side";
    case "repeatBottle":
      return "Same as last bottle";
    case "bottle": {
      const amount = intent.displayAmount != null ? `${intent.displayAmount} ${intent.unit ?? "ml"} ` : "";
      return `${amount}${intent.method === "expressed" ? "expressed milk" : intent.method === "mixed" ? "mixed bottle" : "formula"}`.trim();
    }
    case "pump":
      return "Pump";
    case "vitamin":
      return intent.which === "vitaminD" ? "Vitamin D" : "Vitamin K";
    case "temp":
      return `Temperature ${intent.value}°${intent.unit}`;
    case "weight":
      return `Weight ${intent.value} ${intent.unit}`;
    case "note":
      return "Note";
    case "unknown":
      return "Not sure";
    default: {
      const _exhaustive: never = intent;
      return _exhaustive;
    }
  }
}

export const VOICE_EXAMPLES = ["wet diaper", "start left", "formula 90", "sleep", "end sleep", "same as last"] as const;
