export const UnitQueueStatus = {
  ACTIVE: "ACTIVE",
  PROMOTED: "PROMOTED",
  CANCELLED: "CANCELLED",
} as const;

export type UnitQueueStatus =
  (typeof UnitQueueStatus)[keyof typeof UnitQueueStatus];
