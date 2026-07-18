// Domain types for the deterministic negotiation importer (Camada 1, sem IA).
// Pure types — no React, no Supabase. Regra/normalização vive aqui, nunca na UI.

export type NegotiationStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "PROPOSAL"
  | "RESERVATION"
  | "WON"
  | "LOST"
  | "CANCELLED";

// PT-BR só na tela. Nenhum componente exibe o valor cru do enum.
export const STATUS_LABELS: Record<NegotiationStatus, string> = {
  OPEN: "Em aberto",
  IN_PROGRESS: "Em negociação",
  PROPOSAL: "Proposta",
  RESERVATION: "Reserva",
  WON: "Vendida",
  LOST: "Perdida",
  CANCELLED: "Cancelada",
};

export type StatusClass = "ativa" | "arquivada";

export type StatusMapping = {
  status: NegotiationStatus;
  classe: StatusClass;
  revisar: boolean;
};

export type NexaField =
  | "cliente"
  | "corretor"
  | "imobiliaria"
  | "status"
  | "quadra_lote"
  | "data"
  | "observacao"
  | "telefone"
  | "cpf"
  | "ignorar";

// header da planilha -> campo NEXA
export type ColumnMapping = Record<string, NexaField>;

export type ParsedSheet = {
  sheetNames: string[];
  sheetName: string;
  headers: string[];
  rows: Record<string, string>[];
  headerRowIndex: number;
  totalRows: number;
  totalCols: number;
};

export type RowFlag =
  | "sem_cliente"
  | "sem_data"
  | "ano_corrigido"
  | "sem_corretor"
  | "unidade_nao_encontrada"
  | "multiplos_lotes"
  | "unidade_vendida"
  | "permuta"
  | "status_revisar";

export const ROW_FLAG_LABELS: Record<RowFlag, string> = {
  sem_cliente: "Sem cliente",
  sem_data: "Sem data",
  ano_corrigido: "Ano corrigido",
  sem_corretor: "Sem corretor",
  unidade_nao_encontrada: "Unidade não encontrada",
  multiplos_lotes: "Múltiplos lotes",
  unidade_vendida: "Unidade já vendida",
  permuta: "Permuta",
  status_revisar: "Status a revisar",
};

export type BrokerCandidate = { id: string; name: string; brokerageName?: string | null };

export type UnitCandidate = {
  id: string;
  quadra: string;
  lote: string;
  status: string;
};

export type ClientCandidate = { id: string; name: string };

// Opção pronta para um combobox de busca (UI). Confiança/grupo vêm do service.
export type RankedOption = {
  id: string;
  label: string;
  secondary?: string;
  group?: string;
  confidence?: number; // 0..1
};

// Decisão do usuário sobre um corretor distinto (confirmação, nunca automático no commit).
export type BrokerDecision = {
  brokerId: string | null; // existente confirmado
  brokerName: string; // nome canônico (cria se brokerId null)
  brokerageId?: string | null;
  brokerageName?: string | null;
};

export type StagingRow = {
  index: number; // nº da linha original (exibição)
  clientName: string | null;
  clientPhone: string | null;
  clientCpf: string | null;
  brokerNameRaw: string | null;
  brokerName: string | null;
  brokerId: string | null;
  brokerageName: string | null;
  brokerageId: string | null;
  quadra: string | null;
  lote: string | null;
  unitId: string | null;
  clientId: string | null; // vínculo explícito a contato existente (gated)
  clientLinkSuggested: boolean; // há provável duplicata de cliente
  status: NegotiationStatus;
  statusClass: StatusClass;
  temperature: string | null;
  permuta: boolean;
  createdAt: string | null; // ISO (backdate)
  rawStatus: string;
  rawDate: string;
  observacao: string | null;
  flags: RowFlag[];
  approved: boolean;
};

// Linha enxuta enviada à RPC commit_negotiation_import.
export type CommitRow = {
  client_id: string | null; // se presente, a RPC vincula a este contato
  client_name: string | null;
  client_phone: string | null;
  client_cpf: string | null;
  broker_id: string | null;
  broker_name: string | null;
  brokerage_id: string | null;
  brokerage_name: string | null;
  unit_id: string | null;
  status: NegotiationStatus;
  temperature: string | null;
  permuta: boolean;
  created_at: string | null;
};
