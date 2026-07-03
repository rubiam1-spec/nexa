// Hook do Relatório Individual: faz a busca via repository e concentra TODA a
// agregação/regra (fora da UI). O componente apenas renderiza o que sai daqui.
// VGV é intencionalmente ausente: negotiations não tem coluna de valor confiável.
import { useCallback, useEffect, useState } from "react";
import {
  countNegociacoesSemDono,
  fetchAtividadesIndividual,
  fetchNegociacoesIndividual,
  type AtividadeIndividualRow,
  type NegociacaoIndividualRow,
} from "../repositories/relatorioIndividualSupabaseRepository";
import { ACTIVITY_TYPE_SCHEMA } from "../../atividades/config/activityTypeSchema";
import { getNegotiationStatusLabel } from "../../../domain/negociacao/NegotiationStatusLabel";
import { NegotiationStatus, isNegotiationActive } from "../../../domain/status/negotiation";

export interface RelatorioIndividualData {
  atividades: {
    total: number;
    concluidas: number;
    taxaConclusao: number;
    pendentes: number;
    porTipo: { tipo: string; label: string; count: number }[];
    porSemana: { semana: string; count: number }[];
  };
  negocios: {
    porStatus: { status: string; label: string; count: number }[];
    total: number;
    ativas: number;
    propostas: number;
    reservas: number;
    vendas: number;
    conversao: number;
    vgv?: number; // sempre undefined: sem coluna de valor confiável
    semDono: number;
  };
  meta: { membroNome: string; periodoLabel: string; empreendimentoNome: string };
}

export interface UseRelatorioIndividualInput {
  accountId: string | null;
  developmentId: string | null;
  profileId: string | null;
  membroNome: string;
  empreendimentoNome: string;
  periodoLabel: string;
  fromDate: string; // YYYY-MM-DD — janela de activities.activity_date
  toDate: string; // YYYY-MM-DD
  fromISO: string; // ISO — janela de negotiations.created_at
  toISO: string; // ISO
  enabled?: boolean;
}

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

// Início da semana (segunda-feira) de uma data YYYY-MM-DD → "dd/MM".
function weekStartLabel(isoDate: string): { key: string; label: string } {
  const d = new Date(isoDate + "T00:00:00");
  const day = d.getDay(); // 0=Dom .. 6=Sáb
  const diff = (day + 6) % 7; // dias desde segunda
  d.setDate(d.getDate() - diff);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const key = `${d.getFullYear()}-${mm}-${dd}`;
  return { key, label: `${dd}/${mm}` };
}

function aggregateAtividades(rows: AtividadeIndividualRow[]): RelatorioIndividualData["atividades"] {
  const total = rows.length;
  const concluidas = rows.filter((a) => a.status === "completed").length;
  const skipped = rows.filter((a) => a.status === "skipped").length;
  const pendentes = Math.max(total - concluidas - skipped, 0);

  // Por tipo — rótulos canônicos do módulo de atividades (fonte única).
  const tipoCounts: Record<string, number> = {};
  for (const a of rows) tipoCounts[a.type] = (tipoCounts[a.type] ?? 0) + 1;
  const porTipo = Object.entries(tipoCounts)
    .map(([tipo, count]) => ({
      tipo,
      label: ACTIVITY_TYPE_SCHEMA[tipo]?.label ?? tipo,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  // Evolução semanal — agrupada pela segunda-feira da semana.
  const semanaCounts: Record<string, { label: string; count: number }> = {};
  for (const a of rows) {
    if (!a.activity_date) continue;
    const { key, label } = weekStartLabel(a.activity_date);
    if (!semanaCounts[key]) semanaCounts[key] = { label, count: 0 };
    semanaCounts[key].count++;
  }
  const porSemana = Object.entries(semanaCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({ semana: v.label, count: v.count }));

  return { total, concluidas, taxaConclusao: pct(concluidas, total), pendentes, porTipo, porSemana };
}

function aggregateNegocios(
  rows: NegociacaoIndividualRow[],
  semDono: number,
): RelatorioIndividualData["negocios"] {
  const total = rows.length;
  // status vivo é canônico (garantido pelo CHECK) — comparação estrita, sem normalizar.
  const norm = rows.map((n) => n.status);

  const statusCounts: Record<string, number> = {};
  for (const s of norm) statusCounts[s] = (statusCounts[s] ?? 0) + 1;
  const porStatus = Object.entries(statusCounts)
    .map(([status, count]) => ({
      status,
      label: getNegotiationStatusLabel(status as NegotiationStatus) ?? status,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const ativas = norm.filter((s) => isNegotiationActive(s)).length;
  const propostas = norm.filter((s) => s === NegotiationStatus.PROPOSAL).length;
  const reservas = norm.filter((s) => s === NegotiationStatus.RESERVATION).length;
  const vendas = norm.filter((s) => s === NegotiationStatus.WON).length;

  return {
    porStatus,
    total,
    ativas,
    propostas,
    reservas,
    vendas,
    conversao: pct(vendas, total),
    vgv: undefined,
    semDono,
  };
}

export function useRelatorioIndividual(input: UseRelatorioIndividualInput) {
  const {
    accountId,
    developmentId,
    profileId,
    membroNome,
    empreendimentoNome,
    periodoLabel,
    fromDate,
    toDate,
    fromISO,
    toISO,
    enabled = true,
  } = input;

  const [data, setData] = useState<RelatorioIndividualData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!enabled || !accountId || !developmentId || !profileId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [atvRows, negRows, semDono] = await Promise.all([
        fetchAtividadesIndividual({ accountId, developmentId, profileId, from: fromDate, to: toDate }),
        fetchNegociacoesIndividual({ accountId, developmentId, profileId, from: fromISO, to: toISO }),
        countNegociacoesSemDono({ accountId, developmentId, from: fromISO, to: toISO }),
      ]);
      setData({
        atividades: aggregateAtividades(atvRows),
        negocios: aggregateNegocios(negRows, semDono),
        meta: { membroNome, periodoLabel, empreendimentoNome },
      });
    } catch (err) {
      console.error("[useRelatorioIndividual] load error", err);
      setData(null);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [
    enabled,
    accountId,
    developmentId,
    profileId,
    membroNome,
    empreendimentoNome,
    periodoLabel,
    fromDate,
    toDate,
    fromISO,
    toISO,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const isEmpty =
    !loading &&
    !error &&
    data !== null &&
    data.atividades.total === 0 &&
    data.negocios.total === 0;

  return { data, loading, error, isEmpty, refetch: load };
}
