import type { NegotiationStatus } from "../../domain/negociacao/NegotiationStatus";

export type Negotiation = {
  id: string;
  accountId: string;
  developmentId: string;
  unitId: string;
  clientId: string | null;
  brokerId: string | null;
  status: NegotiationStatus;
  createdAt: Date;
  updatedAt: Date;
};
