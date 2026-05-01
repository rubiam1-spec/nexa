import { useMemo } from "react";
import { NegotiationStatus } from "../../../domain/negociacao/NegotiationStatus";
import { UnidadeStatus } from "../../../domain/unidade/UnidadeStatus";
import type { Negotiation } from "../../../shared/types/negotiation";
import type { Unidade } from "../../../domain/unidade/Unidade";
import { formatDateBRT } from "../../../shared/utils/dateUtils";

export interface AcaoHoje {
  id: string;
  tipo: "urgente" | "atencao" | "acao" | "ok";
  texto: string;
  subtexto?: string;
  cta: string;
  ctaTipo: "verde" | "amarelo" | "azul" | "neutro";
  negId: string;
}

export interface VelocidadeItem {
  estagio: string;
  label: string;
  diasMedio: number;
  isGargalo: boolean;
  cor: string;
}

function diasDesde(d: Date): number { return Math.floor((Date.now() - d.getTime()) / 86400000); }

export function usePipelineIntelligence(negotiations: Negotiation[], units: Unidade[], nome: string) {
  const acoesHoje = useMemo((): AcaoHoje[] => {
    const acoes: AcaoHoje[] = [];
    negotiations.forEach((n) => {
      const u = units.find((x) => x.id === n.unitId);
      const ul = u ? `Q${u.quadra}·L${u.lote}` : "";
      const dias = diasDesde(n.updatedAt);

      // Negociações paradas > 7 dias
      if (n.status !== NegotiationStatus.WON && n.status !== NegotiationStatus.CANCELLED && dias >= 7) {
        acoes.push({ id: `parada-${n.id}`, tipo: "atencao", texto: `${ul} — ${dias} dias sem atividade`, subtexto: `Negociação parada desde ${formatDateBRT(n.updatedAt)}`, cta: "Retomar", ctaTipo: "amarelo", negId: n.id });
      }

      // Unidades reservadas (indicativo de urgência)
      if (u?.status === UnidadeStatus.RESERVADO && n.status === NegotiationStatus.IN_PROGRESS) {
        acoes.push({ id: `reserva-${n.id}`, tipo: "urgente", texto: `${ul} — reservada, registre a venda`, subtexto: "Unidade bloqueada. Conclua ou renove.", cta: "Ver negociação", ctaTipo: "verde", negId: n.id });
      }
    });

    const ordem = { urgente: 0, atencao: 1, acao: 2, ok: 3 };
    return acoes.sort((a, b) => ordem[a.tipo] - ordem[b.tipo]).slice(0, 5);
  }, [negotiations, units]);

  const velocidade = useMemo((): VelocidadeItem[] => {
    const tempos: Record<string, number[]> = { simulacao: [], negociacao: [], proposta: [], reserva: [], venda: [] };
    negotiations.forEach((n) => {
      const u = units.find((x) => x.id === n.unitId);
      const dias = diasDesde(n.updatedAt);
      if (dias <= 0 || dias >= 90) return;
      if (n.status === NegotiationStatus.WON || u?.status === UnidadeStatus.VENDIDO) tempos.venda.push(dias);
      else if (u?.status === UnidadeStatus.RESERVADO) tempos.reserva.push(dias);
      else if (n.status === NegotiationStatus.IN_PROGRESS) tempos.negociacao.push(dias);
      else if (n.status === NegotiationStatus.OPEN) tempos.simulacao.push(dias);
    });
    const avg = (a: number[]) => a.length ? parseFloat((a.reduce((s, v) => s + v, 0) / a.length).toFixed(1)) : 0;
    const items = [
      { estagio: "simulacao", label: "Simulação", cor: "#9C9686", diasMedio: avg(tempos.simulacao), isGargalo: false },
      { estagio: "negociacao", label: "Negociação", cor: "#60A5FA", diasMedio: avg(tempos.negociacao), isGargalo: false },
      { estagio: "proposta", label: "Proposta", cor: "#FBBF24", diasMedio: avg(tempos.proposta), isGargalo: false },
      { estagio: "reserva", label: "Reserva", cor: "#A78BFA", diasMedio: avg(tempos.reserva), isGargalo: false },
      { estagio: "venda", label: "Venda", cor: "#4ADE80", diasMedio: avg(tempos.venda), isGargalo: false },
    ];
    const maxD = Math.max(...items.filter((i) => i.diasMedio > 0).map((i) => i.diasMedio), 0);
    items.forEach((i) => { if (i.diasMedio === maxD && maxD > 3) i.isGargalo = true; });
    return items;
  }, [negotiations, units]);

  const saudacao = useMemo(() => {
    const h = new Date().getHours();
    const first = nome.split(" ")[0];
    if (h < 12) return `Bom dia, ${first}.`;
    if (h < 18) return `Boa tarde, ${first}.`;
    return `Boa noite, ${first}.`;
  }, [nome]);

  return { acoesHoje, velocidade, saudacao };
}
