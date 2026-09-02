import { getSettings, saveSettings } from "./db";
import { isValidPasskey, normalizePasskey } from "./pairCode";
import type { LanPasskeyRole, LanRememberTtl, Settings } from "./types";

export const LAN_TTL_MS: Record<LanRememberTtl, number> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
};

export function isLanRememberTtl(value: string): value is LanRememberTtl {
  return value === "day" || value === "week";
}

export function rememberUntilIso(from: Date, ttl: LanRememberTtl): string {
  return new Date(from.getTime() + LAN_TTL_MS[ttl]).toISOString();
}

export function lanPasskeyFromSettings(settings: Pick<Settings, "lanPasskey">): string {
  return normalizePasskey(settings.lanPasskey);
}

export function isLanPasskeyFresh(
  settings: Pick<Settings, "lanPasskey" | "lanPasskeyRememberUntil">,
  now = new Date(),
): boolean {
  const code = lanPasskeyFromSettings(settings);
  if (!isValidPasskey(code)) return false;
  const until = Date.parse(settings.lanPasskeyRememberUntil);
  return Number.isFinite(until) && until > now.getTime();
}

export function formatRememberLeft(untilIso: string, now = new Date()): string {
  const until = Date.parse(untilIso);
  if (!Number.isFinite(until)) return "";
  const ms = until - now.getTime();
  if (ms <= 0) return "expired";
  const hours = Math.round(ms / 3_600_000);
  if (hours < 36) return hours <= 1 ? "about 1 hour left" : `${hours} hours left`;
  const days = Math.round(ms / 86_400_000);
  return days === 1 ? "1 day left" : `${days} days left`;
}

export async function persistRememberedLan(passkey: string, role: Exclude<LanPasskeyRole, "">) {
  const code = normalizePasskey(passkey);
  if (!isValidPasskey(code)) return;
  const settings = await getSettings();
  const ttl: LanRememberTtl = settings.lanPasskeyTtl === "day" ? "day" : "week";
  await saveSettings({
    lanPasskey: code,
    lanPasskeyRole: role,
    lanPasskeyTtl: ttl,
    lanPasskeyRememberUntil: rememberUntilIso(new Date(), ttl),
  });
}

export async function forgetRememberedLan() {
  await saveSettings({
    lanPasskey: "",
    lanPasskeyRole: "",
    lanPasskeyRememberUntil: "",
  });
}

export async function setLanRememberTtl(ttl: LanRememberTtl) {
  const settings = await getSettings();
  const patch: Partial<Settings> = { lanPasskeyTtl: ttl };
  if (isValidPasskey(lanPasskeyFromSettings(settings))) {
    patch.lanPasskeyRememberUntil = rememberUntilIso(new Date(), ttl);
  }
  await saveSettings(patch);
}

export async function setLanRememberRole(role: Exclude<LanPasskeyRole, "">) {
  await saveSettings({ lanPasskeyRole: role });
}
