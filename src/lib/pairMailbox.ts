import { topicForPasskey } from "./pairCode";

export type PairKind = "hello" | "offer" | "answer";

export type PairWire = {
  v: 1;
  from: string;
  k: PairKind;
  signal?: string;
  name?: string;
};

export type PairMailbox = {
  from: string;
  publish: (msg: Omit<PairWire, "v" | "from">) => Promise<void>;
  close: () => void;
};

export function mailboxBaseUrl() {
  const raw = import.meta.env.VITE_PAIR_MAILBOX_URL || "https://ntfy.sh";
  return raw.replace(/\/$/, "");
}

export function serializePairMessage(msg: PairWire) {
  return JSON.stringify(msg);
}

export function parsePairMessage(raw: string): PairWire | null {
  try {
    const msg = JSON.parse(raw) as PairWire;
    if (msg?.v !== 1) return null;
    if (msg.k !== "hello" && msg.k !== "offer" && msg.k !== "answer") return null;
    if (typeof msg.from !== "string" || !msg.from) return null;
    if ((msg.k === "offer" || msg.k === "answer") && typeof msg.signal !== "string") return null;
    return msg;
  } catch {
    return null;
  }
}

export function parseMailboxSseData(raw: string): PairWire | null {
  try {
    const wrapper = JSON.parse(raw) as { event?: string; message?: string };
    if (wrapper.event && wrapper.event !== "message") return null;
    if (typeof wrapper.message !== "string") return null;
    return parsePairMessage(wrapper.message);
  } catch {
    return null;
  }
}

function randomFrom() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function waitOpen(es: EventSource, timeoutMs = 8000) {
  if (es.readyState === EventSource.OPEN) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      es.close();
      reject(new Error("Could not start a passkey. Check the internet, or use a QR code."));
    }, timeoutMs);
    const done = () => {
      window.clearTimeout(timer);
      resolve();
    };
    es.addEventListener("open", done, { once: true });
    es.addEventListener(
      "error",
      () => {
        if (es.readyState === EventSource.CLOSED) {
          window.clearTimeout(timer);
          reject(new Error("Could not start a passkey. Check the internet, or use a QR code."));
        }
      },
      { once: true },
    );
  });
}

export async function openPairMailbox(
  passkey: string,
  onMessage: (msg: PairWire) => void,
  onError: (err: Error) => void,
): Promise<PairMailbox> {
  const from = randomFrom();
  const base = mailboxBaseUrl();
  const topic = topicForPasskey(passkey);
  const es = new EventSource(`${base}/${topic}/sse`);
  let closed = false;

  es.onmessage = (ev) => {
    const msg = parseMailboxSseData(String(ev.data));
    if (!msg || msg.from === from) return;
    onMessage(msg);
  };
  es.onerror = () => {
    if (closed || es.readyState !== EventSource.CLOSED) return;
    onError(new Error("Lost the passkey service. Try again, or use a QR code."));
  };

  await waitOpen(es);

  return {
    from,
    async publish(partial) {
      if (closed) return;
      const body = serializePairMessage({ v: 1, from, ...partial });
      const res = await fetch(`${base}/${topic}`, {
        method: "POST",
        headers: { "Content-Type": "text/plain", TTL: "180" },
        body,
      });
      if (!res.ok) throw new Error("Could not send the passkey handshake");
    },
    close() {
      closed = true;
      es.close();
    },
  };
}
