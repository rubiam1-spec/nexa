import { useState, useMemo, useCallback } from "react";
import type { DevelopmentSettings } from "../../../shared/types/developmentSettings";

export type PermutaItem = {
  id: string;
  tipo: "veiculo" | "terreno" | "imovel";
  valor: number;
  descricao: string;
};

type SimuladorSettings = Pick<
  DevelopmentSettings,
  | "entradaMinimaPct" | "entradaMaximaPct"
  | "entradaParceladaPermitida" | "entradaParceladaMaxVezes"
  | "parcelasMinimas" | "parcelasMaximas"
  | "indicePreEntrega" | "indicePosEntrega" | "dataEntregaEmpreendimento"
  | "carenciaMaximaMeses"
  | "aceitaBalao" | "balaoMaxQuantidade"
  | "aceitaPermuta" | "permutaTipos" | "permutaValorMaximoPct"
  | "descontoMaximoPct" | "comissaoCorretorPct"
>;

const DEFAULTS: SimuladorSettings = {
  entradaMinimaPct: 10, entradaMaximaPct: 80,
  entradaParceladaPermitida: true, entradaParceladaMaxVezes: 12,
  parcelasMinimas: 12, parcelasMaximas: 120,
  indicePreEntrega: "INCC", indicePosEntrega: "IPCA", dataEntregaEmpreendimento: null,
  carenciaMaximaMeses: 6,
  aceitaBalao: true, balaoMaxQuantidade: 12,
  aceitaPermuta: true, permutaTipos: ["veiculo", "terreno", "imovel"], permutaValorMaximoPct: 30,
  descontoMaximoPct: 5, comissaoCorretorPct: 4,
};

let permutaIdCounter = 0;

// ── Campo fixado: tracks which EQUILIBRIUM field was last manually edited ──
// Note: "entrada" mode (pct vs valor fixo) is tracked separately via entradaModoValor
export type CampoFixado = "parcela" | "balao" | null;

