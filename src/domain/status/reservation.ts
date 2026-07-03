// Fonte única do vocabulário de status de RESERVA e SOLICITAÇÃO DE RESERVA
// (Fase 3 — Etapa 1). Ambas as tabelas usam ReservationStatus.
// enum de domínio (UPPERCASE) + valor real no banco (lowercase, confirmado Fase 1).
import { ReservationStatus, type ReservationStatus as ReservationStatusType } from "../reserva/ReservationStatus";
export { ReservationStatus, type ReservationStatusType };

/** enum → valor gravado em reservations.status / reservation_requests.status (lowercase). */
export const ReservationDbStatus: Record<ReservationStatusType, string> = {
  [ReservationStatus.REQUESTED]: "requested",
  [ReservationStatus.APPROVED]: "approved",
  [ReservationStatus.REJECTED]: "rejected",
  [ReservationStatus.ACTIVE]: "active",
  [ReservationStatus.CANCELLED]: "cancelled",
  [ReservationStatus.EXPIRED]: "expired",
  [ReservationStatus.CONVERTED]: "converted",
};

/** Valores de solicitação de reserva (subconjunto usado por reservation_requests). */
export const RESERVATION_REQUEST_DB_VALUES = [
  ReservationDbStatus[ReservationStatus.REQUESTED],
  ReservationDbStatus[ReservationStatus.APPROVED],
  ReservationDbStatus[ReservationStatus.REJECTED],
  ReservationDbStatus[ReservationStatus.CANCELLED],
];

export const RESERVATION_DB_VALUES = Object.values(ReservationDbStatus);

// Valores canônicos (banco) usados por leitores estritos do Kanban (Fase 3 — Etapa 3).
export const RESERVATION_ACTIVE_DB = ReservationDbStatus[ReservationStatus.ACTIVE];
export const RESERVATION_REQUEST_PENDING_DB = ReservationDbStatus[ReservationStatus.REQUESTED];
/** Reserva encerrada (não-ativa): cancelada/expirada/convertida — valores do banco. */
export const RESERVATION_TERMINAL_DB_VALUES = [
  ReservationDbStatus[ReservationStatus.CANCELLED],
  ReservationDbStatus[ReservationStatus.EXPIRED],
  ReservationDbStatus[ReservationStatus.CONVERTED],
];

/** valor do banco → membro do enum. */
export const ReservationStatusFromDb: Record<string, ReservationStatusType> = Object.fromEntries(
  Object.entries(ReservationDbStatus).map(([k, v]) => [v, k as ReservationStatusType]),
);
const fromDb = ReservationStatusFromDb;

export function toReservationDb(status: ReservationStatusType): string {
  return ReservationDbStatus[status];
}
export function fromReservationDb(raw: string): ReservationStatusType {
  const trimmed = (raw ?? "").trim();
  if (fromDb[trimmed]) return fromDb[trimmed];
  const upper = trimmed.toUpperCase();
  if ((Object.values(ReservationStatus) as string[]).includes(upper)) return upper as ReservationStatusType;
  return ReservationStatus.REQUESTED;
}
