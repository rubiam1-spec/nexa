// Fonte única do vocabulário de status de FILA DE UNIDADE (Fase 3 — Etapa 1).
// enum de domínio (UPPERCASE) + valor real no banco (lowercase, confirmado Fase 1:
// unit_queue_entries usa 'waiting'/'active'/... em lowercase).
import { UnitQueueStatus, type UnitQueueStatus as UnitQueueStatusType } from "../fila/UnitQueueStatus";
export { UnitQueueStatus, type UnitQueueStatusType };

/** enum → valor gravado em unit_queue_entries.status (lowercase). */
export const UnitQueueDbStatus: Record<UnitQueueStatusType, string> = {
  [UnitQueueStatus.ACTIVE]: "active",
  [UnitQueueStatus.PROMOTED]: "promoted",
  [UnitQueueStatus.CANCELLED]: "cancelled",
  [UnitQueueStatus.WAITING]: "waiting",
  [UnitQueueStatus.REMOVED]: "removed",
  [UnitQueueStatus.EXPIRED]: "expired",
};

export const UNIT_QUEUE_DB_VALUES = Object.values(UnitQueueDbStatus);

// TOLERÂNCIA TEMPORÁRIA: remover na Fase 3 Etapa 5 junto com o fix de escrita M1.
// A fila ainda é gravada em MAIÚSCULO pelo fix M1 (promoteQueueFirst) enquanto o dado
// e o canônico são minúsculos; aceitar ambos os cases evita tornar invisível a primeira
// entrada nova. Quando a escrita for roteada pelo repositório (Etapa 5) + CHECK da fila,
// esta tolerância cai e a leitura passa a ser estrita (só lowercase canônico).
/** valor do banco (aceita lowercase e UPPER legado) → membro do enum. */
export const UnitQueueStatusFromDb: Record<string, UnitQueueStatusType> = Object.fromEntries(
  Object.entries(UnitQueueDbStatus).flatMap(([k, v]) => [
    [v, k as UnitQueueStatusType],
    [v.toUpperCase(), k as UnitQueueStatusType],
  ]),
);
const fromDb = UnitQueueStatusFromDb;

export function toUnitQueueDb(status: UnitQueueStatusType): string {
  return UnitQueueDbStatus[status];
}
export function fromUnitQueueDb(raw: string): UnitQueueStatusType {
  return fromDb[(raw ?? "").trim()] ?? UnitQueueStatus.ACTIVE;
}
