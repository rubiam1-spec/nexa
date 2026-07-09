// Fonte ÚNICA do vocabulário de QUALIFICAÇÃO DE LEAD (Leads L1).
// Vive sobre a coluna `clients.qualification_status` (text, default 'unqualified').
// Distinto de `clients.status` (ClientStatus: new/contacted/... — CRM geral).
//
// IMPORTANTE: NEW mapeia para o valor JÁ EXISTENTE no banco ('unqualified') —
// zero migração de dado. Os demais valores são novos (o campo era morto na UI).
// Não há CHECK constraint em qualification_status (pendência registrada:
// aplicar CHECK depois do vocabulário assentar, padrão NOT VALID→VALIDATE).
export const LeadQualificationStatus = {
  NEW: "NEW",
  IN_SERVICE: "IN_SERVICE",
  QUALIFIED: "QUALIFIED",
  CONVERTED: "CONVERTED",
  DISCARDED: "DISCARDED",
} as const;
export type LeadQualificationStatus =
  (typeof LeadQualificationStatus)[keyof typeof LeadQualificationStatus];

/** enum → valor gravado em clients.qualification_status. */
export const LeadQualificationDbStatus: Record<LeadQualificationStatus, string> = {
  [LeadQualificationStatus.NEW]: "unqualified", // valor existente — não migrar
  [LeadQualificationStatus.IN_SERVICE]: "in_service",
  [LeadQualificationStatus.QUALIFIED]: "qualified",
  [LeadQualificationStatus.CONVERTED]: "converted",
  [LeadQualificationStatus.DISCARDED]: "discarded",
};

export const LEAD_QUALIFICATION_DB_VALUES = Object.values(LeadQualificationDbStatus);

/** Estágios ATIVOS (a tela Leads trabalha estes; convertido/descartado = filtro secundário). */
export const LEAD_ACTIVE_STATUSES: LeadQualificationStatus[] = [
  LeadQualificationStatus.NEW,
  LeadQualificationStatus.IN_SERVICE,
  LeadQualificationStatus.QUALIFIED,
];

/** Estágios terminais. */
export const LEAD_TERMINAL_STATUSES: LeadQualificationStatus[] = [
  LeadQualificationStatus.CONVERTED,
  LeadQualificationStatus.DISCARDED,
];

const DB_TO_ENUM: Record<string, LeadQualificationStatus> = Object.fromEntries(
  Object.entries(LeadQualificationDbStatus).map(([k, v]) => [v, k as LeadQualificationStatus]),
);

export function toLeadQualificationDb(status: LeadQualificationStatus): string {
  return LeadQualificationDbStatus[status];
}

/** valor do banco → enum. Tolerante: valor legado/desconhecido (ou null) → NEW. */
export function fromLeadQualificationDb(raw: string | null | undefined): LeadQualificationStatus {
  const trimmed = (raw ?? "").trim();
  return DB_TO_ENUM[trimmed] ?? LeadQualificationStatus.NEW;
}

export function isLeadActive(status: LeadQualificationStatus): boolean {
  return LEAD_ACTIVE_STATUSES.includes(status);
}

// Transições válidas (decisão de produto). Ciclo canônico:
//   NEW → IN_SERVICE → QUALIFIED → CONVERTED | DISCARDED.
// CONVERTER e DESCARTAR são ações disponíveis em QUALQUER estágio ativo
// (converter em 1 toque; descartar sempre possível). Terminais não saem.
const VALID_TRANSITIONS: Record<LeadQualificationStatus, LeadQualificationStatus[]> = {
  [LeadQualificationStatus.NEW]: [
    LeadQualificationStatus.IN_SERVICE,
    LeadQualificationStatus.CONVERTED,
    LeadQualificationStatus.DISCARDED,
  ],
  [LeadQualificationStatus.IN_SERVICE]: [
    LeadQualificationStatus.QUALIFIED,
    LeadQualificationStatus.CONVERTED,
    LeadQualificationStatus.DISCARDED,
  ],
  [LeadQualificationStatus.QUALIFIED]: [
    LeadQualificationStatus.CONVERTED,
    LeadQualificationStatus.DISCARDED,
  ],
  [LeadQualificationStatus.CONVERTED]: [],
  [LeadQualificationStatus.DISCARDED]: [],
};

export function canTransition(
  from: LeadQualificationStatus,
  to: LeadQualificationStatus,
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/** Valida a transição; lança se inválida (guard de escrita no repositório). */
export function assertLeadTransition(
  from: LeadQualificationStatus,
  to: LeadQualificationStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(`Transição de lead inválida: ${from} → ${to}`);
  }
}
