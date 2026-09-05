import { describe, expect, it } from "vitest";
import { applyMicEnabled, cameraShouldRun, cribMediaConstraints } from "./lanMedia";
import { hashFromPage, pageFromHash } from "./pages";
import { topicForCribPasskey } from "./pairCode";
import { parsePairMessage, serializePairMessage, type PairWire } from "./pairMailbox";

describe("on-demand crib camera", () => {
  it("keeps the camera off until someone is watching", () => {
    expect(cameraShouldRun(0)).toBe(false);
    expect(cameraShouldRun(1)).toBe(true);
    expect(cameraShouldRun(2)).toBe(true);
  });

  it("opens the crib camera with a microphone track", () => {
    expect(cribMediaConstraints("environment", true).audio).toEqual({
      echoCancellation: true,
      noiseSuppression: true,
    });
    expect(cribMediaConstraints("environment", false).audio).toBe(false);
  });

  it("mutes crib audio by disabling the track instead of dropping it", () => {
    const track = { enabled: true };
    applyMicEnabled({ getAudioTracks: () => [track] }, false);
    expect(track.enabled).toBe(false);
    applyMicEnabled({ getAudioTracks: () => [track] }, true);
    expect(track.enabled).toBe(true);
  });

  it("uses a crib mailbox topic that does not collide with event pairing", () => {
    expect(topicForCribPasskey("482 107")).toBe("bdcrib482107");
  });
});

describe("crib room signaling", () => {
  it("round-trips a targeted offer, answer, and bye", () => {
    const hello: PairWire = { v: 1, from: "aa", k: "hello", name: "Ada" };
    const offer: PairWire = { v: 1, from: "crib", to: "aa", k: "offer", signal: "v=0", name: "Crib" };
    const bye: PairWire = { v: 1, from: "aa", k: "bye" };
    expect(parsePairMessage(serializePairMessage(hello))).toEqual(hello);
    expect(parsePairMessage(serializePairMessage(offer))).toEqual(offer);
    expect(parsePairMessage(serializePairMessage(bye))).toEqual(bye);
  });
});

describe("crib/watch hashes", () => {
  it("round-trips the app pages used for video", () => {
    expect(pageFromHash("#/crib")).toBe("crib");
    expect(pageFromHash("#/watch")).toBe("watch");
    expect(pageFromHash("#/camera")).toBe("camera");
    expect(pageFromHash("#/settings")).toBe("settings");
    expect(pageFromHash("")).toBe("home");
    expect(hashFromPage("crib")).toBe("#/crib");
    expect(hashFromPage("watch")).toBe("#/watch");
    expect(hashFromPage("camera")).toBe("#/camera");
    expect(hashFromPage("home")).toBe("");
  });
});
