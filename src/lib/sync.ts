import type { CareEvent } from "./types";
import { db, getSettings, saveSettings } from "./db";
import { getSupabase, supabaseConfigured } from "./supabase";

export type SyncState = {
  configured: boolean;
  signedIn: boolean;
  email: string | null;
  lastError: string | null;
  lastSyncedAt: string | null;
  pending: number;
  status: "off" | "local" | "idle" | "syncing" | "error" | "needs-login";
};

function rowFromEvent(event: CareEvent) {
  return {
    id: event.id,
    family_id: event.familyId,
    baby_id: event.babyId,
    member_id: event.memberId,
    member_name: event.memberName,
    type: event.type,
    time: event.time,
    ended_at: event.endedAt,
    created_at: event.createdAt,
    updated_at: event.updatedAt,
    rev: event.rev,
    deleted_at: event.deletedAt,
    data: event.data,
  };
}

function eventFromRow(row: Record<string, unknown>): CareEvent {
  return {
    id: String(row.id),
    familyId: String(row.family_id),
    babyId: String(row.baby_id),
    memberId: String(row.member_id),
    memberName: String(row.member_name ?? ""),
    type: row.type as CareEvent["type"],
    time: String(row.time),
    endedAt: (row.ended_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    rev: Number(row.rev ?? 1),
    deletedAt: (row.deleted_at as string | null) ?? null,
    data: (row.data as CareEvent["data"]) ?? {},
    syncStatus: "synced",
  };
}

export async function syncNow(): Promise<SyncState> {
  const pending = await db.outbox.count();
  if (!supabaseConfigured()) {
    return {
      configured: false,
      signedIn: false,
      email: null,
      lastError: null,
      lastSyncedAt: null,
      pending,
      status: "local",
    };
  }
  const supabase = getSupabase();
  if (!supabase) {
    return { configured: false, signedIn: false, email: null, lastError: null, lastSyncedAt: null, pending, status: "off" };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) {
    return {
      configured: true,
      signedIn: false,
      email: null,
      lastError: null,
      lastSyncedAt: null,
      pending,
      status: "needs-login",
    };
  }

  try {
    const mine = await supabase.rpc("my_family");
    if (mine.error) throw mine.error;
    const ids = mine.data as { family_id: string; baby_id: string; member_id: string } | null;
    if (!ids) {
      return {
        configured: true,
        signedIn: true,
        email: session.user.email ?? null,
        lastError: null,
        lastSyncedAt: null,
        pending,
        status: "idle",
      };
    }

    let settings = await getSettings();
    if (ids.family_id !== settings.familyId || ids.member_id !== settings.caregiverId || ids.baby_id !== settings.babyId) {
      const local = await db.events.toArray();
      for (const event of local) {
        await db.events.put({
          ...event,
          familyId: ids.family_id,
          babyId: ids.baby_id,
          memberId: ids.member_id,
          syncStatus: "pending",
        });
        await db.outbox.put({
          id: crypto.randomUUID(),
          op: "upsert",
          eventId: event.id,
          createdAt: new Date().toISOString(),
        });
      }
      settings = await saveSettings({
        familyId: ids.family_id,
        babyId: ids.baby_id,
        caregiverId: ids.member_id,
      });
    }

    const queued = await db.outbox.orderBy("createdAt").toArray();
    for (const item of queued) {
      const event = await db.events.get(item.eventId);
      if (!event) {
        await db.outbox.delete(item.id);
        continue;
      }
      const { error } = await supabase.from("events").upsert(rowFromEvent(event), { onConflict: "id" });
      if (error) throw error;
      await db.events.update(event.id, { syncStatus: "synced" });
      await db.outbox.delete(item.id);
    }

    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("family_id", settings.familyId)
      .order("updated_at", { ascending: true });
    if (error) throw error;
    for (const row of data ?? []) {
      const incoming = eventFromRow(row as Record<string, unknown>);
      const existing = await db.events.get(incoming.id);
      if (!existing || incoming.rev >= existing.rev) {
        await db.events.put(incoming);
      }
    }

    const lastSyncedAt = new Date().toISOString();
    await db.meta.put({ key: "lastSyncedAt", value: lastSyncedAt });
    return {
      configured: true,
      signedIn: true,
      email: session.user.email ?? null,
      lastError: null,
      lastSyncedAt,
      pending: await db.outbox.count(),
      status: "idle",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    const needsLogin = /jwt|auth|session|401|not authenticated/i.test(message);
    return {
      configured: true,
      signedIn: !needsLogin,
      email: session.user.email ?? null,
      lastError: message,
      lastSyncedAt: null,
      pending: await db.outbox.count(),
      status: needsLogin ? "needs-login" : "error",
    };
  }
}

export async function createSharedFamily() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");
  const settings = await getSettings();
  const { data, error } = await supabase.rpc("ensure_family", {
    p_family_id: settings.familyId,
    p_baby_id: settings.babyId,
    p_member_id: settings.caregiverId,
    p_display_name: settings.caregiverName || "Parent",
    p_baby_name: settings.babyName || "Baby",
    p_timezone: settings.timezone,
    p_care_day_start_hour: settings.careDayStartHour,
  });
  if (error) throw error;
  const ids = data as { family_id: string; baby_id: string; member_id: string };
  await saveSettings({
    familyId: ids.family_id,
    babyId: ids.baby_id,
    caregiverId: ids.member_id,
  });
  return syncNow();
}

export async function createInvite() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase.rpc("create_invite");
  if (error) throw error;
  return String(data);
}

export async function acceptInvite(token: string, displayName: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase.rpc("accept_invite", {
    p_token: token.trim(),
    p_display_name: displayName,
  });
  if (error) throw error;
  const row = data as { family_id: string; baby_id: string; member_id: string };
  await saveSettings({
    familyId: row.family_id,
    babyId: row.baby_id,
    caregiverId: row.member_id,
    caregiverName: displayName,
  });
  await syncNow();
}
