import { describe, expect, it } from "vitest";
import { formatPasskey, generatePasskey, isValidPasskey, normalizePasskey, topicForPasskey } from "./pairCode";

describe("passkeys", () => {
  it("normalizes spaces, dashes, and extra characters", () => {
    expect(normalizePasskey("482 107")).toBe("482107");
    expect(normalizePasskey("482-107")).toBe("482107");
    expect(normalizePasskey("code: 482107!")).toBe("482107");
    expect(normalizePasskey("123456789")).toBe("123456");
  });

  it("accepts only six digits", () => {
    expect(isValidPasskey("482107")).toBe(true);
    expect(isValidPasskey("482 107")).toBe(false);
    expect(isValidPasskey("48210")).toBe(false);
    expect(isValidPasskey("48210a")).toBe(false);
  });

  it("formats a passkey in two groups of three", () => {
    expect(formatPasskey("482107")).toBe("482 107");
    expect(formatPasskey("482 107")).toBe("482 107");
  });

  it("maps a passkey to a mailbox topic", () => {
    expect(topicForPasskey("482 107")).toBe("bdpair482107");
  });

  it("generates six-digit codes that are not trivially weak", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const code = generatePasskey();
      expect(isValidPasskey(code)).toBe(true);
      expect(["000000", "111111", "123456", "654321", "999999", "012345"]).not.toContain(code);
      seen.add(code);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});
