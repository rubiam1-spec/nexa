import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { useAuth } from "../../../app/contexts/AuthContext";
import { useUnits } from "../../units/hooks/useUnits";
import { useClients } from "../../clientes/hooks/useClients";
import { useClientFilter } from "../../../shared/hooks/useClientFilter";
import { useBrokers } from "../../corretores/hooks/useBrokers";
import { useCommercialSettings } from "../../configuracoes/hooks/useCommercialSettings";
import { UnidadeStatus } from "../../../domain/unidade/UnidadeStatus";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import { useSimulador } from "../hooks/useSimulador";
import { gerarPdfSimulacao } from "../utils/gerarPdfSimulacao";
import { useEnviarParaPipeline } from "../hooks/useEnviarParaPipeline";
import FollowUpModal from "../../../shared/components/FollowUpModal";
import { createClient } from "../../../infra/repositories/clientsSupabaseRepository";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { useThirdPartyProperties, type ThirdPartyProperty } from "../../imoveis/hooks/useThirdPartyProperties";
// ConfirmacaoNegociacaoModal removed — two-button flow replaces it
import { getSaldoLabel } from "../utils/getSaldoLabel";
import { useUnitQueue } from "../../units/hooks/useUnitQueue";
import QueueEntryModal from "../../../shared/components/QueueEntryModal";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PERMUTA_LABELS: Record<string, string> = { veiculo: "Veículo", terreno: "Terreno", imovel: "Imóvel" };

