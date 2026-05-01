export const UnitQueueStatus = {
  ACTIVE: "ACTIVE",
  PROMOTED: "PROMOTED",
  CANCELLED: "CANCELLED",
  WAITING: "WAITING",
  REMOVED: "REMOVED",
  EXPIRED: "EXPIRED",
} as const;

export type UnitQueueStatus =
  (typeof UnitQueueStatus)[keyof typeof UnitQueueStatus];
