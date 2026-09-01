import { afterEach, describe, expect, it, vi } from "vitest";
import { gunzipBd1, gzipToBd1 } from "./gzip";
import {
  encodeMailboxBody,
  NTFY_MAX_MESSAGE_BYTES,
  parseMailboxSseData,
  parsePairMessage,
  serializePairMessage,
  type PairWire,
} from "./pairMailbox";

function bulkyOffer(signal: string): PairWire {
  return { v: 1, from: "crib", to: "watch", k: "offer", signal, name: "Crib" };
}

function bulkySdp() {
  const lines = ["v=0", "o=- 0 0 IN IP4 127.0.0.1", "s=-", "t=0 0", "m=video 9 UDP/TLS/RTP/SAVPF 96"];
  for (let i = 0; i < 80; i++) {
    lines.push(
      `a=candidate:${i} 1 udp 2122260223 192.168.1.${i % 250} ${10000 + i} typ host generation 0 ufrag abcdef network-id 1`,
    );
  }
  return lines.join("\r\n");
}

describe("passkey mailbox messages", () => {
  it("round-trips a hello, offer, and answer", () => {
    const hello: PairWire = { v: 1, from: "aa", k: "hello" };
    const offer: PairWire = { v: 1, from: "aa", k: "offer", signal: "BD1.abc", name: "Asha" };
    const answer: PairWire = { v: 1, from: "bb", k: "answer", signal: "BD1.def", name: "Ravi" };
    const bye: PairWire = { v: 1, from: "bb", k: "bye" };
    expect(parsePairMessage(serializePairMessage(hello))).toEqual(hello);
    expect(parsePairMessage(serializePairMessage(offer))).toEqual(offer);
    expect(parsePairMessage(serializePairMessage(answer))).toEqual(answer);
    expect(parsePairMessage(serializePairMessage(bye))).toEqual(bye);
  });

  it("rejects malformed payloads", () => {
    expect(parsePairMessage("not-json")).toBeNull();
    expect(parsePairMessage(JSON.stringify({ v: 2, from: "aa", k: "hello" }))).toBeNull();
    expect(parsePairMessage(JSON.stringify({ v: 1, from: "aa", k: "nope" }))).toBeNull();
    expect(parsePairMessage(JSON.stringify({ v: 1, from: "", k: "hello" }))).toBeNull();
    expect(parsePairMessage(JSON.stringify({ v: 1, from: "aa", k: "offer" }))).toBeNull();
  });

  it("reads a message out of an ntfy SSE wrapper", async () => {
    const inner = serializePairMessage({ v: 1, from: "aa", k: "hello" });
    expect(await parseMailboxSseData(JSON.stringify({ event: "message", message: inner }))).toEqual({
      v: 1,
      from: "aa",
      k: "hello",
    });
    expect(await parseMailboxSseData(JSON.stringify({ event: "open", message: inner }))).toBeNull();
    expect(await parseMailboxSseData(JSON.stringify({ event: "keepalive" }))).toBeNull();
  });
});

describe("mailbox bodies larger than ntfy inline limit", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("compresses a video offer so it fits in one ntfy message", async () => {
    const offer = bulkyOffer(bulkySdp());
    expect(serializePairMessage(offer).length).toBeGreaterThan(NTFY_MAX_MESSAGE_BYTES);
    const body = await encodeMailboxBody(offer);
    expect(body.startsWith("BD1.")).toBe(true);
    expect(body.length).toBeLessThan(NTFY_MAX_MESSAGE_BYTES);
    expect(await parseMailboxSseData(JSON.stringify({ event: "message", message: body }))).toEqual(offer);
  });

  it("reads an ntfy attachment when the body overflowed 4KB", async () => {
    const offer = bulkyOffer("v=0");
    const inner = serializePairMessage(offer);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(inner, { status: 200 })),
    );
    const parsed = await parseMailboxSseData(
      JSON.stringify({
        event: "message",
        message: "",
        attachment: { url: "https://ntfy.sh/file/overflow" },
      }),
    );
    expect(parsed).toEqual(offer);
  });

  it("ignores attachment URLs that are not on the mailbox host", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(serializePairMessage({ v: 1, from: "x", k: "hello" }), { status: 200 })),
    );
    const parsed = await parseMailboxSseData(
      JSON.stringify({
        event: "message",
        message: serializePairMessage({ v: 1, from: "aa", k: "hello" }),
        attachment: { url: "https://evil.example/file" },
      }),
    );
    expect(parsed).toEqual({ v: 1, from: "aa", k: "hello" });
  });
});

describe("gzip codec", () => {
  it("round-trips utf-8 text", async () => {
    const text = JSON.stringify({ hello: "crib", n: 1 });
    const packed = await gzipToBd1(text);
    expect(packed).toMatch(/^BD1\./);
    expect(await gunzipBd1(packed)).toBe(text);
  });
});
