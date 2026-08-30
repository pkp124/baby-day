import { liveQuery } from "dexie";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { db, getSettings, saveSettings } from "../lib/db";
import { syncNow, type SyncState } from "../lib/sync";
import { getSupabase } from "../lib/supabase";
import type { CareEvent, Settings } from "../lib/types";
import { defaultSettings } from "../lib/types";

export function useBabyDay() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [events, setEvents] = useState<CareEvent[]>([]);
  const [pending, setPending] = useState(0);
  const [page, setPage] = useState<"home" | "settings" | "report">("home");
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncState>({
    configured: false,
    signedIn: false,
    email: null,
    lastError: null,
    lastSyncedAt: null,
    pending: 0,
    status: "local",
  });

  useEffect(() => {
    void getSettings().then(setSettings);
    const settingsSub = liveQuery(async () => {
      const row = await db.meta.get("settings");
      return row?.value as Settings | undefined;
    }).subscribe({
      next: (value) => {
        if (value) setSettings({ ...defaultSettings(), ...value });
      },
      error: (err) => console.error(err),
    });
    const eventsSub = liveQuery(() => db.events.orderBy("time").reverse().toArray()).subscribe({
      next: setEvents,
      error: (err) => console.error(err),
    });
    const outboxSub = liveQuery(() => db.outbox.count()).subscribe({
      next: setPending,
      error: (err) => console.error(err),
    });
    return () => {
      settingsSub.unsubscribe();
      eventsSub.unsubscribe();
      outboxSub.unsubscribe();
    };
  }, []);

  const live = useMemo(() => events.filter((e) => !e.deletedAt), [events]);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        void saveSettings({ lastVisitAt: new Date().toISOString() });
      } else {
        setSessionStartedAt(new Date().toISOString());
        void syncNow().then(setSync);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    void syncNow().then(setSync);
    const supabase = getSupabase();
    const { data } = supabase?.auth.onAuthStateChange(() => {
      void syncNow().then(setSync);
    }) ?? { data: { subscription: { unsubscribe() {} } } };
    const channel = supabase
      ?.channel("family-events")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => {
        void syncNow().then(setSync);
      })
      .subscribe();
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      data.subscription.unsubscribe();
      if (channel && supabase) void supabase.removeChannel(channel);
    };
  }, []);

  const flash = useCallback((message: string, undo?: () => void) => {
    setToast({ message, undo });
    window.setTimeout(() => setToast(null), 7000);
  }, []);

  const handover = useMemo(() => {
    if (!settings?.lastVisitAt || !sessionStartedAt) return [] as CareEvent[];
    const left = new Date(settings.lastVisitAt).getTime();
    const back = new Date(sessionStartedAt).getTime();
    if (back - left < 2 * 60_000) return [] as CareEvent[];
    return live.filter((e) => {
      const created = new Date(e.createdAt).getTime();
      return created > left && created <= back;
    });
  }, [live, settings?.lastVisitAt, sessionStartedAt]);

  return {
    ready: Boolean(settings),
    settings: settings ?? defaultSettings(),
    events: live,
    pending,
    page,
    setPage,
    toast,
    setToast,
    flash,
    handover,
    dismissHandover: () => setSessionStartedAt(null),
    sync: { ...sync, pending },
    refreshSync: () => syncNow().then(setSync),
  };
}

export function usePwaUpdate() {
  const { needRefresh, updateServiceWorker } = useRegisterSW({ immediate: false });
  const pending = Boolean(needRefresh[0]);
  const reload = () => {
    if (pending) void updateServiceWorker(true);
    else window.location.reload();
  };
  return { needRefresh: pending, reload };
}
