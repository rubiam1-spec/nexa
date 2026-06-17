export const NegotiationStatus = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  PROPOSAL: "PROPOSAL",
  RESERVATION: "RESERVATION",
  WON: "WON",
  LOST: "LOST",
  CANCELLED: "CANCELLED",
} as const;

export type NegotiationStatus =
  (typeof NegotiationStatus)[keyof typeof NegotiationStatus];
