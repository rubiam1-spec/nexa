import type { Negotiation } from "../../shared/types/negotiation";
import { NegotiationStatus } from "./NegotiationStatus";

export class NegotiationService {
  static podeIniciar(negotiation: Negotiation) {
    return negotiation.status === NegotiationStatus.OPEN;
  }

  static podeCancelar(negotiation: Negotiation) {
    return (
      negotiation.status === NegotiationStatus.OPEN ||
      negotiation.status === NegotiationStatus.IN_PROGRESS
    );
  }

  static podeCriarProposta(negotiation: Negotiation) {
    return (
      negotiation.status === NegotiationStatus.OPEN ||
      negotiation.status === NegotiationStatus.IN_PROGRESS
    );
  }

  static alterarStatus(
    negotiation: Negotiation,
    status: Negotiation["status"],
  ): Negotiation {
    return {
      ...negotiation,
      status,
      updatedAt: new Date(),
    };
  }
}
