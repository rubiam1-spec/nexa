export type ClientStatus =
  | "new"
  | "contacted"
  | "qualifying"
  | "qualified"
  | "nurturing"
  | "negotiating"
  | "active"
  | "converted"
  | "lost"
  | "inactive";

export type ClientTemperature = "hot" | "warm" | "cold";

// NEXA — Engrenagem de Partes v1
export type MaritalStatus =
  | "solteiro"
  | "casado"
  | "divorciado"
  | "viuvo"
  | "uniao_estavel";

// Re-exportado de negotiationParty para conveniência — mesmo conjunto
// de valores usado em negotiation_parties.legal_regime e clients.regime_casamento.
import type { LegalRegime } from "./negotiationParty";
export type { LegalRegime } from "./negotiationParty";

export type Client = {
  id: string;
  accountId: string;
  developmentId: string | null;

  // Identity
  name: string;
  fullName: string | null;
  email: string;
  phone: string;
  phoneSecondary: string | null;
  cpf: string | null;
  city: string;

  // Classification
  status: ClientStatus;
  temperature: ClientTemperature;
  buyerProfile: string | null;
  priority: string | null;
  score: number;
  qualificationStatus: string | null;

  // Origin
  origin: string | null;
  originDetail: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  campaignId: string | null;

  // Interest
  budgetMin: number | null;
  budgetMax: number | null;
  purchaseTimeline: string | null;
  paymentPreference: string | null;
  interestedUnitType: string | null;

  // Assignment
  assignedTo: string | null;
  assignedToName: string | null;
  brokerId: string | null;
  brokerName: string | null;

  // Tracking
  firstContactAt: string | null;
  lastContactAt: string | null;
  lastInteractionAt: string | null;
  nextFollowUpAt: string | null;
  interactionCount: number;

  // Conversion
  convertedAt: string | null;
  lostAt: string | null;
  lostReason: string | null;

  // Tags
  tags: string[];
  internalNotes: string | null;
  interesse: string | null;

  // NEXA — Engrenagem de Partes v1: estado civil estruturado
  maritalStatus: MaritalStatus | null;
  regimeCasamento: LegalRegime | null;
  /** Cônjuge cadastrado como cliente (vínculo bidirecional via linkSpouses). */
  currentSpouseClientId: string | null;

  // Metadata
  createdBy: string | null;
  createdAt: string;
};

/** Agregado usado quando precisamos exibir o cônjuge junto. */
export type ClientWithSpouse = {
  client: Client;
  spouse: Client | null;
};

export type ContactInteraction = {
  id: string;
  clientId: string;
  type: string;
  direction: string | null;
  title: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  performedBy: string | null;
  performedByName: string | null;
  performedAt: string;
};

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  new: "Novo",
  contacted: "Contatado",
  qualifying: "Qualificando",
  qualified: "Qualificado",
  nurturing: "Nutrição",
  negotiating: "Em negociação",
  active: "Ativo",
  converted: "Convertido",
  lost: "Perdido",
  inactive: "Inativo",
};

export const CLIENT_STATUS_COLORS: Record<ClientStatus, string> = {
  new: "#60A5FA",
  contacted: "#A78BFA",
  qualifying: "#FBBF24",
  qualified: "#4ADE80",
  nurturing: "#38BDF8",
  negotiating: "#F97316",
  active: "#22C55E",
  converted: "#22C55E",
  lost: "#F87171",
  inactive: "#6B7280",
};

export const CLIENT_TEMP_LABELS: Record<ClientTemperature, string> = {
  hot: "Quente",
  warm: "Morno",
  cold: "Frio",
};

export const CLIENT_TEMP_COLORS: Record<ClientTemperature, string> = {
  hot: "#EF4444",
  warm: "#F59E0B",
  cold: "#3B82F6",
};

export const CLIENT_SOURCE_LABELS: Record<string, string> = {
  website: "Website",
  instagram: "Instagram",
  facebook: "Facebook",
  google_ads: "Google Ads",
  whatsapp: "WhatsApp",
  phone: "Telefone",
  referral: "Indicação",
  broker_indication: "Indicação corretor",
  event: "Evento",
  walk_in: "Presencial",
  landing_page: "Landing Page",
  rd_station: "RD Station",
  import: "Importação",
  other: "Outro",
};

export const LOST_REASON_LABELS: Record<string, string> = {
  no_budget: "Sem orçamento",
  no_interest: "Sem interesse",
  bought_competitor: "Comprou concorrente",
  no_response: "Sem resposta",
  invalid_contact: "Contato inválido",
  wrong_profile: "Perfil inadequado",
  too_expensive: "Achou caro",
  bad_timing: "Momento ruim",
  other: "Outro",
};
