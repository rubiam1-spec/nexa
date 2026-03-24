export const SaleStatus = {
  CREATED: "CREATED",
  AWAITING_DOCUMENTS: "AWAITING_DOCUMENTS",
  AWAITING_CONTRACT: "AWAITING_CONTRACT",
  AWAITING_PAYMENT: "AWAITING_PAYMENT",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

export type SaleStatus = (typeof SaleStatus)[keyof typeof SaleStatus];
