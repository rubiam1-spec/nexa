import type { SaleStatus } from "../../domain/venda/SaleStatus";

export type Sale = {
  id: string;
  negotiationId: string;
  reservationId: string;
  proposalId: string;
  accountId: string;
  developmentId: string;
  unitId: string;
  amount: number;
  status: SaleStatus;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};
