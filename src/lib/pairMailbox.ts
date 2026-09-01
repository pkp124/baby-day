import { gunzipBd1, gzipToBd1, isBd1 } from "./gzip";
import { topicForPasskey } from "./pairCode";

export type PairKind = "hello" | "offer" | "answer" | "bye";

export type PairWire = {
  v: 1;
  from: string;
  k: PairKind;
  to?: string;
  signal?: string;
  name?: string;
};

export type PairMailbox = {
  from: string;
  publish: (msg: Omit<PairWire, "v" | "from">) => Promise<void>;
  close: () => void;
};

/** ntfy.sh stores larger bodies as attachments and leaves `message` empty. */
export const NTFY_MAX_MESSAGE_BYTES = 4096;

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
    if (msg.k !== "hello" && msg.k !== "offer" && msg.k !== "answer" && msg.k !== "bye") return null;
    if (typeof msg.from !== "string" || !msg.from) return null;
    if (msg.to !== undefined && (typeof msg.to !== "string" || !msg.to)) return null;
    if ((msg.k === "offer" || msg.k === "answer") && typeof msg.signal !== "string") return null;
    return msg;
  } catch {
    return null;
  }
}

type NtfySse = {
  event?: string;
  message?: string;
  attachment?: { url?: string };
};

function mailboxOrigin() {
  try {
    return new URL(mailboxBaseUrl()).origin;
  } catch {
    return "";
  }
}

function isMailboxAttachmentUrl(url: string) {
  try {
    return new URL(url).origin === mailboxOrigin();
  } catch {
    return false;
  }
}

async function mailboxPayloadText(wrapper: NtfySse): Promise<string | null> {
  const url = wrapper.attachment?.url;
  if (typeof url === "string" && isMailboxAttachmentUrl(url)) {
    const res = await fetch(url);
    if (res.ok) return await res.text();
  }
  if (typeof wrapper.message !== "string") return null;
  return wrapper.message;
}

export async function parseMailboxSseData(raw: string): Promise<PairWire | null> {
  try {
    const wrapper = JSON.parse(raw) as NtfySse;
    if (wrapper.event && wrapper.event !== "message") return null;
    const payload = await mailboxPayloadText(wrapper);
    if (payload == null) return null;
    const text = payload.trim();
    if (!text) return null;
    const json = isBd1(text) ? await gunzipBd1(text) : text;
    return parsePairMessage(json);
  } catch {
    return null;
  }
}

export async function encodeMailboxBody(msg: PairWire) {
  const json = serializePairMessage(msg);
  if (json.length < NTFY_MAX_MESSAGE_BYTES) return json;
  return gzipToBd1(json);
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
  opts?: { topic?: string; reconnect?: boolean },
): Promise<PairMailbox> {
  const from = randomFrom();
  const base = mailboxBaseUrl();
  const topic = opts?.topic ?? topicForPasskey(passkey);
  let es = new EventSource(`${base}/${topic}/sse`);
  let closed = false;

  const bind = (source: EventSource) => {
    source.onmessage = (ev) => {
      void parseMailboxSseData(String(ev.data)).then((msg) => {
        if (closed || !msg || msg.from === from) return;
        onMessage(msg);
      });
    };
    source.onerror = () => {
      if (closed || source.readyState !== EventSource.CLOSED) return;
      if (opts?.reconnect) {
        source.close();
        es = new EventSource(`${base}/${topic}/sse`);
        bind(es);
        return;
      }
      onError(new Error("Lost the passkey service. Try again, or use a QR code."));
    };
  };

  bind(es);
  await waitOpen(es);

  return {
    from,
    async publish(partial) {
      if (closed) return;
      const body = await encodeMailboxBody({ v: 1, from, ...partial });
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
