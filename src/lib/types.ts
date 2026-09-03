export type EventType = "feed" | "pump" | "diaper" | "sleep" | "weight" | "temp" | "note" | "vitaminD" | "vitaminK";
export type VitaminType = Extract<EventType, "vitaminD" | "vitaminK">;
export type BreastSide = "left" | "right";
export type FeedMethod = "breast" | "expressed" | "formula" | "mixed";
export type DiaperKind = "wet" | "dirty" | "both";
export type VolumeUnit = "ml" | "oz";
export type WeightUnit = "kg" | "lb";
export type TempUnit = "C" | "F";
export type SyncStatus = "pending" | "synced" | "error";
export type LanRememberTtl = "day" | "week";
export type LanPasskeyRole = "host" | "guest" | "";

export type FeedData = {
  method: FeedMethod;
  startedOn?: BreastSide;
  leftSeconds?: number;
  rightSeconds?: number;
  volumeMl?: number;
  formulaMl?: number;
  expressedMl?: number;
  note?: string;
  activeSide?: BreastSide;
  sideStartedAt?: string;
};

export type PumpData = {
  leftMl?: number;
  rightMl?: number;
  volumeMl?: number;
  note?: string;
};

export type DiaperData = {
  kind: DiaperKind;
  note?: string;
};

export type SleepData = {
  note?: string;
};

export type WeightData = {
  grams: number;
  note?: string;
};

export type TempData = {
  celsius: number;
  note?: string;
};

export type NoteData = {
  text: string;
};

export type VitaminData = {
  note?: string;
};

export type EventData = FeedData | PumpData | DiaperData | SleepData | WeightData | TempData | NoteData | VitaminData;

export type CareEvent = {
  id: string;
  familyId: string;
  babyId: string;
  memberId: string;
  memberName: string;
  type: EventType;
  time: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  rev: number;
  deletedAt: string | null;
  data: EventData;
  syncStatus: SyncStatus;
};

export type Settings = {
  babyName: string;
  babyDob: string;
  caregiverName: string;
  caregiverId: string;
  familyId: string;
  babyId: string;
  timezone: string;
  careDayStartHour: number;
  volumeUnit: VolumeUnit;
  weightUnit: WeightUnit;
  tempUnit: TempUnit;
  lastVisitAt: string;
  handoverCursor: string;
  onboardedAt: string;
  cribPasskey: string;
  lanPasskey: string;
  lanPasskeyRememberUntil: string;
  lanPasskeyTtl: LanRememberTtl;
  lanPasskeyRole: LanPasskeyRole;
  /** `0` keeps every event. Otherwise finished events older than this many days are tombstoned. */
  eventRetentionDays: number;
};

export const defaultSettings = (): Settings => ({
  babyName: "",
  babyDob: "",
  caregiverName: "",
  caregiverId: crypto.randomUUID(),
  familyId: crypto.randomUUID(),
  babyId: crypto.randomUUID(),
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  careDayStartHour: 5,
  volumeUnit: "ml",
  weightUnit: "kg",
  tempUnit: "C",
  lastVisitAt: "",
  handoverCursor: "",
  onboardedAt: "",
  cribPasskey: "",
  lanPasskey: "",
  lanPasskeyRememberUntil: "",
  lanPasskeyTtl: "week",
  lanPasskeyRole: "",
  eventRetentionDays: 0,
});
