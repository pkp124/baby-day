import { describe, expect, it } from "vitest";
import { hashFromPage, pageFromHash, pageSectionFromHash } from "./pages";

describe("app pages", () => {
  it("maps hashes including camera and docs", () => {
    expect(pageFromHash("")).toBe("home");
    expect(pageFromHash("#/settings")).toBe("settings");
    expect(pageFromHash("#/camera")).toBe("camera");
    expect(pageFromHash("#/crib")).toBe("crib");
    expect(pageFromHash("#/watch")).toBe("watch");
    expect(pageFromHash("#/guide")).toBe("guide");
    expect(pageFromHash("#/guide/sync")).toBe("guide");
    expect(pageFromHash("#/tech/lan")).toBe("tech");
    expect(pageFromHash("#/unknown")).toBe("home");
  });

  it("reads the in-page section from a docs hash", () => {
    expect(pageSectionFromHash("#/guide")).toBe("");
    expect(pageSectionFromHash("#/guide/camera")).toBe("camera");
    expect(pageSectionFromHash("#/tech/data")).toBe("data");
  });

  it("round-trips page hashes", () => {
    expect(hashFromPage("home")).toBe("");
    expect(hashFromPage("camera")).toBe("#/camera");
    expect(hashFromPage("guide", "sync")).toBe("#/guide/sync");
    expect(hashFromPage("tech")).toBe("#/tech");
  });
});
