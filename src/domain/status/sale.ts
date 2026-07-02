// Fonte única do vocabulário de status de VENDA (Fase 3 — Etapa 1).
// enum de domínio (UPPERCASE) + valor real no banco (lowercase, confirmado Fase 1).
import { SaleStatus, type SaleStatus as SaleStatusType } from "../venda/SaleStatus";
export { SaleStatus, type SaleStatusType };

/** enum → valor gravado em sales.status (lowercase). */
export const SaleDbStatus: Record<SaleStatusType, string> = {
  [SaleStatus.CREATED]: "created",
  [SaleStatus.AWAITING_DOCUMENTS]: "awaiting_documents",
  [SaleStatus.AWAITING_CONTRACT]: "awaiting_contract",
  [SaleStatus.AWAITING_PAYMENT]: "awaiting_payment",
  [SaleStatus.COMPLETED]: "completed",
  [SaleStatus.CANCELLED]: "cancelled",
};

export const SALE_DB_VALUES = Object.values(SaleDbStatus);

/** valor do banco → membro do enum. */
export const SaleStatusFromDb: Record<string, SaleStatusType> = Object.fromEntries(
  Object.entries(SaleDbStatus).map(([k, v]) => [v, k as SaleStatusType]),
);
const fromDb = SaleStatusFromDb;

export function toSaleDb(status: SaleStatusType): string {
  return SaleDbStatus[status];
}
export function fromSaleDb(raw: string): SaleStatusType {
  const trimmed = (raw ?? "").trim();
  if (fromDb[trimmed]) return fromDb[trimmed];
  const upper = trimmed.toUpperCase();
  if ((Object.values(SaleStatus) as string[]).includes(upper)) return upper as SaleStatusType;
  return SaleStatus.CREATED;
}