export function useSimulador(settings: SimuladorSettings | null, valorUnidade: number) {
  const s = settings ?? DEFAULTS;

  const [entradaPct, setEntradaPctRaw] = useState(Math.max(s.entradaMinimaPct, 20));
  const [entradaParcelada, setEntradaParcelada] = useState(false);
  const [entradaParceladaVezes, setEntradaParceladaVezes] = useState(1);
  const [numeroParcelas, setNumeroParcelasRaw] = useState(Math.max(s.parcelasMinimas, 36));
  const [carenciaAtiva, setCarenciaAtiva] = useState(false);
  const [carenciaMeses, setCarenciaMeses] = useState(0);
  const [balaoAtivo, setBalaoAtivoRaw] = useState(false);
  const [balaoQuantidade, setBalaoQuantidadeRaw] = useState(1);
  const [balaoValor, setBalaoValorRaw] = useState(0);
  const [permutaAtiva, setPermutaAtiva] = useState(false);
  const [permutaItens, setPermutaItens] = useState<PermutaItem[]>([]);
  const [descontoAtivo, setDescontoAtivo] = useState(false);
  const [descontoPct, setDescontoPct] = useState(0);

  // ── Equilibrium state ──
  const [campoFixado, setCampoFixado] = useState<CampoFixado>(null);
  const [parcelaValorFixo, setParcelaValorFixo] = useState(0);

  // ── Entry mode: independent from parcela/balão fixation ──
  const [entradaModoValor, setEntradaModoValor] = useState(false);
  const [entradaValorFixo, setEntradaValorFixo] = useState(0);

  // ── Wrapped setters ──
  const setEntradaPct = useCallback((v: number) => {
    setEntradaPctRaw(v);
    setEntradaModoValor(false);
    setEntradaValorFixo(0);
    // Do NOT clear campoFixado — parcela/balão fixation is independent
  }, []);

  const setNumeroParcelas = useCallback((v: number) => {
    setNumeroParcelasRaw(v);
    // If parcela was fixed, keep it fixed (changing quantity with fixed price)
    // Otherwise default flow
    if (parcelaValorFixo <= 0) setCampoFixado(null);
  }, [parcelaValorFixo]);

  const setBalaoAtivo = useCallback((v: boolean) => {
    setBalaoAtivoRaw(v);
    if (!v) setCampoFixado((prev) => prev === "balao" ? null : prev);
  }, []);

  const setBalaoQuantidade = useCallback((v: number) => {
    setBalaoQuantidadeRaw(v);
    if (campoFixado !== "parcela") setCampoFixado("balao");
  }, [campoFixado]);

  const setBalaoValor = useCallback((v: number) => {
    setBalaoValorRaw(v);
    setCampoFixado("balao");
  }, []);

  // ── Explicit fix handlers ──
  const fixarParcelaValor = useCallback((valor: number) => {
    if (valor > 0) {
      setParcelaValorFixo(valor);
      setCampoFixado("parcela");
    } else {
      setParcelaValorFixo(0);
      setCampoFixado(null);
    }
  }, []);

  const fixarEntradaValor = useCallback((valor: number, valorNegociado: number) => {
    if (valorNegociado > 0 && valor >= 0) {
      const pct = Math.min(100, Math.max(0, (valor / valorNegociado) * 100));
      setEntradaPctRaw(Math.round(pct * 100) / 100);
      setEntradaModoValor(true);
      setEntradaValorFixo(valor);
      // Do NOT touch campoFixado or parcelaValorFixo — they are independent
    }
  }, []);

  const limparFixacao = useCallback(() => {
    setCampoFixado(null);
    setParcelaValorFixo(0);
  }, []);

  const addPermutaItem = useCallback(() => {
    permutaIdCounter++;
    setPermutaItens((prev) => [...prev, {
      id: `p_${permutaIdCounter}_${Date.now()}`,
      tipo: (s.permutaTipos[0] as PermutaItem["tipo"]) ?? "veiculo",
      valor: 0,
      descricao: "",
    }]);
  }, [s.permutaTipos]);

  const removePermutaItem = useCallback((id: string) => {
    setPermutaItens((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updatePermutaItem = useCallback((id: string, field: keyof Omit<PermutaItem, "id">, value: string | number) => {
    setPermutaItens((prev) => prev.map((item) =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  }, []);

  // ── Equilibrium engine ──
  const calculos = useMemo(() => {
    const valorOriginal = valorUnidade;
    const desconto = descontoAtivo ? (valorOriginal * descontoPct) / 100 : 0;
    const valorNegociado = valorOriginal - desconto;
    const totalPermuta = permutaAtiva ? permutaItens.reduce((acc, item) => acc + item.valor, 0) : 0;

    // Start with base values from state
    // When in fixed-value mode, use the exact value the user typed — don't recalculate from %
    let entradaValorEfetivo = entradaModoValor && entradaValorFixo > 0
      ? entradaValorFixo
      : (valorNegociado * entradaPct) / 100;
    let entradaPctEfetivo = valorNegociado > 0 ? (entradaValorEfetivo / valorNegociado) * 100 : entradaPct;
    let parcelaValorEfetivo: number;
    let balaoValorEfetivo = balaoValor;
    let totalBalaosEfetivo = balaoAtivo ? balaoQuantidade * balaoValor : 0;
    let saldoFinanciar: number;

    if (campoFixado === "parcela" && parcelaValorFixo > 0) {
      // ── Parcela is FIXED — redistribute remainder ──
      parcelaValorEfetivo = parcelaValorFixo;
      const totalParcelas = parcelaValorFixo * numeroParcelas;
      const saldoRestante = valorNegociado - entradaValorEfetivo - totalParcelas - totalPermuta;

      if (balaoAtivo && balaoQuantidade > 0) {
        // Redistribute to balão
        balaoValorEfetivo = Math.max(0, saldoRestante / balaoQuantidade);
        totalBalaosEfetivo = balaoValorEfetivo * balaoQuantidade;
      } else {
        // Redistribute to entrada
        entradaValorEfetivo = Math.max(0, valorNegociado - totalParcelas - totalPermuta);
        entradaPctEfetivo = valorNegociado > 0 ? (entradaValorEfetivo / valorNegociado) * 100 : 0;
      }
      saldoFinanciar = totalParcelas;
    } else if (campoFixado === "balao" && balaoAtivo) {
      // ── Balão is FIXED — parcela absorbs ──
      totalBalaosEfetivo = balaoQuantidade * balaoValor;
      balaoValorEfetivo = balaoValor;
      saldoFinanciar = Math.max(0, valorNegociado - entradaValorEfetivo - totalPermuta - totalBalaosEfetivo);
      parcelaValorEfetivo = numeroParcelas > 0 ? saldoFinanciar / numeroParcelas : 0;
    } else {
      // ── Default flow: parcela = saldo / numParcelas ──
      saldoFinanciar = Math.max(0, valorNegociado - entradaValorEfetivo - totalPermuta - totalBalaosEfetivo);
      parcelaValorEfetivo = numeroParcelas > 0 ? saldoFinanciar / numeroParcelas : 0;
    }

    const entradaParceladaValor = entradaParcelada && entradaParceladaVezes > 0
      ? entradaValorEfetivo / entradaParceladaVezes : 0;
    const comissaoValor = (valorNegociado * s.comissaoCorretorPct) / 100;

    // ── Consistency check ──
    const totalComposicao = entradaValorEfetivo + saldoFinanciar + totalPermuta + totalBalaosEfetivo;
    const diferenca = Math.abs(totalComposicao - valorNegociado);
    const somaConsistente = diferenca < 1;

    // ── Validations ──
    const entradaAbaixoMinimo = entradaPctEfetivo > 0 && entradaPctEfetivo < s.entradaMinimaPct;
    const entradaAcimaMaximo = entradaPctEfetivo > s.entradaMaximaPct;
    const parcelasForaRange = numeroParcelas > 0 && (numeroParcelas < s.parcelasMinimas || numeroParcelas > s.parcelasMaximas);
    const descontoAcimaLimite = descontoAtivo && descontoPct > s.descontoMaximoPct;
    const permutaAcimaLimite = permutaAtiva && totalPermuta > (valorNegociado * s.permutaValorMaximoPct) / 100;
    const valorNegativo = parcelaValorEfetivo < 0 || entradaValorEfetivo < 0 || balaoValorEfetivo < 0;

    let indiceAtual = s.indicePreEntrega;
    let indiceLabel = "";
    if (s.dataEntregaEmpreendimento) {
      const entrega = new Date(s.dataEntregaEmpreendimento);
      if (entrega < new Date()) {
        indiceAtual = s.indicePosEntrega;
        indiceLabel = `Pos-entrega: ${indiceAtual}`;
      } else {
        indiceLabel = `${s.indicePreEntrega} → ${s.indicePosEntrega}`;
      }
    }

    const aVista = numeroParcelas === 0;
    const saldoAVista = aVista ? saldoFinanciar : 0;

    return {
      valorOriginal, desconto, valorNegociado,
      // Effective values (may differ from raw state when equilibrium is active)
      entradaValor: entradaValorEfetivo,
      entradaPctEfetivo,
      entradaParceladaValor,
      saldoFinanciar,
      saldoAVista,
      aVista,
      parcelaValor: parcelaValorEfetivo,
      totalBalaos: totalBalaosEfetivo,
      balaoValorEfetivo,
      totalPermuta, comissaoValor,
      indiceAtual, indiceLabel,
      // Consistency
      totalComposicao,
      diferenca,
      validacoes: {
        entradaAbaixoMinimo, entradaAcimaMaximo,
        parcelasForaRange, descontoAcimaLimite, permutaAcimaLimite,
        somaConsistente, valorNegativo,
        temErro: entradaAbaixoMinimo || entradaAcimaMaximo || parcelasForaRange || descontoAcimaLimite || permutaAcimaLimite || valorNegativo,
      },
    };
  }, [
    valorUnidade, entradaPct, numeroParcelas,
    descontoAtivo, descontoPct,
    entradaParcelada, entradaParceladaVezes,
    balaoAtivo, balaoQuantidade, balaoValor,
    permutaAtiva, permutaItens, s,
    campoFixado, parcelaValorFixo, entradaModoValor, entradaValorFixo,
  ]);

  return {
    entradaPct, setEntradaPct,
    entradaParcelada, setEntradaParcelada,
    entradaParceladaVezes, setEntradaParceladaVezes,
    numeroParcelas, setNumeroParcelas,
    carenciaAtiva, setCarenciaAtiva,
    carenciaMeses, setCarenciaMeses,
    balaoAtivo, setBalaoAtivo,
    balaoQuantidade, setBalaoQuantidade,
    balaoValor, setBalaoValor,
    permutaAtiva, setPermutaAtiva,
    permutaItens, setPermutaItens,
    addPermutaItem, removePermutaItem, updatePermutaItem,
    descontoAtivo, setDescontoAtivo,
    descontoPct, setDescontoPct,
    // Equilibrium
    campoFixado,
    fixarParcelaValor,
    fixarEntradaValor,
    limparFixacao,
    // Entry mode (independent from parcela/balão fixation)
    entradaModoValor,
    entradaValorFixo,
    calculos,
  };
}
