// NEXA — Engrenagem de Partes v1
// Tipos da tabela negotiation_parties (schema aplicado na Fase 1).
// camelCase na UI; mapping acontece no repositório.

import type { MaritalStatus } from "./client";

export type PartyRole =
  | "primary_buyer"
  | "spouse"
  | "co_obligor"
  | "attorney_in_fact"
  | "beneficial_owner";

export type SigningCapacity = "signs_alone" | "signs_jointly" | "no_sign";

export type LegalRegime =
  | "comunhao_parcial"
  | "comunhao_universal"
  | "separacao_total"
  | "participacao_final_aquestos";

export interface NegotiationParty {
  id: string;
  accountId: string;
  negotiationId: string;
  clientId: string;
  role: PartyRole;
  signingCapacity: SigningCapacity | null;
  legalRegime: LegalRegime | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

/** Parte + dados básicos da pessoa (client), para uso direto na UI. */
export interface NegotiationPartyWithClient {
  party: NegotiationParty;
  client: {
    id: string;
    fullName: string | null;
    name: string | null;
    cpf: string | null;
    email: string | null;
    phone: string | null;
    maritalStatus: MaritalStatus | null;
    regimeCasamento: LegalRegime | null;
  };
}

/** Input de criação. primary_buyer é gerenciado automaticamente pelo
 *  trigger do banco — código jamais deve tentar criar manualmente. */
export interface AddPartyInput {
  negotiationId: string;
  clientId: string;
  role: Exclude<PartyRole, "primary_buyer">;
  signingCapacity?: SigningCapacity | null;
  legalRegime?: LegalRegime | null;
  notes?: string | null;
}

export interface UpdatePartyInput {
  signingCapacity?: SigningCapacity | null;
  legalRegime?: LegalRegime | null;
  notes?: string | null;
}

export const PARTY_ROLE_LABELS: Record<PartyRole, string> = {
  primary_buyer: "Comprador principal",
  spouse: "Cônjuge",
  co_obligor: "Co-obrigado",
  attorney_in_fact: "Procurador",
  beneficial_owner: "Beneficiário final",
};

export const SIGNING_CAPACITY_LABELS: Record<SigningCapacity, string> = {
  signs_alone: "Assina sozinho",
  signs_jointly: "Assina em conjunto",
  no_sign: "Não assina",
};

export const LEGAL_REGIME_LABELS: Record<LegalRegime, string> = {
  comunhao_parcial: "Comunhão parcial de bens",
  comunhao_universal: "Comunhão universal de bens",
  separacao_total: "Separação total de bens",
  participacao_final_aquestos: "Participação final nos aquestos",
};

/** Ordem canônica para exibição em listas e cards. */
export const PARTY_ROLE_DISPLAY_ORDER: PartyRole[] = [
  "primary_buyer",
  "spouse",
  "co_obligor",
  "attorney_in_fact",
  "beneficial_owner",
];
