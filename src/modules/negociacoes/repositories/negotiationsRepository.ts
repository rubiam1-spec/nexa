import { NegotiationStatus } from "../../../domain/negociacao/NegotiationStatus";
import type { Negotiation } from "../../../shared/types/negotiation";
import { negotiationsMock } from "../mocks/negotiationsMock";

export function createNegotiation(input: {
  accountId: string;
  developmentId: string;
  unitId: string;
  clientId: string | null;
  brokerId: string | null;
}): Negotiation {
  const now = new Date();
  const negotiation: Negotiation = {
    id: crypto.randomUUID(),
    accountId: input.accountId,
    developmentId: input.developmentId,
    unitId: input.unitId,
    clientId: input.clientId,
    brokerId: input.brokerId,
    thirdPartyPropertyId: null,
    status: NegotiationStatus.OPEN,
    score: 50,
    temperature: "warm",
    createdAt: now,
    updatedAt: now,
  };
  negotiationsMock.unshift(negotiation);
  return negotiation;
}

export function getNegotiations(accountId: string, developmentId: string) {
  return negotiationsMock.filter(
    (negotiation) =>
      negotiation.accountId === accountId &&
      negotiation.developmentId === developmentId,
  );
}

export function updateNegotiationStatus(
  negotiationId: string,
  status: Negotiation["status"],
) {
  const negotiation = negotiationsMock.find((item) => item.id === negotiationId);

  if (!negotiation) {
    throw new Error("Negotiation not found in mock repository.");
  }

  negotiation.status = status;
  negotiation.updatedAt = new Date();

  return negotiation;
}
