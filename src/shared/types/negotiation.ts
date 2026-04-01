import type { NegotiationStatus } from "../../domain/negociacao/NegotiationStatus";

export type NegotiationTemperature = "hot" | "warm" | "cold";

export type Negotiation = {
  id: string;
  accountId: string;
  developmentId: string;
  unitId: string;
  clientId: string | null;
  brokerId: string | null;
  status: NegotiationStatus;
  score: number;
  temperature: NegotiationTemperature;
  createdAt: Date;
  updatedAt: Date;
};
