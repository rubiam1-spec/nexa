// L1.6 — Pré-funil de LEADS: funções PURAS e testáveis (nunca no .tsx).
// Fonte única = linhas mínimas de lead (getLeadFunnelRows). Duas leituras:
//   1. SNAPSHOT (agora): novos (NEW) → em atendimento (IN_SERVICE + QUALIFIED).
//      ativos = novos + emAtendimento — idêntico a countActiveLeads por construção.
//   2. CONVERSÃO DE ENTRADA (coorte por período): dentre os leads CRIADOS no
//      período, quantos já estão convertidos → taxa "Leads → Negociações".
// HONESTIDADE: sem base (nenhum lead criado no período) → taxa = null → UI "—".
import {
  LeadQualificationStatus,
  type LeadQualificationStatus as LeadQualificationStatusType,
} from "../../../domain/status/leadQualification";

export type LeadFunnelRow = {
  createdAt: string;
  qualification: LeadQualificationStatusType;
};

export type LeadSnapshot = {
  novos: number;
  emAtendimento: number;
  /** Ativos = novos + emAtendimento (mesma definição de isLeadActive). */
  ativos: number;
};

export function computeLeadSnapshot(rows: LeadFunnelRow[]): LeadSnapshot {
  let novos = 0;
  let emAtendimento = 0;
  for (const r of rows) {
    if (r.qualification === LeadQualificationStatus.NEW) novos += 1;
    else if (
      r.qualification === LeadQualificationStatus.IN_SERVICE ||
      r.qualification === LeadQualificationStatus.QUALIFIED
    ) {
      emAtendimento += 1;
    }
  }
  return { novos, emAtendimento, ativos: novos + emAtendimento };
}

export type EntryConversion = {
  leadsCriados: number;
  convertidos: number;
  /** convertidos ÷ leadsCriados no período (0..1), ou null se não há base. */
  taxa: number | null;
};

/**
 * Conversão de entrada por COORTE: leads com createdAt >= startMs.
 * Numerador = os que já estão CONVERTED. Espelha a coorte do funil de negociação.
 */
export function computeEntryConversion(rows: LeadFunnelRow[], startMs: number): EntryConversion {
  let leadsCriados = 0;
  let convertidos = 0;
  for (const r of rows) {
    const t = new Date(r.createdAt).getTime();
    if (!Number.isFinite(t) || t < startMs) continue;
    leadsCriados += 1;
    if (r.qualification === LeadQualificationStatus.CONVERTED) convertidos += 1;
  }
  return { leadsCriados, convertidos, taxa: leadsCriados > 0 ? convertidos / leadsCriados : null };
}
