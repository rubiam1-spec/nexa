import { UnitQueueService } from "../../domain/fila/UnitQueueService";
import { ProposalStatus } from "../../domain/proposta/ProposalStatus";
import type { Client } from "../../shared/types/client";
import type { CommercialSettings } from "../../shared/types/commercialSettings";
import type { Negotiation } from "../../shared/types/negotiation";
import type { Proposal } from "../../shared/types/proposal";
import type { UnitQueueEntry } from "../../shared/types/unitQueueEntry";
import type { Unidade } from "../../domain/unidade/Unidade";
import { InvalidUnitQueueEntryError } from "./errors/InvalidUnitQueueEntryError";

function isClientDataComplete(client: Client | null) {
  return Boolean(
    client &&
      client.status === "active" &&
      client.name.trim() &&
      client.email.trim() &&
      client.phone.trim() &&
      client.city.trim(),
  );
}

export function entrarNaFilaDaUnidade(input: {
  negotiation: Negotiation;
  unit: Unidade | null;
  proposals: Proposal[];
  client: Client | null;
  settings: CommercialSettings;
  existingEntries: UnitQueueEntry[];
}) {
  if (!input.settings.queueEnabled) {
    throw new InvalidUnitQueueEntryError(
      "A fila da unidade nao esta ativa para este contexto.",
    );
  }

  if (!input.unit) {
    throw new InvalidUnitQueueEntryError(
      "A unidade vinculada a negociacao nao foi encontrada.",
    );
  }

  const acceptedProposal =
    input.proposals.find((proposal) => proposal.status === ProposalStatus.ACCEPTED) ??
    null;
  const latestProposal =
    [...input.proposals].sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    )[0] ?? null;

  if (
    input.settings.requireAcceptedProposalForReservationRequest &&
    !acceptedProposal
  ) {
    throw new InvalidUnitQueueEntryError(
      "A entrada em fila exige uma proposta aceita.",
    );
  }

  if (
    input.settings.requireCompleteClientDataForReservationRequest &&
    !isClientDataComplete(input.client)
  ) {
    throw new InvalidUnitQueueEntryError(
      "A entrada em fila exige cliente com dados completos e ativo.",
    );
  }

  if (!acceptedProposal && !latestProposal) {
    throw new InvalidUnitQueueEntryError(
      "A entrada em fila exige ao menos uma proposta vinculada.",
    );
  }

  if (
    UnitQueueService.hasOpenEntryForNegotiation(
      input.existingEntries,
      input.negotiation.id,
    )
  ) {
    throw new InvalidUnitQueueEntryError(
      "Esta negociacao ja possui uma posicao ativa na fila da unidade.",
    );
  }

  if (
    !UnitQueueService.requiresQueueForNegotiation(
      input.unit,
      input.existingEntries,
      input.negotiation.id,
    )
  ) {
    throw new InvalidUnitQueueEntryError(
      "A fila so pode ser usada quando a unidade estiver indisponivel por reserva ou prioridade ativa.",
    );
  }

  return {
    position: UnitQueueService.getNextPosition(input.existingEntries),
  };
}
