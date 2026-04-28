// NEXA — Camada 3 (Documentos), Sprint B.3.0a
// Tipos do catálogo de documentos e da matriz de requirements por
// empreendimento. Mapping snake_case ↔ camelCase acontece no
// repositório; aqui só os tipos de domínio.

export type DocumentCategory =
  | "identidade"
  | "comprovante"
  | "contrato"
  | "fiscal"
  | "outro";

/** Mantemos a mesma união usada em negotiation_parties para
 *  consistência. beneficial_owner permanece no enum mas a UI da
 *  Sprint B.3.0a oculta a coluna até a Sprint B.7 (PJ). */
export type PartyRole =
  | "primary_buyer"
  | "spouse"
  | "co_obligor"
  | "attorney_in_fact"
  | "beneficial_owner";

export type PessoaTipo = "PF" | "PJ";

export interface DocumentType {
  id: string;
  label: string;
  description: string | null;
  category: DocumentCategory;
  appliesToPessoaTipo: PessoaTipo[];
  displayOrder: number;
}

export interface DocumentRequirement {
  id: string;
  accountId: string;
  developmentId: string;
  partyRole: PartyRole;
  documentTypeId: string;
  isRequired: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRequirementWithType extends DocumentRequirement {
  documentType: DocumentType;
}

/** Estado visual da célula da matriz: required / optional / missing. */
export type RequirementCellState = "required" | "optional" | "missing";

export const PARTY_ROLE_LABEL: Record<PartyRole, string> = {
  primary_buyer: "Comprador principal",
  spouse: "Cônjuge",
  co_obligor: "Coobrigado",
  attorney_in_fact: "Procurador",
  beneficial_owner: "Beneficiário final",
};
