function b64url(bytes: Uint8Array) {
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function unb64url(text: string) {
  const pad = text + "===".slice((text.length + 3) % 4);
  const bin = atob(pad.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function isBd1(text: string) {
  return text.trimStart().startsWith("BD1.");
}

export async function gzipToBd1(text: string) {
  const json = new TextEncoder().encode(text);
  const gzip = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
  const buf = new Uint8Array(await new Response(gzip).arrayBuffer());
  return `BD1.${b64url(buf)}`;
}

export async function gunzipBd1(text: string) {
  const raw = text.trim();
  const body = raw.startsWith("BD1.") ? raw.slice(4) : raw;
  const bytes = unb64url(body);
  const unzip = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(unzip).text();
}
