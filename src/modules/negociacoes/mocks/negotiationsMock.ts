import { NegotiationStatus } from "../../../domain/negociacao/NegotiationStatus";
import type { Negotiation } from "../../../shared/types/negotiation";

export const negotiationsMock: Negotiation[] = [
  {
    id: "negotiation_1",
    accountId: "account_1",
    developmentId: "development_1",
    unitId: "unit_1",
    clientId: "client_1",
    brokerId: "broker_1",
    status: NegotiationStatus.OPEN,
    createdAt: new Date("2026-01-05T00:00:00.000Z"),
    updatedAt: new Date("2026-01-05T00:00:00.000Z"),
  },
  {
    id: "negotiation_2",
    accountId: "account_1",
    developmentId: "development_1",
    unitId: "unit_2",
    clientId: "client_3",
    brokerId: "broker_3",
    status: NegotiationStatus.IN_PROGRESS,
    createdAt: new Date("2026-01-06T00:00:00.000Z"),
    updatedAt: new Date("2026-01-06T00:00:00.000Z"),
  },
];
