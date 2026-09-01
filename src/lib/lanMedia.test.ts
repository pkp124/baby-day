import { describe, expect, it } from "vitest";
import { parseMediaWire } from "./lanMedia";
import { hashFromPage, pageFromHash } from "./pages";

describe("media wire", () => {
  it("accepts crib and watch ready messages", () => {
    expect(parseMediaWire({ kind: "media-ready", role: "crib" })).toEqual({
      kind: "media-ready",
      role: "crib",
    });
    expect(parseMediaWire({ kind: "media-ready", role: "watch" })).toEqual({
      kind: "media-ready",
      role: "watch",
    });
  });

  it("accepts offer, answer, and bye", () => {
    expect(parseMediaWire({ kind: "media-offer", sdp: "v=0" })).toEqual({ kind: "media-offer", sdp: "v=0" });
    expect(parseMediaWire({ kind: "media-answer", sdp: "v=0" })).toEqual({ kind: "media-answer", sdp: "v=0" });
    expect(parseMediaWire({ kind: "media-bye" })).toEqual({ kind: "media-bye" });
  });

  it("rejects event sync messages and incomplete media payloads", () => {
    expect(parseMediaWire({ kind: "hello", name: "Ada" })).toBeNull();
    expect(parseMediaWire({ kind: "event", event: { id: "1" } })).toBeNull();
    expect(parseMediaWire({ kind: "media-ready", role: "guest" })).toBeNull();
    expect(parseMediaWire({ kind: "media-offer", sdp: "" })).toBeNull();
    expect(parseMediaWire({ kind: "media-answer" })).toBeNull();
    expect(parseMediaWire(null)).toBeNull();
  });
});

describe("crib/watch hashes", () => {
  it("round-trips the app pages used for video", () => {
    expect(pageFromHash("#/crib")).toBe("crib");
    expect(pageFromHash("#/watch")).toBe("watch");
    expect(pageFromHash("#/settings")).toBe("settings");
    expect(pageFromHash("")).toBe("home");
    expect(hashFromPage("crib")).toBe("#/crib");
    expect(hashFromPage("watch")).toBe("#/watch");
    expect(hashFromPage("home")).toBe("");
  });
});
