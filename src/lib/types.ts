export type EventType = "feed" | "pump" | "diaper" | "sleep" | "weight" | "note";
export type BreastSide = "left" | "right";
export type FeedMethod = "breast" | "expressed" | "formula" | "mixed";
export type DiaperKind = "wet" | "dirty" | "both";
export type VolumeUnit = "ml" | "oz";
export type WeightUnit = "kg" | "lb";
export type SyncStatus = "pending" | "synced" | "error";

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

export type NoteData = {
  text: string;
};

export type EventData = FeedData | PumpData | DiaperData | SleepData | WeightData | NoteData;

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
  lastVisitAt: string;
  handoverCursor: string;
  onboardedAt: string;
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
  lastVisitAt: "",
  handoverCursor: "",
  onboardedAt: "",
});
