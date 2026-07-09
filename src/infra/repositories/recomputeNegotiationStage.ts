// Fase A do Funil — gancho de manutenção do ESTÁGIO da negociação.
//
// Após cada escrita que muda marcos (proposta/reserva/venda), o repositório
// correspondente chama recomputeNegotiationStage(negotiationId): lê os filhos,
// deriva o estágio (regra pura em src/domain/status/negotiationStage) e grava
// APENAS se mudou (idempotente — não polui histórico/updated_at). A transição é
// registrada no negotiation_history como ação de sistema (performed_by null).
//
// Lê os filhos por query DIRETA (não pelos getters dos repos de proposta/reserva/
// venda) de propósito: evita ciclo de import (aqueles repos importam ESTE módulo).
import { getSupabaseClientOrThrow } from "./baseRepository";
import { updateNegotiationStatus } from "./negotiationsSupabaseRepository";
import { createNegotiationHistoryEvent } from "./negotiationHistorySupabaseRepository";
import { NegotiationHistoryAction } from "../../domain/negociacao/NegotiationHistoryAction";
import {
  NegotiationStatus,
  type NegotiationStatusType,
  deriveNegotiationStage,
  fromProposalDb,
  fromReservationDb,
  fromSaleDb,
} from "../../domain/status";

const NEG_VALUES = new Set<string>(Object.values(NegotiationStatus));

function coerceNegotiationStatus(
  raw: string | null | undefined,
): NegotiationStatusType | null {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase();
  return NEG_VALUES.has(upper) ? (upper as NegotiationStatusType) : null;
}

/**
 * Recalcula e persiste o estágio da negociação a partir dos filhos.
 * Retorna o estágio resultante (novo ou inalterado), ou null se a negociação
 * não existir / tiver status irreconhecível (nesse caso, não toca em nada).
 */
export async function recomputeNegotiationStage(
  negotiationId: string,
): Promise<NegotiationStatusType | null> {
  const supabase = getSupabaseClientOrThrow("recompute negotiation stage");

  const { data: negRow, error: negError } = await supabase
    .from("negotiations")
    .select("status")
    .eq("id", negotiationId)
    .maybeSingle();
  if (negError) {
    throw new Error(`Failed to read negotiation for stage recompute: ${negError.message}`);
  }
  const current = coerceNegotiationStatus(
    (negRow as { status?: string } | null)?.status,
  );
  if (!current) return null;

  const [propsRes, resvRes, salesRes] = await Promise.all([
    supabase.from("proposals").select("status").eq("negotiation_id", negotiationId),
    supabase.from("reservations").select("status").eq("negotiation_id", negotiationId),
    supabase.from("sales").select("status").eq("negotiation_id", negotiationId),
  ]);
  for (const res of [propsRes, resvRes, salesRes]) {
    if (res.error) {
      throw new Error(`Failed to read children for stage recompute: ${res.error.message}`);
    }
  }

  const proposals = ((propsRes.data ?? []) as { status: string }[]).map((r) =>
    fromProposalDb(r.status),
  );
  const reservations = ((resvRes.data ?? []) as { status: string }[]).map((r) =>
    fromReservationDb(r.status),
  );
  const sales = ((salesRes.data ?? []) as { status: string }[]).map((r) =>
    fromSaleDb(r.status),
  );

  const derived = deriveNegotiationStage(current, {
    proposals,
    reservations,
    sales,
  });

  // Idempotência: nada mudou → não grava (não toca updated_at nem histórico).
  if (derived === current) return current;

  await updateNegotiationStatus(negotiationId, derived);
  await createNegotiationHistoryEvent({
    negotiationId,
    fromStatus: current,
    toStatus: derived,
    action: NegotiationHistoryAction.NEGOTIATION_STAGE_CHANGED,
    performedBy: null,
  });
  return derived;
}
