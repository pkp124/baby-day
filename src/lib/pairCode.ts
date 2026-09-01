const WEAK = new Set(["000000", "111111", "123456", "654321", "999999", "012345"]);

export function generatePasskey() {
  for (let i = 0; i < 16; i++) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
    const code = n.toString().padStart(6, "0");
    if (!WEAK.has(code)) return code;
  }
  return "482107";
}

export function normalizePasskey(raw: string) {
  return raw.replace(/\D/g, "").slice(0, 6);
}

export function isValidPasskey(code: string) {
  return /^\d{6}$/.test(code);
}

export function formatPasskey(code: string) {
  const digits = normalizePasskey(code);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

export function topicForPasskey(code: string) {
  return `bdpair${normalizePasskey(code)}`;
}

export function topicForCribPasskey(code: string) {
  return `bdcrib${normalizePasskey(code)}`;
}
