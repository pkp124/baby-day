import { describe, expect, it } from "vitest";
import {
  formatRememberLeft,
  isLanPasskeyFresh,
  isLanRememberTtl,
  LAN_TTL_MS,
  rememberUntilIso,
} from "./lanRemember";

describe("remembered LAN passkeys", () => {
  it("accepts day and week as TTL values", () => {
    expect(isLanRememberTtl("day")).toBe(true);
    expect(isLanRememberTtl("week")).toBe(true);
    expect(isLanRememberTtl("month")).toBe(false);
  });

  it("keeps a passkey fresh until the chosen window ends", () => {
    const now = new Date("2026-09-02T08:00:00.000Z");
    const until = rememberUntilIso(now, "day");
    expect(Date.parse(until) - now.getTime()).toBe(LAN_TTL_MS.day);
    expect(
      isLanPasskeyFresh({ lanPasskey: "482107", lanPasskeyRememberUntil: until }, now),
    ).toBe(true);
    expect(
      isLanPasskeyFresh(
        { lanPasskey: "482107", lanPasskeyRememberUntil: until },
        new Date(now.getTime() + LAN_TTL_MS.day + 1),
      ),
    ).toBe(false);
  });

  it("rejects an incomplete or expired passkey", () => {
    const now = new Date("2026-09-02T08:00:00.000Z");
    expect(isLanPasskeyFresh({ lanPasskey: "48210", lanPasskeyRememberUntil: rememberUntilIso(now, "week") }, now)).toBe(
      false,
    );
    expect(isLanPasskeyFresh({ lanPasskey: "482107", lanPasskeyRememberUntil: "" }, now)).toBe(false);
  });

  it("describes remaining time in hours or days", () => {
    const now = new Date("2026-09-02T08:00:00.000Z");
    expect(formatRememberLeft(new Date(now.getTime() + 2 * 3_600_000).toISOString(), now)).toBe("2 hours left");
    expect(formatRememberLeft(new Date(now.getTime() + 3 * 86_400_000).toISOString(), now)).toBe("3 days left");
    expect(formatRememberLeft(new Date(now.getTime() - 1000).toISOString(), now)).toBe("expired");
  });
});
