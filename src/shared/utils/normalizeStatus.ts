// Normalization for negotiation status (UPPERCASE canonical form)
// Database constraint: negotiations.status ∈ {OPEN, IN_PROGRESS, PROPOSAL, RESERVATION, WON, LOST, CANCELLED}
// Historic data may contain lowercase/aliases — this util normalizes everything.

export const VALID_NEGOTIATION_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "PROPOSAL",
  "RESERVATION",
  "WON",
  "LOST",
  "CANCELLED",
] as const;

export type NegotiationStatusType = (typeof VALID_NEGOTIATION_STATUSES)[number];

const STATUS_ALIASES: Record<string, NegotiationStatusType> = {
  "open": "OPEN",
  "em_andamento": "IN_PROGRESS",
  "in_progress": "IN_PROGRESS",
  "proposal": "PROPOSAL",
  "reservation": "RESERVATION",
  "won": "WON",
  "lost": "LOST",
  "cancelled": "CANCELLED",
  "vendida": "WON",
  "perdida": "LOST",
  "cancelada": "CANCELLED",
  "concluida": "WON",
};

export function normalizeNegotiationStatus(status: string | null | undefined): NegotiationStatusType {
  if (!status) return "OPEN";
  const upper = status.toUpperCase() as NegotiationStatusType;
  if ((VALID_NEGOTIATION_STATUSES as readonly string[]).includes(upper)) return upper;
  return STATUS_ALIASES[status.toLowerCase()] || "OPEN";
}

export const NEGOTIATION_DONE_STATUSES: NegotiationStatusType[] = ["WON", "LOST", "CANCELLED"];

export function isNegotiationActive(status: string | null | undefined): boolean {
  return !NEGOTIATION_DONE_STATUSES.includes(normalizeNegotiationStatus(status));
}
