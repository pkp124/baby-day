import { useCallback, useEffect, useMemo, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getSettings, saveSettings } from "../lib/db";
import { syncNow, type SyncState } from "../lib/sync";
import { getSupabase } from "../lib/supabase";
import type { CareEvent, Settings } from "../lib/types";
import { defaultSettings } from "../lib/types";

export function useBabyDay() {
  const settings = useLiveQuery(async () => {
    const row = await db.meta.get("settings");
    return row ? ({ ...defaultSettings(), ...(row.value as Settings) } satisfies Settings) : await getSettings();
  }, []);
  const events = useLiveQuery(() => db.events.orderBy("time").reverse().toArray(), []) ?? [];
  const pending = useLiveQuery(() => db.outbox.count(), []) ?? 0;

  const [page, setPage] = useState<"home" | "settings">("home");
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
  const { needRefresh, updateServiceWorker } = useRegisterSW({ immediate: true });
  return { needRefresh: needRefresh[0], reload: () => updateServiceWorker(true) };
}
