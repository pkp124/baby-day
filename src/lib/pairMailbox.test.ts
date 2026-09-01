import { describe, expect, it } from "vitest";
import { parseMailboxSseData, parsePairMessage, serializePairMessage, type PairWire } from "./pairMailbox";

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

  it("reads a message out of an ntfy SSE wrapper", () => {
    const inner = serializePairMessage({ v: 1, from: "aa", k: "hello" });
    expect(parseMailboxSseData(JSON.stringify({ event: "message", message: inner }))).toEqual({
      v: 1,
      from: "aa",
      k: "hello",
    });
    expect(parseMailboxSseData(JSON.stringify({ event: "open", message: inner }))).toBeNull();
    expect(parseMailboxSseData(JSON.stringify({ event: "keepalive" }))).toBeNull();
  });
});