export default function SimuladorPage() {
  const [qp] = useSearchParams();
  const { account } = useAccount();
  const { development } = useDevelopment();
  const { authenticatedProfile } = useAuth();
  const screen = useScreen();
  const isMobile = !screen.isDesktop; // below 1024: single column + floating bar

  const accountId = account?.accountId ?? null;
  const developmentId = development?.developmentId ?? null;
  const userRole = authenticatedProfile?.role ?? null;

  const { units, isLoading: isLoadingUnits } = useUnits(accountId, developmentId, false);
  const ss = useCommercialSettings(accountId, developmentId, false, userRole);
  const { developmentSettings: s, isLoading: isLoadingSettings } = ss;
  const clientFilter = useClientFilter();
  const { clients, refetch: refetchClients } = useClients(accountId, false, clientFilter);
  const { brokers } = useBrokers(accountId, false);

  const availableUnits = units.filter((u) => u.status === UnidadeStatus.DISPONIVEL && u.valor > 0);
  const allUnitsWithValue = units.filter((u) => u.valor > 0);
  const queueEnabled = s?.queueEnabled === true;
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [tipoAtivo, setTipoAtivo] = useState<"unidade" | "imovel">("unidade");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const { properties: tppList } = useThirdPartyProperties(accountId);
  const availableProperties = tppList.filter((p) => p.status === "disponivel" || p.status === "em_negociacao");
  const selectedProperty: ThirdPartyProperty | null = availableProperties.find((p) => p.id === selectedPropertyId) ?? null;

  // Detect query param for third-party property
  useEffect(() => {
    if (qp.get("tipo") === "imovel_terceiro") {
      setTipoAtivo("imovel");
      const pid = qp.get("property_id");
      if (pid) setSelectedPropertyId(pid);
    }
  }, [qp]);

  const [restoredSimId, setRestoredSimId] = useState<string | null>(null);
  const [editingSimulationId, setEditingSimulationId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    const uid = qp.get("unitId");
    if (uid && units.length > 0 && !selectedUnitId) {
      const u = units.find((x) => x.id === uid);
      if (u) setSelectedUnitId(u.id);
    }
  }, [qp, units.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore simulation parameters from simulationId
  useEffect(() => {
    const simId = qp.get("simulationId");
    if (!simId || !supabase || units.length === 0 || restoredSimId === simId) return;
    setIsRestoring(true);
    void (async () => {
      const { data } = await supabase.from("pipeline_simulations")
        .select("id, unit_id, client_id, broker_id, valor_total, entrada_percentual, entrada_valor, parcelas_quantidade, parcelas_valor, balao_quantidade, balao_valor, permuta_valor, permuta_descricao")
        .eq("id", simId).maybeSingle();
      if (!data) { setIsRestoring(false); return; }
      // Set unit first
      setSelectedUnitId(data.unit_id);
      // Defer parameter restoration to allow unit state to propagate
      setTimeout(() => {
        if (data.entrada_percentual != null) sim.setEntradaPct(Number(data.entrada_percentual));
        if (data.parcelas_quantidade != null) sim.setNumeroParcelas(Number(data.parcelas_quantidade));
        if (data.balao_quantidade && data.balao_valor) {
          sim.setBalaoAtivo(true);
          sim.setBalaoQuantidade(Number(data.balao_quantidade));
          sim.setBalaoValor(Number(data.balao_valor));
        } else {
          sim.setBalaoAtivo(false);
        }
        if (data.permuta_valor && Number(data.permuta_valor) > 0) {
          sim.setPermutaAtiva(true);
          sim.setPermutaItens([{ id: "restored_1", tipo: "imovel", valor: Number(data.permuta_valor), descricao: data.permuta_descricao || "" }]);
        } else {
          sim.setPermutaAtiva(false);
        }
        if (data.client_id) setPdfClienteId(data.client_id);
        if (data.broker_id) setPdfCorretorId(data.broker_id);
        setEditingSimulationId(simId);
        setRestoredSimId(simId);
        // Release restoration lock after state propagates
        setTimeout(() => setIsRestoring(false), 300);
      }, 200);
    })();
  }, [qp, units.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedUnit = units.find((u) => u.id === selectedUnitId) ?? null;
  const valorUnidade = tipoAtivo === "imovel" ? (selectedProperty?.valorVenda ?? 0) : (selectedUnit?.valor ?? 0);
  const sim = useSimulador(s, valorUnidade);
  const { calculos: c } = sim;

  // Queue awareness
  const unitQueue = useUnitQueue(queueEnabled && selectedUnitId ? selectedUnitId : null, accountId, developmentId);
  const unitIsUnavailable = selectedUnit && selectedUnit.status !== UnidadeStatus.DISPONIVEL;
  const [queueFeedback, setQueueFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const userId = authenticatedProfile?.id ?? null;
  const myQueueEntry = userId ? unitQueue.queue.find((q) => q.requested_by === userId) : null;

  const showComissao = userRole === "broker" || userRole === "commercial_consultant";
  const isLoading = isLoadingUnits || isLoadingSettings;
  const isConsistente = c.validacoes.somaConsistente && !c.validacoes.temErro;

  const [pdfClienteId, setPdfClienteId] = useState("");
  const [pdfCorretorId, setPdfCorretorId] = useState("");
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const [resumoAberto, setResumoAberto] = useState(false);

  // Quick client creation
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [savingClient, setSavingClient] = useState(false);
  const [clientErr, setClientErr] = useState<string | null>(null);
  const { salvarComoSimulacao, iniciarNegociacao, salvando, iniciando, erro: erroEnvio, setErro: setErroEnvio, sucesso: sucessoEnvio } = useEnviarParaPipeline(accountId, developmentId);
  const [showFollowUp, setShowFollowUp] = useState(false);

  // handleCriarProposta replaced by handleEnviarPipeline

  const handleGerarPdf = useCallback(async () => {
    if (!selectedUnit) return;
    setGerandoPDF(true);
    try {
      const cl = clients.find((x) => x.id === pdfClienteId);
      const br = brokers.find((x) => x.id === pdfCorretorId);
      const as_ = ss?.accountSettings;
      await gerarPdfSimulacao({
        contaNome: as_?.nomeComercial || account?.accountName || "NEXA",
        empreendimentoNome: development?.developmentName ?? "",
        quadra: selectedUnit.quadra, lote: selectedUnit.lote,
        valorOriginal: c.valorOriginal, desconto: c.desconto, descontoPct: sim.descontoPct, valorNegociado: c.valorNegociado,
        entradaValor: c.entradaValor, entradaPct: Math.round(c.entradaPctEfetivo), entradaParcelada: sim.entradaParcelada, entradaParceladaVezes: sim.entradaParceladaVezes, entradaParceladaValor: c.entradaParceladaValor,
        numeroParcelas: sim.numeroParcelas, parcelaValor: c.parcelaValor, indiceLabel: c.indiceLabel,
        carenciaAtiva: sim.carenciaAtiva, carenciaMeses: sim.carenciaMeses,
        balaoAtivo: sim.balaoAtivo, balaoQuantidade: sim.balaoQuantidade, balaoValor: c.balaoValorEfetivo, totalBalaos: c.totalBalaos,
        permutaAtiva: sim.permutaAtiva, permutaItens: sim.permutaItens, totalPermuta: c.totalPermuta, saldoFinanciar: c.saldoFinanciar,
        tipoSaldo: s?.tipoSaldo ?? "parcelas_incorporadora", textoSaldoPersonalizado: s?.textoSaldoPersonalizado ?? null,
        clienteNome: cl?.name, corretorNome: br?.name,
        logoUrl: as_?.logoUrl, corPrimaria: as_?.corPrimaria, corSecundaria: as_?.corSecundaria,
        fraseImpactoPdf: s?.pdfFraseRodape || as_?.fraseImpactoPdf,
        logoEmpreendimentoUrl: s?.logoEmpreendimentoUrl,
        tituloProposta: s?.pdfTitulo || as_?.tituloProposta,
        bulletPdf1: s?.pdfBullet1 || as_?.bulletPdf1, bulletPdf2: s?.pdfBullet2 || as_?.bulletPdf2, bulletPdf3: s?.pdfBullet3 || as_?.bulletPdf3,
        pdfDisclaimer: s?.pdfDisclaimer, pdfValidadeHoras: s?.pdfValidadeHoras,
        textoParcelamento: s?.pdfTextoParcelamento,
      });
    } finally { setGerandoPDF(false); }
  }, [selectedUnit, c, sim, s, ss, account, development, clients, brokers, pdfClienteId, pdfCorretorId]);

  const montarInput = useCallback(() => ({
    unitId: selectedUnitId, clientId: pdfClienteId || null, brokerId: pdfCorretorId || null,
    valorTotal: c.valorNegociado, entradaPercentual: Math.round(c.entradaPctEfetivo * 100) / 100, entradaValor: c.entradaValor,
    parcelasQuantidade: sim.numeroParcelas, parcelasValor: c.parcelaValor,
    balaoQuantidade: sim.balaoAtivo ? sim.balaoQuantidade : undefined, balaoValor: sim.balaoAtivo ? c.balaoValorEfetivo : undefined,
    permutaValor: sim.permutaAtiva ? c.totalPermuta : undefined,
    editingSimulationId,
  }), [selectedUnitId, pdfClienteId, pdfCorretorId, c, sim, editingSimulationId]);

  async function handleCreateClient() {
    if (!accountId || !newClientName.trim() || !newClientEmail.trim() || !newClientPhone.trim()) return;
    setSavingClient(true); setClientErr(null);
    try {
      const c = await createClient({ accountId, name: newClientName.trim(), email: newClientEmail.trim(), phone: newClientPhone.trim(), city: "", createdBy: authenticatedProfile?.id });
      setPdfClienteId(c.id);
      setShowNewClient(false); setNewClientName(""); setNewClientEmail(""); setNewClientPhone("");
      refetchClients();
    } catch (e: unknown) { setClientErr(e instanceof Error ? e.message : "Falha ao criar cliente."); }
    finally { setSavingClient(false); }
  }

  function limpar() {
    setSelectedUnitId(""); setEditingSimulationId(null); sim.setEntradaPct(s?.entradaMinimaPct ?? 20);
    sim.setEntradaParcelada(false); sim.setEntradaParceladaVezes(1); sim.setNumeroParcelas(s?.parcelasMinimas ?? 36);
    sim.setCarenciaAtiva(false); sim.setCarenciaMeses(0); sim.setBalaoAtivo(false); sim.setBalaoQuantidade(1); sim.setBalaoValor(0);
    sim.setPermutaAtiva(false); sim.setPermutaItens([]); sim.setDescontoAtivo(false); sim.setDescontoPct(0);
    sim.limparFixacao();
    setPdfClienteId(""); setPdfCorretorId("");
  }

  const limites = { parMin: s?.parcelasMinimas ?? 12, parMax: s?.parcelasMaximas ?? 120, entMin: s?.entradaMinimaPct ?? 10, entMax: s?.entradaMaximaPct ?? 80 };
  const entForaRange = c.validacoes.entradaAbaixoMinimo || c.validacoes.entradaAcimaMaximo;
  const saldoLabel = getSaldoLabel(s);

  if (isLoading || isRestoring) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}><div style={{ color: "#4ADE80", fontFamily: "var(--font-mono)", fontSize: 13 }}>{isRestoring ? "Restaurando simulação..." : "Carregando unidades..."}</div></div>;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-secondary)", margin: 0 }}>Simulador Comercial</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0" }}>{development?.developmentName} · {allUnitsWithValue.length} unidades · {availableUnits.length} disponíveis</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 360px", gap: 20, alignItems: "start" }}>
        {/* Controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* 1. Ativo */}
          <SC><SL>1 · Qual ativo?</SL>
            {/* Tipo de ativo toggle */}
            <div style={{ display: "flex", gap: 2, background: "var(--surface-base)", border: "1px solid var(--border-strong)", borderRadius: 8, padding: 3, marginBottom: 12 }}>
              {([["unidade", "Unidade do empreendimento"], ["imovel", "Imóvel de terceiro"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => { setTipoAtivo(k); if (k === "unidade") setSelectedPropertyId(""); else setSelectedUnitId(""); }} style={{ flex: 1, padding: "7px 10px", borderRadius: 6, border: "none", background: tipoAtivo === k ? "var(--interactive-primary)" : "transparent", color: tipoAtivo === k ? "var(--interactive-on-primary)" : "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>{l}</button>
              ))}
            </div>

            {tipoAtivo === "unidade" ? (
            <select value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value)} style={SEL_S}>
              <option value="">Selecione uma unidade...</option>
              {Array.from(new Set(allUnitsWithValue.map((u) => u.quadra))).sort().map((q) => (
                <optgroup key={q} label={`Quadra ${q}`}>
                  {allUnitsWithValue.filter((u) => u.quadra === q).sort((a, b) => { const na = parseInt(a.lote), nb = parseInt(b.lote); return !isNaN(na) && !isNaN(nb) ? na - nb : a.lote.localeCompare(b.lote); }).map((u) => {
                    const statusTag = u.status === UnidadeStatus.RESERVADO ? " · RESERVADA" : u.status === UnidadeStatus.VENDIDO ? " · VENDIDA" : u.status === UnidadeStatus.EM_NEGOCIACAO ? " · EM NEGOCIAÇÃO" : "";
                    return <option key={u.id} value={u.id}>Lote {u.lote} — {fmt(u.valor)}{statusTag}</option>;
                  })}
                </optgroup>
              ))}
            </select>
            ) : (
            <>
              <select value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)} style={SEL_S}>
                <option value="">Selecione um imóvel...</option>
                {availableProperties.map((p) => <option key={p.id} value={p.id}>{p.titulo}{p.cidade ? ` · ${p.cidade}` : ""}{p.valorVenda ? ` — ${fmt(p.valorVenda)}` : ""}</option>)}
              </select>
              {selectedProperty && (
                <div style={{ marginTop: 12, padding: 14, background: "var(--surface-base)", borderRadius: 8, border: "1px solid var(--border-default)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                    <MS label="IMÓVEL" value={selectedProperty.titulo} />
                    <MS label="VALOR" value={fmt(selectedProperty.valorVenda ?? 0)} green />
                    {selectedProperty.tipo && <MS label="TIPO" value={selectedProperty.tipo.charAt(0).toUpperCase() + selectedProperty.tipo.slice(1)} />}
                    {selectedProperty.areaM2 ? <MS label="ÁREA" value={`${selectedProperty.areaM2.toLocaleString("pt-BR")} m²`} /> : null}
                  </div>
                  {(selectedProperty.entradaMinimaPct > 0 || selectedProperty.parcelasMax > 1 || selectedProperty.descontoAvistaPct > 0) && (
                    <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(74,222,128,0.06)", borderRadius: 6, border: "1px solid rgba(74,222,128,0.15)", fontSize: 11, color: "var(--text-muted)" }}>
                      Condições: {selectedProperty.entradaMinimaPct > 0 ? `entrada mín. ${selectedProperty.entradaMinimaPct}%` : ""}{selectedProperty.parcelasMax > 1 ? ` · até ${selectedProperty.parcelasMax}×` : ""}{selectedProperty.descontoAvistaPct > 0 ? ` · ${selectedProperty.descontoAvistaPct}% desc. à vista` : ""}
                    </div>
                  )}
                </div>
              )}
            </>
            )}
            {selectedUnit ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 14, padding: 14, background: "var(--surface-base)", borderRadius: 8 }}>
                <MS label="LOCALIZAÇÃO" value={`Q${selectedUnit.quadra} · L${selectedUnit.lote}`} />
                <MS label="VALOR DE TABELA" value={fmt(selectedUnit.valor)} green />
              </div>
            ) : null}
            {/* Queue warning for unavailable units */}
            {unitIsUnavailable && queueEnabled && (
              myQueueEntry && !queueFeedback ? (
                <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.25)", marginTop: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#4ADE80" }}>Você está na posição #{myQueueEntry.position} da fila de espera.</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Você será notificado quando a unidade for liberada.</div>
                </div>
              ) : (
                <div style={{ padding: "14px 16px", borderRadius: 10, background: "#FBBF2410", border: "1px solid #FBBF2430", marginTop: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#FBBF24", marginBottom: 4 }}>
                    Esta unidade está {selectedUnit.status === UnidadeStatus.RESERVADO ? "reservada" : selectedUnit.status === UnidadeStatus.VENDIDO ? "vendida" : "em negociação"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                    {queueFeedback ? queueFeedback.message : selectedUnit.status === UnidadeStatus.RESERVADO ? "A reserva pode expirar. Você pode entrar na fila de espera." : "Você pode entrar na fila caso o negócio não se concretize."}
                  </div>
                  {!queueFeedback && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" onClick={() => setShowQueueModal(true)} style={{ padding: "8px 18px", borderRadius: 8, background: "var(--interactive-primary)", color: "var(--interactive-on-primary)", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>Entrar na fila</button>
                      <button type="button" onClick={() => setSelectedUnitId("")} style={{ padding: "8px 18px", borderRadius: 8, background: "transparent", color: "var(--text-muted)", fontSize: 13, border: "1px solid var(--border-default)", cursor: "pointer" }}>Escolher outra</button>
                    </div>
                  )}
                  {queueFeedback && <div style={{ fontSize: 12, color: queueFeedback.type === "success" ? "#4ADE80" : "#F87171" }}>{queueFeedback.message}</div>}
                </div>
              )
            )}
          </SC>

          {/* 2. Entrada */}
          <SC style={{ opacity: (selectedUnit || selectedProperty) ? 1 : 0.4, pointerEvents: (selectedUnit || selectedProperty) ? "auto" : "none" }}>
            <SL>2 · Valor de entrada</SL>
            <Slider label="Percentual" value={Math.round(c.entradaPctEfetivo)} min={0} max={limites.entMax} onChange={sim.setEntradaPct} suffix="%" hint={selectedUnit ? fmt(c.entradaValor) : undefined} error={entForaRange} />
            {selectedUnit && c.valorNegociado > 0 && (
              <div style={{ marginTop: 10 }}>
                <label style={LBL_S}>Ou digite o valor da entrada (R$){sim.entradaModoValor ? <span style={{ color: "#4ADE80", marginLeft: 6, fontSize: 10 }}>fixado</span> : null}</label>
                <input type="text" inputMode="numeric" defaultValue="" placeholder={`R$ ${Math.round(c.entradaValor).toLocaleString("pt-BR")}`} onBlur={(e) => { const v = Number(e.target.value.replace(/\D/g, "")); if (v >= 0 && c.valorNegociado > 0) { sim.fixarEntradaValor(v, c.valorNegociado); e.target.value = ""; } }} style={INP_S} />
              </div>
            )}
            {Math.round(c.entradaPctEfetivo) === 0 ? <div style={{ fontSize: 12, color: "#60A5FA", marginTop: 6 }}>Sem entrada — 100% financiado</div> : entForaRange ? <div style={{ fontSize: 12, color: "#F87171", marginTop: 6 }}>Entrada abaixo do mínimo sugerido ({limites.entMin}%)</div> : null}
            {s?.entradaParceladaPermitida && <div style={{ marginTop: 16 }}><Tog checked={sim.entradaParcelada} onChange={sim.setEntradaParcelada} label="Entrada parcelada" /></div>}
            {sim.entradaParcelada && s?.entradaParceladaPermitida ? (
              <div style={{ marginTop: 12, paddingLeft: 8 }}>
                <Slider label="Parcelas da entrada" value={sim.entradaParceladaVezes} min={1} max={s?.entradaParceladaMaxVezes ?? 12} onChange={sim.setEntradaParceladaVezes} suffix="x" hint={c.entradaParceladaValor > 0 ? `${fmt(c.entradaParceladaValor)}/mês` : undefined} />
              </div>
            ) : null}
          </SC>

          {/* 3. Parcelamento */}
          <SC style={{ opacity: (selectedUnit || selectedProperty) ? 1 : 0.4, pointerEvents: (selectedUnit || selectedProperty) ? "auto" : "none" }}>
            <SL>3 · Parcelamento</SL>
            <Slider label="Número de parcelas" value={sim.numeroParcelas} min={limites.parMin} max={limites.parMax} onChange={sim.setNumeroParcelas} suffix="x" />
            {c.valorNegociado > 0 && (
              <div style={{ marginTop: 10 }}>
                <label style={LBL_S}>Ou digite o valor desejado da parcela (R$){sim.campoFixado === "parcela" ? <span style={{ color: "#4ADE80", marginLeft: 6, fontSize: 10 }}>fixado</span> : null}</label>
                <input type="text" inputMode="numeric" defaultValue="" placeholder={`R$ ${Math.round(c.parcelaValor).toLocaleString("pt-BR")}`} onBlur={(e) => { const v = Number(e.target.value.replace(/\D/g, "")); if (v > 0) { sim.fixarParcelaValor(v); } e.target.value = ""; }} style={INP_S} />
                {sim.campoFixado === "parcela" && <button type="button" onClick={() => sim.limparFixacao()} style={{ background: "none", border: "none", color: "var(--text-disabled)", fontSize: 11, cursor: "pointer", padding: "4px 0", marginTop: 4 }}>Limpar fixação da parcela</button>}
              </div>
            )}
            {c.validacoes.parcelasForaRange ? <div style={{ fontSize: 12, color: "#F87171", marginTop: 6 }}>Fora do range ({limites.parMin}-{limites.parMax})</div> : null}
            {c.parcelaValor > 0 && !isMobile ? (
              <div style={{ marginTop: 16, padding: "16px 20px", background: "var(--surface-base)", borderRadius: 10, textAlign: "center", border: `1px solid ${isConsistente ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.3)"}` }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: isConsistente ? "#4ADE80" : "#F87171", fontFamily: "var(--font-mono)", lineHeight: 1, transition: "all 0.15s" }}>{fmt(c.parcelaValor)}<span style={{ fontSize: 14, fontWeight: 400 }}>/mês</span></div>
                <div style={{ fontSize: 12, color: "var(--text-disabled)", marginTop: 4 }}>{sim.numeroParcelas}x · {c.indiceLabel || "com correção monetária"} · sem juros bancários</div>
                {!isConsistente ? <div style={{ fontSize: 12, color: "#F87171", marginTop: 8 }}>Verificar parâmetros</div> : null}
              </div>
            ) : null}
            {(s?.carenciaMaximaMeses ?? 6) > 0 && <div style={{ marginTop: 16 }}><Tog checked={sim.carenciaAtiva} onChange={sim.setCarenciaAtiva} label="Carência (meses sem pagar)" /></div>}
            {sim.carenciaAtiva && (s?.carenciaMaximaMeses ?? 6) > 0 ? <div style={{ marginTop: 12, paddingLeft: 8 }}><Slider label="Meses de carência" value={sim.carenciaMeses} min={1} max={s?.carenciaMaximaMeses ?? 6} onChange={sim.setCarenciaMeses} suffix=" meses" /></div> : null}
          </SC>

          {/* 4. Balão */}
          {s?.aceitaBalao ? (
            <SC style={{ opacity: (selectedUnit || selectedProperty) ? 1 : 0.4, pointerEvents: (selectedUnit || selectedProperty) ? "auto" : "none" }}>
              <Tog checked={sim.balaoAtivo} onChange={sim.setBalaoAtivo} label="Pagamentos balão" />
              {sim.balaoAtivo ? (
                <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <NF label="QUANTIDADE" value={sim.balaoQuantidade} onChange={sim.setBalaoQuantidade} min={1} max={s?.balaoMaxQuantidade ?? 12} />
                  <NF label={`VALOR (R$)${sim.campoFixado === "parcela" ? " · auto" : ""}`} value={Math.round(c.balaoValorEfetivo * 100) / 100} onChange={sim.setBalaoValor} min={0} placeholder="0,00" />
                  {c.totalBalaos > 0 ? <div style={{ gridColumn: "1/-1", fontSize: 12, color: "var(--text-disabled)" }}>{sim.balaoQuantidade}x de {fmt(c.balaoValorEfetivo)} = <strong style={{ color: "var(--text-secondary)" }}>{fmt(c.totalBalaos)}</strong></div> : null}
                </div>
              ) : null}
            </SC>
          ) : null}

          {/* 5. Permuta */}
          {s?.aceitaPermuta ? (
            <SC style={{ opacity: (selectedUnit || selectedProperty) ? 1 : 0.4, pointerEvents: (selectedUnit || selectedProperty) ? "auto" : "none" }}>
              <Tog checked={sim.permutaAtiva} onChange={sim.setPermutaAtiva} label="Incluir permuta" />
              {sim.permutaAtiva ? (
                <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                  {sim.permutaItens.map((item, idx) => (
                    <div key={item.id} style={{ background: "var(--surface-base)", borderRadius: 10, padding: 14, border: "1px solid var(--border-default)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <span style={{ fontSize: 11, color: "var(--text-disabled)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>ITEM {idx + 1}</span>
                        {sim.permutaItens.length > 1 ? <button type="button" onClick={() => sim.removePermutaItem(item.id)} style={{ background: "none", border: "none", color: "#F87171", cursor: "pointer", fontSize: 16, padding: "0 4px" }}>x</button> : null}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                        {(s?.permutaTipos ?? ["veiculo", "terreno", "imovel"]).map((t) => (
                          <button key={t} type="button" onClick={() => sim.updatePermutaItem(item.id, "tipo", t)}
                            style={{ padding: "5px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer", border: "1px solid", borderColor: item.tipo === t ? "#4ADE80" : "var(--border-strong)", background: item.tipo === t ? "rgba(74,222,128,0.1)" : "transparent", color: item.tipo === t ? "#4ADE80" : "#9C9686", fontWeight: item.tipo === t ? 600 : 400 }}>
                            {PERMUTA_LABELS[t] ?? t}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <NF label="VALOR (R$)" value={item.valor} onChange={(v) => sim.updatePermutaItem(item.id, "valor", v)} min={0} placeholder="0,00" />
                        <div><label style={LBL_S}>DESCRIÇÃO</label><input type="text" value={item.descricao} placeholder="Ex: Hilux 2024" onChange={(e) => sim.updatePermutaItem(item.id, "descricao", e.target.value)} style={INP_S} /></div>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={sim.addPermutaItem} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px dashed #3D3A30", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 13 }}>+ Adicionar item de permuta</button>
                  {c.totalPermuta > 0 ? <div style={{ fontSize: 12, color: "var(--text-disabled)" }}>Total: <strong style={{ color: "var(--text-secondary)" }}>{fmt(c.totalPermuta)}</strong></div> : null}
                  {c.validacoes.permutaAcimaLimite ? <div style={{ fontSize: 12, color: "#F87171" }}>Acima do limite ({s?.permutaValorMaximoPct}%)</div> : null}
                </div>
              ) : null}
            </SC>
          ) : null}

          {/* 6. Desconto */}
          {(s?.descontoMaximoPct ?? 5) > 0 ? (
            <SC style={{ opacity: (selectedUnit || selectedProperty) ? 1 : 0.4, pointerEvents: (selectedUnit || selectedProperty) ? "auto" : "none" }}>
              <Tog checked={sim.descontoAtivo} onChange={sim.setDescontoAtivo} label="Aplicar desconto" />
              {sim.descontoAtivo ? (
                <div style={{ marginTop: 16 }}>
                  <Slider label="Percentual de desconto" value={sim.descontoPct} min={0} max={s?.descontoMaximoPct ?? 30} onChange={sim.setDescontoPct} suffix="%" hint={selectedUnit ? `Economia de ${fmt(c.desconto)}` : undefined} />
                  {c.validacoes.descontoAcimaLimite ? <div style={{ fontSize: 12, color: "#FB923C", marginTop: 6 }}>Limite: {s?.descontoMaximoPct}% — requer aprovação</div> : null}
                </div>
              ) : null}
            </SC>
          ) : null}

          {/* 7. PDF options */}
          <SC style={{ opacity: (selectedUnit || selectedProperty) ? 1 : 0.4, pointerEvents: (selectedUnit || selectedProperty) ? "auto" : "none" }}>
            <SL>Adicionar ao PDF (opcional)</SL>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              <div><label style={LBL_S}>CLIENTE</label><div style={{ display: "flex", gap: 6 }}><select value={pdfClienteId} onChange={(e) => setPdfClienteId(e.target.value)} style={{ ...SEL_S, flex: 1 }}><option value="">Nenhum</option>{clients.filter((x) => x.status === "active").map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><button type="button" onClick={() => setShowNewClient(true)} style={{ padding: "0 10px", borderRadius: 6, border: "1px solid var(--color-stone)", background: "transparent", color: "var(--color-sprout)", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>+ Novo</button></div></div>
              <div><label style={LBL_S}>CORRETOR</label><select value={pdfCorretorId} onChange={(e) => setPdfCorretorId(e.target.value)} style={SEL_S}><option value="">Nenhum</option>{brokers.filter((x) => x.status === "active").map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
            </div>
          </SC>
        </div>

        {/* Desktop summary */}
        {!isMobile ? (
          <div style={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 10 }}>
            {valorUnidade > 0 ? (
              <>
                <SC><div style={{ fontSize: 10, color: "var(--text-disabled)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em", marginBottom: 8 }}>RESUMO FINANCEIRO</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: isConsistente ? "#4ADE80" : "#F87171", fontFamily: "var(--font-mono)", lineHeight: 1.1, transition: "all 0.15s" }}>{fmt(c.parcelaValor)}</div>
                  <div style={{ fontSize: 12, color: "var(--text-disabled)", marginTop: 4 }}>por mês · {sim.numeroParcelas}x · sem banco</div>
                </SC>
                <SC>
                  <RR label="Valor de tabela" value={fmt(c.valorOriginal)} />
                  {c.desconto > 0 ? <RR label={`Desconto (${sim.descontoPct}%)`} value={`- ${fmt(c.desconto)}`} /> : null}
                  <RR label="Valor negociado" value={fmt(c.valorNegociado)} hl />
                  <RR label={`Entrada (${Math.round(c.entradaPctEfetivo)}%)`} value={fmt(c.entradaValor)} sub={sim.entradaParcelada ? `${sim.entradaParceladaVezes}x de ${fmt(c.entradaParceladaValor)}` : "À vista"} />
                  {sim.permutaAtiva && c.totalPermuta > 0 ? <RR label="Permuta" value={fmt(c.totalPermuta)} /> : null}
                  {sim.balaoAtivo && c.totalBalaos > 0 ? <RR label={`Balão (${sim.balaoQuantidade}x)`} value={fmt(c.totalBalaos)} sub={`${sim.balaoQuantidade}x de ${fmt(c.balaoValorEfetivo)}`} /> : null}
                  <div style={{ marginTop: 6, padding: "10px 12px", background: "var(--surface-base)", borderRadius: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{saldoLabel.titulo}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{fmt(c.saldoFinanciar)}</div>
                    </div>
                    <div style={{ fontSize: 11, color: "#5C5647", marginTop: 2 }}>{sim.numeroParcelas}x de {fmt(c.parcelaValor)}</div>
                    {saldoLabel.subtitulo ? <div style={{ fontSize: 11, color: "#5C5647", marginTop: 2 }}>{saldoLabel.subtitulo}</div> : null}
                  </div>
                  {/* TOTAL line */}
                  <div style={{ marginTop: 8, padding: "10px 12px", background: c.validacoes.somaConsistente ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)", borderRadius: 8, border: `1px solid ${c.validacoes.somaConsistente ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.3)"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: c.validacoes.somaConsistente ? "#4ADE80" : "#F87171", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>TOTAL</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: c.validacoes.somaConsistente ? "#4ADE80" : "#F87171", fontFamily: "var(--font-mono)" }}>{fmt(c.totalComposicao)}</div>
                    </div>
                    {!c.validacoes.somaConsistente && c.diferenca > 0 ? <div style={{ fontSize: 11, color: "#F87171", marginTop: 4 }}>Diferença de {fmt(c.diferenca)} — ajuste os valores</div> : null}
                  </div>
                  {(sim.campoFixado || sim.entradaModoValor) && <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-disabled)", display: "flex", alignItems: "center", gap: 6 }}><span style={{ color: "#4ADE80" }}>●</span> {[sim.entradaModoValor ? "Entrada fixada" : null, sim.campoFixado === "parcela" ? "Parcela fixada" : sim.campoFixado === "balao" ? "Balão fixado" : null].filter(Boolean).join(" · ")} — valores se ajustam automaticamente {sim.campoFixado && <button type="button" onClick={sim.limparFixacao} style={{ background: "none", border: "none", color: "var(--text-disabled)", fontSize: 11, cursor: "pointer", textDecoration: "underline", padding: 0 }}>limpar</button>}</div>}
                  {showComissao ? <div style={{ marginTop: 10, padding: "10px 12px", background: "rgba(96,165,250,0.08)", borderRadius: 8, border: "1px solid rgba(96,165,250,0.2)" }}><div style={{ fontSize: 10, color: "#60A5FA", fontFamily: "var(--font-mono)" }}>SUA COMISSÃO</div><div style={{ fontSize: 16, fontWeight: 700, color: "#60A5FA", fontFamily: "var(--font-mono)" }}>{fmt(c.comissaoValor)}</div></div> : null}
                </SC>
              </>
            ) : <SC style={{ textAlign: "center" }}><div style={{ marginBottom: 12, opacity: 0.4 }}><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div><div style={{ fontSize: 14, color: "var(--text-disabled)" }}>Selecione uma unidade</div></SC>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {isConsistente && selectedUnit ? (
                <button type="button" onClick={() => { setErroEnvio(null); void iniciarNegociacao(montarInput()); }} disabled={!pdfClienteId || iniciando || salvando} title={!pdfClienteId ? "Selecione um cliente" : ""} style={{ width: "100%", padding: "13px 16px", borderRadius: 10, border: "none", background: (!pdfClienteId || iniciando) ? "rgba(74,222,128,0.3)" : "#4ADE80", color: "var(--interactive-on-primary)", cursor: (!pdfClienteId || iniciando) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ textAlign: "left" }}><div style={{ fontSize: 14, fontWeight: 700 }}>{iniciando ? "Iniciando..." : "Iniciar negociação"}</div><div style={{ fontSize: 11, opacity: 0.7, marginTop: 1 }}>{!pdfClienteId ? "Selecione um cliente" : "Cliente confirmado"}</div></div>
                  <span style={{ fontSize: 16 }}>→</span>
                </button>
              ) : null}
              {selectedUnit ? (
                <button type="button" onClick={() => { setErroEnvio(null); setShowFollowUp(true); }} disabled={salvando || iniciando} style={{ width: "100%", padding: "13px 16px", borderRadius: 10, border: "1px solid var(--border-strong)", background: "transparent", color: selectedUnit ? "var(--text-secondary)" : "var(--text-disabled)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ textAlign: "left" }}><div style={{ fontSize: 14, fontWeight: 500 }}>{salvando ? "Salvando..." : "Salvar como simulação"}</div><div style={{ fontSize: 11, color: "var(--text-disabled)", marginTop: 1 }}>Rascunho para consulta futura</div></div>
                  <span style={{ fontSize: 14, color: "var(--text-disabled)" }}>○</span>
                </button>
              ) : null}
              {sucessoEnvio ? <div style={{ fontSize: 12, color: "var(--color-sprout)", background: "var(--color-sprout-muted)", border: "1px solid var(--color-sprout)", borderRadius: 8, padding: "8px 12px", marginBottom: 8 }}>{sucessoEnvio}</div> : null}
              {erroEnvio ? <div style={{ fontSize: 12, color: "#F87171", background: "rgba(248,113,113,0.08)", borderRadius: 8, padding: "8px 12px", marginBottom: 8 }}>{erroEnvio}</div> : null}
              <button type="button" onClick={() => void handleGerarPdf()} disabled={gerandoPDF || !selectedUnit} style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", background: selectedUnit ? "var(--interactive-primary)" : "var(--surface-overlay)", color: selectedUnit ? "var(--interactive-on-primary)" : "var(--text-disabled)", fontSize: 14, fontWeight: 700, cursor: selectedUnit ? "pointer" : "not-allowed" }}>{gerandoPDF ? "Gerando PDF..." : "Gerar PDF"}</button>
              <button type="button" onClick={limpar} style={{ background: "none", border: "none", color: "var(--text-disabled)", fontSize: 12, cursor: "pointer", padding: "4px", textAlign: "center" }}>Limpar simulação</button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Mobile bottom bar */}
      {isMobile && selectedUnit && c.parcelaValor > 0 ? (
        <>
          <div style={{ height: 80 }} />
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(28,27,24,0.92)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderTop: "1px solid var(--border-default)", zIndex: 100, paddingBottom: "env(safe-area-inset-bottom)" }}>
            <button type="button" onClick={() => setResumoAberto((v) => !v)} style={{ width: "100%", padding: "14px 20px", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 11, color: "var(--text-disabled)", fontFamily: "var(--font-mono)" }}>{sim.numeroParcelas}x sem banco</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: isConsistente ? "#4ADE80" : "#F87171", fontFamily: "var(--font-mono)" }}>{fmt(c.parcelaValor)}/mês</div>
              </div>
              <span style={{ color: "var(--text-muted)", fontSize: 20 }}>{resumoAberto ? "▼" : "▲"}</span>
            </button>
            {resumoAberto ? (
              <div style={{ padding: "0 16px 16px", maxHeight: "60vh", overflowY: "auto" }}>
                <RR label="Valor negociado" value={fmt(c.valorNegociado)} hl />
                <RR label={`Entrada (${Math.round(c.entradaPctEfetivo)}%)`} value={fmt(c.entradaValor)} />
                {sim.permutaAtiva && c.totalPermuta > 0 ? <RR label="Permuta" value={fmt(c.totalPermuta)} /> : null}
                {sim.balaoAtivo && c.totalBalaos > 0 ? <RR label={`Balão (${sim.balaoQuantidade}x)`} value={fmt(c.totalBalaos)} /> : null}
                <RR label={saldoLabel.titulo} value={fmt(c.saldoFinanciar)} sub={`${sim.numeroParcelas}x de ${fmt(c.parcelaValor)}`} />
                <div style={{ padding: "8px 0", display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 12, fontWeight: 700, color: c.validacoes.somaConsistente ? "#4ADE80" : "#F87171", fontFamily: "var(--font-mono)" }}>TOTAL</span><span style={{ fontSize: 13, fontWeight: 800, color: c.validacoes.somaConsistente ? "#4ADE80" : "#F87171", fontFamily: "var(--font-mono)" }}>{fmt(c.totalComposicao)}</span></div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                  {isConsistente && pdfClienteId ? <button type="button" onClick={() => void iniciarNegociacao(montarInput())} disabled={iniciando} style={{ flex: 1, padding: "13px", borderRadius: 10, border: "none", background: iniciando ? "rgba(74,222,128,0.4)" : "#4ADE80", color: "var(--interactive-on-primary)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{iniciando ? "..." : "Negociação"}</button> : null}
                  <button type="button" onClick={() => setShowFollowUp(true)} disabled={salvando} style={{ flex: 1, padding: "13px", borderRadius: 10, border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-secondary)", fontSize: 14, cursor: "pointer" }}>{salvando ? "..." : "Simulação"}</button>
                  <button type="button" onClick={() => void handleGerarPdf()} disabled={gerandoPDF} style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", background: "var(--interactive-primary)", color: "var(--interactive-on-primary)", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{gerandoPDF ? "Gerando..." : "PDF"}</button>
                  {sucessoEnvio ? <div style={{ fontSize: 12, color: "var(--color-sprout)", background: "var(--color-sprout-muted)", border: "1px solid var(--color-sprout)", borderRadius: 8, padding: "8px 12px" }}>{sucessoEnvio}</div> : null}
                  {erroEnvio ? <div style={{ fontSize: 12, color: "#F87171", background: "rgba(248,113,113,0.08)", borderRadius: 8, padding: "8px 12px" }}>{erroEnvio}</div> : null}
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {/* Quick client creation modal */}
      {showNewClient ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => { if (!savingClient) setShowNewClient(false); }}>
          <div style={{ background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 16, padding: 32, width: "100%", maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-bone)", margin: "0 0 16px" }}>Novo cliente</h2>
            <div style={{ display: "grid", gap: 12 }}>
              <div><label style={{ fontSize: 11, color: "var(--color-fog)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>NOME *</label><input type="text" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="Nome completo" style={{ width: "100%", boxSizing: "border-box" }} autoFocus /></div>
              <div><label style={{ fontSize: 11, color: "var(--color-fog)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>E-MAIL *</label><input type="email" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} placeholder="email@exemplo.com" style={{ width: "100%", boxSizing: "border-box" }} /></div>
              <div><label style={{ fontSize: 11, color: "var(--color-fog)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>TELEFONE *</label><input type="tel" value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} placeholder="(00) 00000-0000" style={{ width: "100%", boxSizing: "border-box" }} /></div>
            </div>
            {clientErr ? <div style={{ marginTop: 12, fontSize: 13, color: "#F87171" }}>{clientErr}</div> : null}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button type="button" disabled={savingClient} onClick={() => setShowNewClient(false)} style={{ padding: "0 16px", height: 36, borderRadius: 8, border: "1px solid var(--color-stone)", background: "transparent", color: "var(--color-bone)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
              <button type="button" disabled={savingClient || !newClientName.trim() || !newClientEmail.trim() || !newClientPhone.trim()} onClick={() => void handleCreateClient()} style={{ padding: "0 16px", height: 36, borderRadius: 8, border: "none", background: "var(--color-sprout)", color: "var(--color-ink)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{savingClient ? "Salvando..." : "Salvar cliente"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {showQueueModal && selectedUnit && (
        <QueueEntryModal
          isOpen={showQueueModal}
          onClose={() => setShowQueueModal(false)}
          unit={{ id: selectedUnit.id, quadra: selectedUnit.quadra, lote: selectedUnit.lote, valor: selectedUnit.valor, status: selectedUnit.status }}
          queuePosition={unitQueue.getEstimatedPosition()}
          onSuccess={() => { setShowQueueModal(false); unitQueue.fetchQueue(); setQueueFeedback({ type: "success", message: `Entrada na fila confirmada! Posição #${unitQueue.queueCount + 1}` }); }}
        />
      )}
      <FollowUpModal
        open={showFollowUp}
        title="Quando deseja retomar?"
        subtitle={selectedUnit ? `Q${selectedUnit.quadra} · L${selectedUnit.lote}` : undefined}
        onCancel={() => setShowFollowUp(false)}
        onConfirm={(date) => {
          setShowFollowUp(false);
          void salvarComoSimulacao({ ...montarInput(), followUpAt: date });
        }}
      />
    </div>
  );
}

// ── UI components ──

function SC({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "20px 24px", ...style }}>{children}</div>;
}
function SL({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, color: "var(--text-disabled)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>{children}</div>;
}
function MS({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return <div><div style={{ fontSize: 10, color: "var(--text-disabled)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginBottom: 3 }}>{label}</div><div style={{ fontSize: 14, fontWeight: 600, color: green ? "var(--interactive-primary)" : "var(--text-secondary)" }}>{value}</div></div>;
}
function Tog({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%" }}>
      <div style={{ width: 36, height: 20, borderRadius: 10, position: "relative", background: checked ? "var(--interactive-primary)" : "var(--surface-overlay)", transition: "background 0.2s", flexShrink: 0 }}><div style={{ position: "absolute", top: 3, left: checked ? 19 : 3, width: 14, height: 14, borderRadius: "50%", background: "var(--text-primary)", transition: "left 0.2s" }} /></div>
      <span style={{ fontSize: 14, color: checked ? "var(--text-secondary)" : "var(--text-muted)", fontWeight: checked ? 500 : 400 }}>{label}</span>
    </button>
  );
}
function Slider({ label, value, min, max, onChange, suffix, hint, error }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; suffix?: string; hint?: string; error?: boolean }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="number" value={value} min={min} max={max} onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value))))} onFocus={(e) => e.target.select()} style={{ width: 64, background: "var(--surface-base)", border: `1px solid ${error ? "rgba(248,113,113,0.5)" : "var(--border-strong)"}`, borderRadius: 6, padding: "4px 8px", color: "var(--text-secondary)", fontSize: 14, fontWeight: 600, textAlign: "right", outline: "none", fontFamily: "var(--font-mono)" }} />
          {suffix ? <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{suffix}</span> : null}
        </div>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: "100%", accentColor: error ? "#F87171" : "#4ADE80", cursor: "pointer", height: 4 }} />
      {hint ? <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 10, color: "#5C5647" }}><span>{min}{suffix}</span><span style={{ color: "var(--text-muted)" }}>{hint}</span><span>{max}{suffix}</span></div> : null}
    </div>
  );
}
function RR({ label, value, sub, hl }: { label: string; value: string; sub?: string; hl?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid var(--border-default)" }}>
      <div><div style={{ fontSize: 13, color: hl ? "var(--text-secondary)" : "var(--text-muted)", fontWeight: hl ? 600 : 400 }}>{label}</div>{sub ? <div style={{ fontSize: 11, color: "var(--text-disabled)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{sub}</div> : null}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: hl ? "var(--interactive-primary)" : "var(--text-secondary)", fontFamily: "var(--font-mono)", textAlign: "right" }}>{value}</div>
    </div>
  );
}
function NF({ label, value, onChange, min, max, placeholder }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; placeholder?: string }) {
  return <div><label style={LBL_S}>{label}</label><input type="number" min={min} max={max} value={value === 0 ? "" : value} placeholder={placeholder} onChange={(e) => onChange(Number(e.target.value) || 0)} onFocus={(e) => e.target.select()} style={INP_S} /></div>;
}

const SEL_S: React.CSSProperties = { width: "100%", background: "var(--surface-base)", border: "1px solid var(--border-strong)", borderRadius: 8, padding: "12px 14px", color: "var(--text-secondary)", fontSize: 15, outline: "none", cursor: "pointer", fontFamily: "inherit" };
const INP_S: React.CSSProperties = { width: "100%", background: "var(--surface-base)", border: "1px solid var(--border-strong)", borderRadius: 8, padding: "10px 12px", color: "var(--text-secondary)", fontSize: 14, outline: "none", fontFamily: "var(--font-mono)", boxSizing: "border-box" };
const LBL_S: React.CSSProperties = { fontSize: 11, color: "var(--text-disabled)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 6 };
