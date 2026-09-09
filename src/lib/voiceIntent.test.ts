import { describe, expect, it } from "vitest";
import { describeVoiceIntent, parseVoiceLog } from "./voiceIntent";

describe("parseVoiceLog", () => {
  it("logs diapers from casual speech", () => {
    expect(parseVoiceLog("wet diaper")).toEqual({ type: "diaper", kind: "wet" });
    expect(parseVoiceLog("dirty nappy")).toEqual({ type: "diaper", kind: "dirty" });
    expect(parseVoiceLog("poop")).toEqual({ type: "diaper", kind: "dirty" });
    expect(parseVoiceLog("wet and dirty")).toEqual({ type: "diaper", kind: "both" });
    expect(parseVoiceLog("pee ten minutes ago")).toEqual({ type: "diaper", kind: "wet", minutesAgo: 10 });
  });

  it("starts and ends sleep and feeds", () => {
    expect(parseVoiceLog("sleep")).toEqual({ type: "startSleep" });
    expect(parseVoiceLog("baby is sleeping")).toEqual({ type: "startSleep" });
    expect(parseVoiceLog("woke up")).toEqual({ type: "endSleep" });
    expect(parseVoiceLog("start left")).toEqual({ type: "startFeed", side: "left" });
    expect(parseVoiceLog("right breast")).toEqual({ type: "startFeed", side: "right" });
    expect(parseVoiceLog("start feeding", "right")).toEqual({ type: "startFeed", side: "right" });
    expect(parseVoiceLog("end feed")).toEqual({ type: "endFeed" });
    expect(parseVoiceLog("switch sides")).toEqual({ type: "switchSide" });
  });

  it("parses bottles, pumps, vitamins, and last bottle", () => {
    expect(parseVoiceLog("formula 90")).toMatchObject({ type: "bottle", method: "formula", displayAmount: 90 });
    expect(parseVoiceLog("ninety ml formula")).toMatchObject({ type: "bottle", method: "formula", displayAmount: 90, unit: "ml" });
    expect(parseVoiceLog("expressed 3 oz")).toMatchObject({ type: "bottle", method: "expressed", displayAmount: 3, unit: "oz" });
    expect(parseVoiceLog("same as last")).toEqual({ type: "repeatBottle" });
    expect(parseVoiceLog("pump 40 left 50 right")).toMatchObject({ type: "pump", leftDisplay: 40, rightDisplay: 50 });
    expect(parseVoiceLog("vitamin d")).toEqual({ type: "vitamin", which: "vitaminD" });
    expect(parseVoiceLog("vit k")).toEqual({ type: "vitamin", which: "vitaminK" });
  });

  it("parses temp, weight, notes, and spoken numbers", () => {
    expect(parseVoiceLog("temp 38")).toMatchObject({ type: "temp", value: 38, unit: "C" });
    expect(parseVoiceLog("100.4 fahrenheit")).toMatchObject({ type: "temp", value: 100.4, unit: "F" });
    expect(parseVoiceLog("weight 4.2 kg")).toMatchObject({ type: "weight", value: 4.2, unit: "kg" });
    expect(parseVoiceLog("note cluster feeding")).toMatchObject({ type: "note", text: "cluster feeding" });
    expect(parseVoiceLog("he spit up a lot")).toMatchObject({ type: "note" });
    expect(parseVoiceLog("asdf")).toMatchObject({ type: "unknown" });
    expect(parseVoiceLog("wet diaper twenty minutes ago")).toMatchObject({ type: "diaper", kind: "wet", minutesAgo: 20 });
  });

  it("describes intents for the toast", () => {
    expect(describeVoiceIntent({ type: "diaper", kind: "both" })).toBe("Wet + dirty");
    expect(describeVoiceIntent({ type: "startFeed", side: "left" })).toBe("Start left");
    expect(describeVoiceIntent({ type: "bottle", method: "formula", displayAmount: 90, unit: "ml" })).toBe("90 ml formula");
  });
});
