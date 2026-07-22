import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
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
import { SearchableSelect } from "../../../shared/components/SearchableSelect";
import { formatPhone } from "../../../shared/utils/masks";
import { useSimulador } from "../hooks/useSimulador";
import { gerarPdfSimulacao } from "../utils/gerarPdfSimulacao";
import { useEnviarParaPipeline } from "../hooks/useEnviarParaPipeline";
import FollowUpModal from "../../../shared/components/FollowUpModal";
import { createClient } from "../../../infra/repositories/clientsSupabaseRepository";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { salvarGrupoSimulacao } from "../services/salvarGrupoSimulacao";
import { useThirdPartyProperties, type ThirdPartyProperty } from "../../imoveis/hooks/useThirdPartyProperties";
// ConfirmacaoNegociacaoModal removed — two-button flow replaces it
import { getSaldoLabel } from "../utils/getSaldoLabel";
import { createShareLink, copyShareLink } from "../../../shared/services/shareLinks";
import { useUnitQueue } from "../../units/hooks/useUnitQueue";
import QueueEntryModal from "../../../shared/components/QueueEntryModal";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PERMUTA_LABELS: Record<string, string> = { veiculo: "Veículo", terreno: "Terreno", imovel: "Imóvel" };

export default function SimuladorPage() {
  const [qp] = useSearchParams();
  const navigate = useNavigate();
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

  const availableUnitsRaw = units.filter((u) => u.status === UnidadeStatus.DISPONIVEL && u.valor > 0);
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

  // Ida com contexto (Lei 5): atalho traz ?clientId= / ?brokerId= (ex.: "Simular"
  // na Ficha do Contato). Pré-seleciona — editável, nunca trava.
  useEffect(() => {
    const cid = qp.get("clientId");
    const bid = qp.get("brokerId");
    if (cid) setPdfClienteId(cid);
    if (bid) setPdfCorretorId(bid);
  }, [qp]);
  // Voltar preserva a origem (Lei 3): "← Contato" quando veio de um atalho.
  const origin = (useLocation().state ?? null) as { from?: string; fromLabel?: string } | null;


  // Quick client creation
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [savingClient, setSavingClient] = useState(false);
  const [clientErr, setClientErr] = useState<string | null>(null);
  const { salvarComoSimulacao, iniciarNegociacao, salvando, iniciando, erro: erroEnvio, setErro: setErroEnvio, sucesso: sucessoEnvio, lastSavedId } = useEnviarParaPipeline(accountId, developmentId);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [showFollowUp, setShowFollowUp] = useState(false);

  // ── Multi-unit group ──
  type GroupItem = { unitId: string; label: string; valorTotal: number; entradaPct: number; entradaValor: number; parcelas: number; parcelaValor: number; balaoQtd: number; balaoValor: number; permutaValor: number; permutaDesc: string };
  const [groupItems, setGroupItems] = useState<GroupItem[]>([]);
  const addCurrentToGroup = () => {
    if (!selectedUnit || c.validacoes.temErro) return;
    if (groupItems.some((g) => g.unitId === selectedUnit.id)) return;
    setGroupItems((prev) => [...prev, {
      unitId: selectedUnit.id, label: `Q${selectedUnit.quadra}·L${selectedUnit.lote}`, valorTotal: c.valorNegociado,
      entradaPct: Math.round(c.entradaPctEfetivo), entradaValor: c.entradaValor,
      parcelas: sim.numeroParcelas, parcelaValor: c.parcelaValor,
      balaoQtd: sim.balaoAtivo ? sim.balaoQuantidade : 0, balaoValor: sim.balaoAtivo ? c.balaoValorEfetivo : 0,
      permutaValor: sim.permutaAtiva ? c.totalPermuta : 0, permutaDesc: sim.permutaItens.map((p) => p.descricao).filter(Boolean).join(", "),
    }]);
    setSelectedUnitId(""); limpar();
  };
  const removeGroupItem = (idx: number) => setGroupItems((p) => p.filter((_, i) => i !== idx));
  const availableUnits = availableUnitsRaw.filter((u) => !groupItems.some((g) => g.unitId === u.id));
  const groupTotalValor = groupItems.reduce((s, g) => s + g.valorTotal, 0) + (selectedUnit ? c.valorNegociado : 0);
  const groupTotalEntrada = groupItems.reduce((s, g) => s + g.entradaValor, 0) + (selectedUnit ? c.entradaValor : 0);
  const groupTotalParcela = groupItems.reduce((s, g) => s + g.parcelaValor, 0) + (selectedUnit ? c.parcelaValor : 0);

  // handleCriarProposta replaced by handleEnviarPipeline

  const temImovelSelecionado = tipoAtivo === "unidade" ? !!selectedUnit : !!selectedProperty;

  const handleGerarPdf = useCallback(async () => {
    if (!selectedUnit && !selectedProperty) return;
    setGerandoPDF(true);
    try {
      const cl = clients.find((x) => x.id === pdfClienteId);
      const br = brokers.find((x) => x.id === pdfCorretorId);
      const as_ = ss?.accountSettings;
      await gerarPdfSimulacao({
        contaNome: as_?.nomeComercial || account?.accountName || "NEXA",
        empreendimentoNome: selectedProperty ? (selectedProperty.titulo ?? "") : (development?.developmentName ?? ""),
        quadra: selectedUnit?.quadra ?? "", lote: selectedUnit?.lote ?? (selectedProperty?.titulo ?? ""),
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
        area: selectedUnit ? Number((selectedUnit as Record<string, unknown>).area || 0) : 0,
        balaoPeriodicidade: s?.balaoPeriodicidade || "semestral",
      });
    } finally { setGerandoPDF(false); }
  }, [selectedUnit, selectedProperty, c, sim, s, ss, account, development, clients, brokers, pdfClienteId, pdfCorretorId]);

  // Engrenagem Comercial v1 — quando vindo de /negociacoes/:id?→/simulador,
  // a negociação-alvo é passada via query param e grava o vínculo na simulação.
  const negotiationIdParam = qp.get("negotiation_id");

  const montarInput = useCallback(() => ({
    unitId: tipoAtivo === "unidade" ? selectedUnitId : "", clientId: pdfClienteId || null, brokerId: pdfCorretorId || null,
    propertyId: tipoAtivo === "imovel" ? selectedPropertyId : null,
    propertyName: tipoAtivo === "imovel" ? (selectedProperty?.titulo ?? null) : null,
    valorTotal: c.valorNegociado, entradaPercentual: Math.round(c.entradaPctEfetivo * 100) / 100, entradaValor: c.entradaValor,
    parcelasQuantidade: sim.numeroParcelas, parcelasValor: c.parcelaValor,
    balaoQuantidade: sim.balaoAtivo ? sim.balaoQuantidade : undefined, balaoValor: sim.balaoAtivo ? c.balaoValorEfetivo : undefined,
    permutaValor: sim.permutaAtiva ? c.totalPermuta : undefined,
    editingSimulationId,
    negotiationId: negotiationIdParam,
  }), [selectedUnitId, selectedPropertyId, tipoAtivo, pdfClienteId, pdfCorretorId, c, sim, editingSimulationId, negotiationIdParam]);

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
    setEntradaMode("pct");
    setPdfClienteId(""); setPdfCorretorId("");
  }

  const limites = { parMin: s?.parcelasMinimas ?? 12, parMax: s?.parcelasMaximas ?? 120, entMin: s?.entradaMinimaPct ?? 10, entMax: s?.entradaMaximaPct ?? 80 };
  const entForaRange = c.validacoes.entradaAbaixoMinimo || c.validacoes.entradaAcimaMaximo;
  const saldoLabel = getSaldoLabel(s);

  // V3 layout states
  const [entradaMode, setEntradaMode] = useState<"pct" | "val">("pct");
  const [selectorOpen, setSelectorOpen] = useState(false);

  // Close dropdown on click outside
  useEffect(() => {
    if (!selectorOpen) return;
    const h = (e: MouseEvent) => { const w = document.getElementById("unit-selector-wrapper"); if (w && !w.contains(e.target as Node)) setSelectorOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [selectorOpen]);

  if (isLoading || isRestoring) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}><div style={{ color: "#4ADE80", fontFamily: "var(--font-mono)", fontSize: 13 }}>{isRestoring ? "Restaurando simulação..." : "Carregando unidades..."}</div></div>;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "0 16px 100px" : "0", overflowX: "hidden", boxSizing: "border-box" }}>
      {origin?.from ? (
        <button type="button" onClick={() => navigate(origin.from!)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", padding: "6px 0", marginBottom: 4 }}>← {origin.fromLabel ?? "Voltar"}</button>
      ) : null}
      <div style={{ marginBottom: screen.isMobile ? 16 : 24, display: "flex", alignItems: "center", gap: 14, transition: "opacity 0.2s ease" }}>
        {tipoAtivo === "unidade" && s?.logoEmpreendimentoUrl && !screen.isMobile && (
          <img src={s.logoEmpreendimentoUrl} alt={development?.developmentName ?? ""} style={{ height: isMobile ? 52 : 60, width: "auto", maxWidth: 200, objectFit: "contain", borderRadius: 0, flexShrink: 0 }} />
        )}
        <div>
          {!screen.isMobile ? (
            <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontSize: isMobile ? 24 : 28, fontWeight: 400, color: "var(--text-secondary)", margin: 0, lineHeight: 1.1 }}>
              {tipoAtivo === "unidade" ? "Simulador Comercial" : "Simulador · Imóveis de terceiros"}
            </h1>
          ) : null}
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", margin: screen.isMobile ? 0 : "6px 0 0", letterSpacing: "0.03em" }}>
            {tipoAtivo === "unidade"
              ? `${development?.developmentName} · ${allUnitsWithValue.length} unidades · ${availableUnits.length} disponíveis`
              : "Simulações para imóveis externos ao empreendimento"}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 360px", gap: 20, alignItems: "start" }}>
        {/* Controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* 1. Imóvel selector — custom dropdown (overflow visible for dropdown) */}
          <SC style={{ overflow: "visible" }}><div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 14 }}>Imóvel</div>
            {/* Toggle tabs */}
            <div style={{ display: "flex", gap: 2, background: "var(--surface-base)", border: "1px solid var(--border-strong)", borderRadius: 8, padding: 3, marginBottom: 12 }}>
              {([["unidade", "Unidade do empreendimento"], ["imovel", "Imóvel de terceiro"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => { setTipoAtivo(k); if (k === "unidade") setSelectedPropertyId(""); else setSelectedUnitId(""); setSelectorOpen(false); }} style={{ flex: 1, padding: "7px 10px", borderRadius: 6, border: "none", background: tipoAtivo === k ? "var(--interactive-primary)" : "transparent", color: tipoAtivo === k ? "var(--interactive-on-primary)" : "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>{l}</button>
              ))}
            </div>

            {tipoAtivo === "unidade" ? (
            <div id="unit-selector-wrapper" style={{ position: "relative" }}>
              {/* Trigger button */}
              <div onClick={() => setSelectorOpen(!selectorOpen)} style={{ background: "var(--surface-base)", border: `1px solid ${selectorOpen ? "rgba(74,222,128,0.35)" : "var(--border-strong)"}`, borderRadius: selectorOpen ? "11px 11px 0 0" : 11, padding: "11px 14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "border-color 0.2s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: selectedUnit ? "#4ADE80" : "var(--text-disabled)" }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{selectedUnit ? `Q${selectedUnit.quadra} · Lote ${selectedUnit.lote}` : "Selecione uma unidade..."}</div>
                    {selectedUnit && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmt(selectedUnit.valor)} · {development?.developmentName}</div>}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: "var(--text-muted)", transition: "transform 0.2s", transform: selectorOpen ? "rotate(180deg)" : "none" }}>▾</span>
              </div>
              {/* Dropdown list */}
              {selectorOpen && (
                <div style={{ position: "absolute", left: 0, right: 0, top: "100%", zIndex: 20, background: "var(--surface-base)", border: "1px solid rgba(74,222,128,0.3)", borderTop: "none", borderRadius: "0 0 11px 11px", maxHeight: 280, overflowY: "auto" }}>
                  {Array.from(new Set(allUnitsWithValue.map((u) => u.quadra))).sort().map((q) => (
                    <div key={q}>
                      <div style={{ padding: "10px 14px 4px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.02em" }}>Quadra {q}</div>
                      {allUnitsWithValue.filter((u) => u.quadra === q).sort((a, b) => { const na = parseInt(a.lote), nb = parseInt(b.lote); return !isNaN(na) && !isNaN(nb) ? na - nb : a.lote.localeCompare(b.lote); }).map((u) => {
                        const isSelected = u.id === selectedUnitId;
                        const statusTag = u.status === UnidadeStatus.RESERVADO ? "RESERV." : u.status === UnidadeStatus.VENDIDO ? "VENDIDA" : u.status === UnidadeStatus.EM_NEGOCIACAO ? "NEGOC." : "";
                        return <div key={u.id} onClick={() => { setSelectedUnitId(u.id); setSelectorOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer", background: isSelected ? "rgba(74,222,128,0.06)" : "transparent", transition: "background 0.1s", minHeight: 44 }} onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "var(--surface-overlay)"; }} onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>
                          <div style={{ width: 7, height: 7, borderRadius: "50%", background: u.status === UnidadeStatus.DISPONIVEL ? "#4ADE80" : u.status === UnidadeStatus.VENDIDO ? "#F87171" : "#FBBF24", flexShrink: 0 }} />
                          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", flex: 1 }}>Lote {u.lote}{statusTag ? ` · ${statusTag}` : ""}</span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500, color: "var(--text-muted)" }}>{fmt(u.valor)}</span>
                        </div>;
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
            ) : (<>
            <div id="unit-selector-wrapper" style={{ position: "relative" }}>
              {/* Trigger */}
              <div onClick={() => setSelectorOpen(!selectorOpen)} style={{ background: "var(--surface-base)", border: `1px solid ${selectorOpen ? "rgba(251,191,36,0.35)" : "var(--border-strong)"}`, borderRadius: selectorOpen ? "11px 11px 0 0" : 11, padding: "11px 14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "border-color 0.2s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: selectedProperty ? "#FBBF24" : "var(--text-disabled)" }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{selectedProperty ? selectedProperty.titulo : "Selecione um imóvel..."}</div>
                    {selectedProperty && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmt(selectedProperty.valorVenda ?? 0)}{selectedProperty.tipo ? ` · ${selectedProperty.tipo.charAt(0).toUpperCase() + selectedProperty.tipo.slice(1)}` : ""}{selectedProperty.cidade ? ` · ${selectedProperty.cidade}` : ""}</div>}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: "var(--text-muted)", transition: "transform 0.2s", transform: selectorOpen ? "rotate(180deg)" : "none" }}>▾</span>
              </div>
              {/* Dropdown */}
              {selectorOpen && (
                <div style={{ position: "absolute", left: 0, right: 0, top: "100%", zIndex: 20, background: "var(--surface-base)", border: "1px solid rgba(251,191,36,0.3)", borderTop: "none", borderRadius: "0 0 11px 11px", maxHeight: 280, overflowY: "auto", boxShadow: "0 12px 32px rgba(0,0,0,0.4)" }}>
                  {availableProperties.length === 0 ? (
                    <div style={{ padding: "16px 14px", fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>Nenhum imóvel de terceiro disponível</div>
                  ) : availableProperties.map((p) => {
                    const isSelected = p.id === selectedPropertyId;
                    return <div key={p.id} onClick={() => { setSelectedPropertyId(p.id); setSelectorOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer", background: isSelected ? "rgba(251,191,36,0.06)" : "transparent", transition: "background 0.1s", minHeight: 44 }} onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "var(--surface-overlay)"; }} onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#FBBF24", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{p.titulo}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.tipo ? `${p.tipo.charAt(0).toUpperCase() + p.tipo.slice(1)}` : ""}{p.cidade ? ` · ${p.cidade}` : ""}{p.areaM2 ? ` · ${p.areaM2.toLocaleString("pt-BR")} m²` : ""}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>{fmt(p.valorVenda ?? 0)}</div>
                        <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4, textTransform: "uppercase", background: "rgba(251,191,36,0.10)", color: "#D97706" }}>terceiro</span>
                      </div>
                    </div>;
                  })}
                </div>
              )}
            </div>
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
            </>)}
            {selectedUnit ? (
              screen.isMobile ? (
                <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--surface-base)", borderRadius: 8, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    Q{selectedUnit.quadra} · L{selectedUnit.lote}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-disabled)" }}>·</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--interactive-primary)", whiteSpace: "nowrap" }}>
                    {fmt(selectedUnit.valor)}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>de tabela</span>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 14, padding: 14, background: "var(--surface-base)", borderRadius: 8 }}>
                  <MS label="Localização" value={`Q${selectedUnit.quadra} · L${selectedUnit.lote}`} />
                  <MS label="Valor de tabela" value={fmt(selectedUnit.valor)} green />
                </div>
              )
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

          {/* 2. Entrada — with pct/val toggle */}
          <SC style={{ opacity: (selectedUnit || selectedProperty) ? 1 : 0.4, pointerEvents: (selectedUnit || selectedProperty) ? "auto" : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Entrada</span>
              {/* Toggle pill: Percentual | Valor fixo */}
              <div style={{ display: "flex", background: "var(--surface-base)", border: "1px solid var(--border-default)", borderRadius: 10, padding: 3 }}>
                {(["pct", "val"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => {
                    if (m === entradaMode) return;
                    setEntradaMode(m);
                    // Convert between modes
                    if (m === "val" && c.valorNegociado > 0) sim.fixarEntradaValor(Math.round(c.entradaValor), c.valorNegociado);
                    if (m === "pct") sim.setEntradaPct(Math.round(c.entradaPctEfetivo));
                  }} style={{ padding: "5px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: entradaMode === m ? "var(--text-primary)" : "transparent", color: entradaMode === m ? "var(--surface-base)" : "var(--text-muted)", transition: "all 0.15s", boxShadow: entradaMode === m ? "0 1px 3px rgba(0,0,0,0.2)" : "none" }}>{m === "pct" ? "Percentual" : "Valor fixo"}</button>
                ))}
              </div>
            </div>

            {entradaMode === "pct" ? (
              <>
                <Slider label="Percentual" value={Math.round(c.entradaPctEfetivo)} min={0} max={limites.entMax} onChange={sim.setEntradaPct} suffix="%" hint={selectedUnit ? fmt(c.entradaValor) : undefined} error={entForaRange} />
                {c.entradaValor > 0 && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>equivale a <strong style={{ color: "var(--text-secondary)" }}>{fmt(c.entradaValor)}</strong> de entrada</div>}
              </>
            ) : (
              <>
                <div style={{ background: "var(--surface-base)", border: `1px solid ${entForaRange ? "rgba(217,119,6,0.4)" : "var(--border-strong)"}`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 500 }}>R$</span>
                  <input type="text" inputMode="numeric" value={sim.entradaValorFixo > 0 ? sim.entradaValorFixo.toLocaleString("pt-BR") : ""} placeholder="0" onChange={(e) => { const v = Number(e.target.value.replace(/\D/g, "")); if (c.valorNegociado > 0) sim.fixarEntradaValor(v, c.valorNegociado); }} style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 18, fontWeight: 700, color: "var(--text-primary)", textAlign: "right", fontFamily: "inherit", WebkitAppearance: "none" as never }} />
                </div>
                {c.valorNegociado > 0 && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>equivale a <strong style={{ color: "var(--text-secondary)" }}>{Math.round(c.entradaPctEfetivo)}%</strong> do valor do imóvel</div>}
              </>
            )}

            {Math.round(c.entradaPctEfetivo) === 0 ? <div style={{ fontSize: 12, color: "#60A5FA", marginTop: 6 }}>Sem entrada — 100% financiado</div> : entForaRange ? <div style={{ fontSize: 12, color: "#D97706", marginTop: 6 }}>Fora dos parâmetros da incorporadora ({limites.entMin}%-{limites.entMax}%)</div> : null}
            {s?.entradaParceladaPermitida && <div style={{ marginTop: 16 }}><Tog checked={sim.entradaParcelada} onChange={sim.setEntradaParcelada} label="Entrada parcelada" /></div>}
            {sim.entradaParcelada && s?.entradaParceladaPermitida ? (
              <div style={{ marginTop: 12, paddingLeft: 8 }}>
                <Slider label="Parcelas da entrada" value={sim.entradaParceladaVezes} min={1} max={s?.entradaParceladaMaxVezes ?? 12} onChange={sim.setEntradaParceladaVezes} suffix="x" hint={c.entradaParceladaValor > 0 ? `${fmt(c.entradaParceladaValor)}/mês` : undefined} />
              </div>
            ) : null}
          </SC>

          {/* 3. Parcelamento — toggle à vista / parcelado */}
          <SC style={{ opacity: (selectedUnit || selectedProperty) ? 1 : 0.4, pointerEvents: (selectedUnit || selectedProperty) ? "auto" : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Pagamento</span>
              {/* Toggle pill: À vista | Parcelado */}
              <div style={{ display: "flex", background: "var(--surface-base)", border: "1px solid var(--border-default)", borderRadius: 10, padding: 3 }}>
                <button type="button" onClick={() => sim.setNumeroParcelas(0)} style={{ padding: "5px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: sim.numeroParcelas === 0 ? "var(--text-primary)" : "transparent", color: sim.numeroParcelas === 0 ? "var(--surface-base)" : "var(--text-muted)", transition: "all 0.15s", boxShadow: sim.numeroParcelas === 0 ? "0 1px 3px rgba(0,0,0,0.2)" : "none" }}>À vista</button>
                <button type="button" onClick={() => { if (sim.numeroParcelas === 0) sim.setNumeroParcelas(Math.max(s?.parcelasMinimas ?? 12, 36)); }} style={{ padding: "5px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: sim.numeroParcelas > 0 ? "var(--text-primary)" : "transparent", color: sim.numeroParcelas > 0 ? "var(--surface-base)" : "var(--text-muted)", transition: "all 0.15s", boxShadow: sim.numeroParcelas > 0 ? "0 1px 3px rgba(0,0,0,0.2)" : "none" }}>Parcelado</button>
              </div>
            </div>

            {sim.numeroParcelas > 0 ? (
              <>
                {/* Combined input + result card */}
                <div style={{ display: "flex", background: "var(--surface-base)", border: `1px solid ${c.validacoes.parcelasForaRange ? "rgba(251,191,36,0.4)" : "var(--border-strong)"}`, borderRadius: 12, overflow: "hidden", maxWidth: "100%" }}>
                  <div style={{ flex: "0 0 auto", padding: isMobile ? "12px 10px" : "14px 16px", display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="number" inputMode="numeric" min={1} max={360} value={sim.numeroParcelas} onChange={(e) => sim.setNumeroParcelas(Math.max(1, Number(e.target.value) || 1))} onFocus={(e) => e.target.select()} style={{ width: isMobile ? 56 : 80, background: "transparent", border: "none", outline: "none", fontSize: isMobile ? 20 : 24, fontWeight: 700, color: "var(--text-primary)", textAlign: "center", fontFamily: "inherit", WebkitAppearance: "none" as never, MozAppearance: "textfield" as never, minHeight: 44, padding: "8px 2px" }} />
                    <span style={{ fontSize: isMobile ? 12 : 14, color: "var(--text-muted)", whiteSpace: "nowrap" }}>parcelas de</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, borderLeft: "1px solid var(--border-default)", padding: isMobile ? "12px 10px" : "14px 16px", background: "rgba(74,222,128,0.04)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 700, color: "#4ADE80", fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fmt(c.parcelaValor)}<span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)" }}>/mês</span></div>
                    <div style={{ fontSize: 11, color: "var(--text-disabled)", marginTop: 2 }}>sem juros</div>
                  </div>
                </div>
                {c.validacoes.parcelasForaRange && <div style={{ fontSize: 12, color: "#FBBF24", marginTop: 6 }}>Fora dos parâmetros da incorporadora ({limites.parMin}-{limites.parMax})</div>}
              </>
            ) : (
              <div style={{ padding: "16px", background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)", borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#60A5FA" }}>Pagamento à vista</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Sem parcelas mensais — o saldo é pago integralmente</div>
              </div>
            )}
            {sim.campoFixado === "parcela" && <div style={{ fontSize: 11, color: "var(--text-disabled)", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}><span style={{ color: "#4ADE80" }}>●</span> Parcela fixada <button type="button" onClick={() => sim.limparFixacao()} style={{ background: "none", border: "none", color: "var(--text-disabled)", fontSize: 11, cursor: "pointer", textDecoration: "underline", padding: 0 }}>limpar</button></div>}
            {/* Valor fixo da parcela — collapsible (only when parcelas > 0) */}
            {c.valorNegociado > 0 && sim.numeroParcelas > 0 && (
              <div style={{ marginTop: 12 }}>
                <Tog checked={sim.campoFixado === "parcela"} onChange={() => { if (sim.campoFixado === "parcela") { sim.limparFixacao(); } else { sim.fixarParcelaValor(Math.round(c.parcelaValor)); } }} label="Fixar valor da parcela" />
                {sim.campoFixado === "parcela" && (
                  <div style={{ marginTop: 10 }}>
                    <input type="text" inputMode="numeric" defaultValue="" placeholder={`R$ ${Math.round(c.parcelaValor).toLocaleString("pt-BR")}`} onBlur={(e) => { const v = Number(e.target.value.replace(/\D/g, "")); if (v > 0) sim.fixarParcelaValor(v); e.target.value = ""; }} style={INP_S} />
                  </div>
                )}
              </div>
            )}
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
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 14 }}>Adicionar ao PDF</div>
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12, alignItems: isMobile ? "stretch" : "flex-end" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ fontSize: 8, fontWeight: 500, color: "#5C5647", display: "block", marginBottom: 6, fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Cliente</label>
                <SearchableSelect
                  options={(clients ?? []).map((x) => ({
                    value: x.id,
                    label: (x.name && x.name.trim()) || (x.fullName && x.fullName.trim()) || x.email || "Sem nome",
                    sublabel: x.phone ? formatPhone(x.phone) : (x.email || undefined),
                  }))}
                  value={pdfClienteId}
                  onChange={setPdfClienteId}
                  placeholder="Buscar cliente por nome ou telefone..."
                  emptyOptionLabel="Nenhum"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowNewClient(true)}
                style={{
                  padding: "0 14px", borderRadius: 10, height: 40, flexShrink: 0,
                  border: "1px solid rgba(74,222,128,0.2)", background: "rgba(74,222,128,0.06)",
                  color: "#4ADE80", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                  alignSelf: isMobile ? "stretch" : "flex-end",
                }}
              >
                + Novo
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ fontSize: 8, fontWeight: 500, color: "#5C5647", display: "block", marginBottom: 6, fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Corretor</label>
                <SearchableSelect
                  options={(brokers ?? [])
                    .filter((x) => x.status === "active")
                    .map((x) => ({
                      value: x.id,
                      label: (x.name && x.name.trim()) || "Sem nome",
                      sublabel: x.brokerageName || undefined,
                    }))}
                  value={pdfCorretorId}
                  onChange={setPdfCorretorId}
                  placeholder="Buscar corretor por nome ou imobiliária..."
                  emptyOptionLabel="Nenhum"
                />
              </div>
            </div>
          </SC>
        </div>

        {/* Desktop summary */}
        {!isMobile ? (
          <div style={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 10 }}>
            {valorUnidade > 0 ? (
              <>
                <SC style={{ background: isConsistente ? "linear-gradient(145deg, rgba(74,222,128,0.07), var(--surface-base))" : "linear-gradient(145deg, rgba(248,113,113,0.06), var(--surface-base))", border: `1px solid ${isConsistente ? "rgba(74,222,128,0.18)" : "rgba(248,113,113,0.22)"}`, position: "relative" }}>
                  <div aria-hidden style={{ position: "absolute", top: -30, right: -30, width: 100, height: 100, borderRadius: "50%", background: isConsistente ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.08)", filter: "blur(25px)", pointerEvents: "none" }} />
                  <div style={{ position: "relative", zIndex: 1 }}>
                  {sim.numeroParcelas > 0 ? (<><div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>Parcela mensal</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: isConsistente ? "#4ADE80" : "#F87171", fontFamily: "var(--font-mono)", lineHeight: 1.1, transition: "all 0.15s" }}>{fmt(c.parcelaValor)}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-disabled)", marginTop: 6 }}>por mês · {sim.numeroParcelas}x · sem banco</div></>) : (<><div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>Pagamento à vista</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: isConsistente ? "#4ADE80" : "#F87171", fontFamily: "var(--font-mono)", lineHeight: 1.1, transition: "all 0.15s" }}>{fmt(c.valorNegociado)}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-disabled)", marginTop: 6 }}>valor negociado · sem parcelas</div></>)}
                  </div>
                </SC>
                <CompositionDonut
                  entrada={c.entradaValor}
                  parcelas={sim.numeroParcelas > 0 ? c.saldoFinanciar : 0}
                  balao={sim.balaoAtivo ? c.totalBalaos : 0}
                  permuta={sim.permutaAtiva ? c.totalPermuta : 0}
                  total={c.valorNegociado}
                />
                <SC>
                  <RR label="Valor de tabela" value={fmt(c.valorOriginal)} />
                  {c.desconto > 0 ? <RR label={`Desconto (${sim.descontoPct}%)`} value={`- ${fmt(c.desconto)}`} /> : null}
                  <RR label="Valor negociado" value={fmt(c.valorNegociado)} hl />
                  {c.entradaValor > 0.5 && <RR label={sim.entradaModoValor ? "Entrada" : `Entrada (${Math.round(c.entradaPctEfetivo)}%)`} value={fmt(c.entradaValor)} sub={sim.entradaParcelada ? `${sim.entradaParceladaVezes}x de ${fmt(c.entradaParceladaValor)}` : "À vista"} />}
                  {sim.permutaAtiva && c.totalPermuta > 0 ? <RR label="Permuta" value={fmt(c.totalPermuta)} /> : null}
                  {sim.balaoAtivo && c.totalBalaos > 0 ? <RR label={`Balão (${sim.balaoQuantidade}x)`} value={fmt(c.totalBalaos)} sub={`${sim.balaoQuantidade}x de ${fmt(c.balaoValorEfetivo)}`} /> : null}
                  {c.saldoFinanciar > 0.5 && (
                  <div style={{ marginTop: 6, padding: "10px 12px", background: "var(--surface-base)", borderRadius: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{sim.numeroParcelas > 0 ? saldoLabel.titulo : "Saldo à vista"}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{fmt(c.saldoFinanciar)}</div>
                    </div>
                    <div style={{ fontSize: 11, color: "#5C5647", marginTop: 2 }}>{sim.numeroParcelas > 0 ? `${sim.numeroParcelas}x de ${fmt(c.parcelaValor)}` : "Pagamento integral"}</div>
                    {sim.numeroParcelas > 0 && saldoLabel.subtitulo ? <div style={{ fontSize: 11, color: "#5C5647", marginTop: 2 }}>{saldoLabel.subtitulo}</div> : null}
                  </div>
                  )}
                  {/* TOTAL line */}
                  <div style={{ marginTop: 8, padding: "10px 12px", background: c.validacoes.somaConsistente ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)", borderRadius: 8, border: `1px solid ${c.validacoes.somaConsistente ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.3)"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: c.validacoes.somaConsistente ? "#4ADE80" : "#F87171", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>TOTAL</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: c.validacoes.somaConsistente ? "#4ADE80" : "#F87171", fontFamily: "var(--font-mono)" }}>{fmt(c.totalComposicao)}</div>
                    </div>
                    {!c.validacoes.somaConsistente && c.diferenca > 0 ? <div style={{ fontSize: 11, color: "#F87171", marginTop: 4 }}>Diferença de {fmt(c.diferenca)} — ajuste os valores</div> : null}
                  </div>
                  {/* Coverage bar */}
                  {c.valorNegociado > 0 && (() => { const pct = Math.round((c.totalComposicao / c.valorNegociado) * 100); const barBg = pct >= 100 ? "linear-gradient(90deg, #22C55E, #4ADE80)" : pct >= 80 ? "linear-gradient(90deg, #D97706, #FBBF24)" : "linear-gradient(90deg, #DC2626, #F87171)"; const labelColor = pct >= 100 ? "#4ADE80" : pct >= 80 ? "#FBBF24" : "#F87171"; return <div style={{ marginTop: 8 }}><div style={{ height: 6, borderRadius: 3, background: "var(--surface-overlay)", overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: barBg, borderRadius: 3, transition: "width 0.3s" }} /></div><div style={{ fontSize: 11, color: labelColor, marginTop: 4, fontFamily: "var(--font-mono)" }}>{pct}% coberto</div></div>; })()}
                  {(sim.campoFixado || sim.entradaModoValor) && <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-disabled)", display: "flex", alignItems: "center", gap: 6 }}><span style={{ color: "#4ADE80" }}>●</span> {[sim.entradaModoValor ? "Entrada fixada" : null, sim.campoFixado === "parcela" ? "Parcela fixada" : sim.campoFixado === "balao" ? "Balão fixado" : null].filter(Boolean).join(" · ")} — valores se ajustam automaticamente {sim.campoFixado && <button type="button" onClick={sim.limparFixacao} style={{ background: "none", border: "none", color: "var(--text-disabled)", fontSize: 11, cursor: "pointer", textDecoration: "underline", padding: 0 }}>limpar</button>}</div>}
                  {showComissao ? <div style={{ marginTop: 10, padding: "10px 12px", background: "rgba(96,165,250,0.08)", borderRadius: 8, border: "1px solid rgba(96,165,250,0.2)" }}><div style={{ fontSize: 10, color: "#60A5FA", fontFamily: "var(--font-mono)" }}>SUA COMISSÃO</div><div style={{ fontSize: 16, fontWeight: 700, color: "#60A5FA", fontFamily: "var(--font-mono)" }}>{fmt(c.comissaoValor)}</div></div> : null}
                </SC>
              </>
            ) : <SC style={{ textAlign: "center" }}><div style={{ marginBottom: 12, opacity: 0.4 }}><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div><div style={{ fontSize: 14, color: "var(--text-disabled)" }}>{tipoAtivo === "unidade" ? "Selecione uma unidade" : "Selecione um imóvel"}</div></SC>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {isConsistente && temImovelSelecionado ? (
                <button type="button" onClick={() => { setErroEnvio(null); void iniciarNegociacao(montarInput()); }} disabled={!pdfClienteId || iniciando || salvando} title={!pdfClienteId ? "Selecione um cliente" : ""} style={{ width: "100%", padding: "13px 16px", borderRadius: 10, border: "none", background: (!pdfClienteId || iniciando) ? "rgba(74,222,128,0.3)" : "#4ADE80", color: "var(--interactive-on-primary)", cursor: (!pdfClienteId || iniciando) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ textAlign: "left" }}><div style={{ fontSize: 14, fontWeight: 700 }}>{iniciando ? "Iniciando..." : "Iniciar negociação"}</div><div style={{ fontSize: 11, opacity: 0.7, marginTop: 1 }}>{!pdfClienteId ? "Selecione um cliente" : "Cliente confirmado"}</div></div>
                  <span style={{ fontSize: 16 }}>→</span>
                </button>
              ) : null}
              {temImovelSelecionado ? (
                <button type="button" onClick={() => { setErroEnvio(null); setShowFollowUp(true); }} disabled={salvando || iniciando} style={{ width: "100%", padding: "13px 16px", borderRadius: 10, border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ textAlign: "left" }}><div style={{ fontSize: 14, fontWeight: 500 }}>{salvando ? "Salvando..." : "Salvar como simulação"}</div><div style={{ fontSize: 11, color: "var(--text-disabled)", marginTop: 1 }}>Rascunho para consulta futura</div></div>
                  <span style={{ fontSize: 14, color: "var(--text-disabled)" }}>○</span>
                </button>
              ) : null}
              {sucessoEnvio ? <div style={{ fontSize: 12, color: "var(--color-sprout)", background: "var(--color-sprout-muted)", border: "1px solid var(--color-sprout)", borderRadius: 8, padding: "8px 12px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>{sucessoEnvio}</span>{lastSavedId && accountId && userId && <button type="button" onClick={async () => { try { const url = await createShareLink({ accountId, entityType: "simulation", entityId: lastSavedId, createdBy: userId, developmentId: developmentId ?? undefined }); await copyShareLink(url); setShareMsg("Link copiado!"); setTimeout(() => setShareMsg(null), 3000); } catch { setShareMsg("Erro ao gerar link"); } }} style={{ background: "none", border: "1px solid var(--color-sprout)", borderRadius: 6, color: "var(--color-sprout)", fontSize: 11, fontWeight: 600, padding: "4px 10px", cursor: "pointer", whiteSpace: "nowrap" }}>{shareMsg || "Compartilhar"}</button>}</div> : null}
              {/* Engrenagem Comercial v1 — CTA contextual quando simulação foi salva vinculada a uma negociação. */}
              {sucessoEnvio && lastSavedId && negotiationIdParam ? (
                <button type="button" onClick={() => navigate(`/negociacoes/${negotiationIdParam}?createProposalFrom=${lastSavedId}`)} style={{ width: "100%", padding: "13px 16px", borderRadius: 10, border: "none", background: "linear-gradient(180deg, #4ADE80 0%, #3FC970 100%)", color: "var(--interactive-on-primary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, fontWeight: 600, fontSize: 14, boxShadow: "0 1px 0 rgba(255,255,255,0.15) inset", WebkitAppearance: "none", appearance: "none" }}>
                  <div style={{ textAlign: "left" }}>
                    <div>Criar proposta a partir desta simulação</div>
                    <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.7, marginTop: 1 }}>Abrir negociação com dados pré-preenchidos</div>
                  </div>
                  <span style={{ fontSize: 16 }}>→</span>
                </button>
              ) : null}
              {erroEnvio ? <div style={{ fontSize: 12, color: "#F87171", background: "rgba(248,113,113,0.08)", borderRadius: 8, padding: "8px 12px", marginBottom: 8 }}>{erroEnvio}</div> : null}
              <button type="button" onClick={() => void handleGerarPdf()} disabled={gerandoPDF || !temImovelSelecionado} style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", background: temImovelSelecionado ? "var(--interactive-primary)" : "var(--surface-overlay)", color: temImovelSelecionado ? "var(--interactive-on-primary)" : "var(--text-disabled)", fontSize: 14, fontWeight: 700, cursor: temImovelSelecionado ? "pointer" : "not-allowed" }}>{gerandoPDF ? "Gerando PDF..." : "Gerar PDF"}</button>
              <button type="button" onClick={limpar} style={{ background: "none", border: "none", color: "var(--text-disabled)", fontSize: 12, cursor: "pointer", padding: "4px", textAlign: "center" }}>Limpar simulação</button>

              {/* ── Multi-unit group ── */}
              {tipoAtivo === "unidade" && (
                <div style={{ marginTop: 12 }}>
                  {groupItems.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
                        UNIDADES NA SIMULAÇÃO ({groupItems.length + (selectedUnit ? 1 : 0)})
                      </div>
                      {groupItems.map((g, idx) => (
                        <div key={g.unitId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", marginBottom: 4, background: "var(--surface-base)", border: "1px solid var(--border-subtle)", borderRadius: 8 }}>
                          <div>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{g.label}</span>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>{fmt(g.valorTotal)}</span>
                          </div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--interactive-primary)" }}>{g.parcelas}x {fmt(g.parcelaValor)}</span>
                            <button type="button" onClick={() => removeGroupItem(idx)} style={{ color: "var(--text-disabled)", cursor: "pointer", background: "none", border: "none", fontSize: 16, lineHeight: 1, padding: "2px 4px" }}>×</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedUnit && isConsistente && (
                    <button type="button" onClick={addCurrentToGroup} style={{ width: "100%", padding: "10px", border: "1px dashed var(--border-strong)", borderRadius: 8, background: "transparent", color: "var(--text-muted)", fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Adicionar outra unidade</button>
                  )}
                  {groupItems.length > 0 && (
                    <div style={{ marginTop: 10, padding: "14px 16px", background: "linear-gradient(135deg, rgba(74,222,128,0.06), rgba(74,222,128,0.02))", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 10 }}>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--interactive-primary)", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 600 }}>TOTAL CONSOLIDADO</div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Valor total</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{fmt(groupTotalValor)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Entrada total</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>{fmt(groupTotalEntrada)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Parcela mensal total</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--interactive-primary)" }}>{fmt(groupTotalParcela)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Mobile bottom bar — via createPortal to escape stacking context */}
      {isMobile && (selectedUnit || selectedProperty) && (c.parcelaValor > 0 || sim.numeroParcelas === 0) ? <div style={{ height: 100 }} /> : null}
      {isMobile && (selectedUnit || selectedProperty) && (c.parcelaValor > 0 || sim.numeroParcelas === 0) && createPortal(
        <div style={{ position: "fixed", bottom: screen.isMobile ? "calc(56px + env(safe-area-inset-bottom))" : 0, left: 0, right: 0, zIndex: 950, background: "rgba(18,17,15,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: "1px solid var(--border-default)", padding: "12px 18px", paddingBottom: screen.isMobile ? 12 : "max(12px, env(safe-area-inset-bottom))", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            {sim.numeroParcelas > 0 ? (<>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>{fmt(c.parcelaValor)}<span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-muted)" }}>/mês</span></div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{sim.numeroParcelas}x · sem banco</div>
            </>) : (<>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#4ADE80", letterSpacing: "-0.03em" }}>À vista</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{fmt(c.valorNegociado)}</div>
            </>)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => void handleGerarPdf()} disabled={gerandoPDF} style={{ fontSize: 13, fontWeight: 600, padding: "10px 16px", borderRadius: 10, cursor: "pointer", background: "transparent", color: "var(--text-secondary)", border: "1.5px solid var(--border-strong)" }}>{gerandoPDF ? "..." : "PDF"}</button>
            <button type="button" onClick={() => setShowFollowUp(true)} disabled={salvando} style={{ fontSize: 13, fontWeight: 600, padding: "10px 16px", borderRadius: 10, cursor: "pointer", background: "var(--interactive-primary)", color: "var(--interactive-on-primary)", border: "none" }}>Proposta</button>
          </div>
        </div>,
        document.body
      )}

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
        subtitle={groupItems.length > 0 ? `${groupItems.length + (selectedUnit ? 1 : 0)} unidades` : selectedUnit ? `Q${selectedUnit.quadra} · L${selectedUnit.lote}` : undefined}
        onCancel={() => setShowFollowUp(false)}
        onConfirm={async (date) => {
          setShowFollowUp(false);
          // Save current unit (always)
          void salvarComoSimulacao({ ...montarInput(), followUpAt: date });
          // Salva o grupo multi-unidade via serviço (Etapa 5c — regra/escrita fora do JSX).
          if (groupItems.length > 0 && accountId && developmentId && supabase) {
            const grupoBrokerId = pdfCorretorId || authenticatedProfile?.id || null;
            const grupoCreatedBy = authenticatedProfile?.id || null;
            const grupoClientId = pdfClienteId || null;
            const currentItem = selectedUnit ? {
              unitId: selectedUnit.id,
              valorTotal: c.valorNegociado, entradaPct: Math.round(c.entradaPctEfetivo), entradaValor: c.entradaValor,
              parcelas: sim.numeroParcelas, parcelaValor: c.parcelaValor,
              balaoQtd: sim.balaoAtivo ? sim.balaoQuantidade : 0, balaoValor: sim.balaoAtivo ? c.balaoValorEfetivo : 0,
              permutaValor: sim.permutaAtiva ? c.totalPermuta : 0, permutaDesc: "",
            } : null;
            await salvarGrupoSimulacao({
              accountId, developmentId, clientId: grupoClientId, brokerId: grupoBrokerId, createdBy: grupoCreatedBy,
              title: `Simulação ${groupItems.length + (selectedUnit ? 1 : 0)} unidades`,
              valorTotalGrupo: groupTotalValor,
              groupItems: groupItems.map((g) => ({
                unitId: g.unitId, valorTotal: g.valorTotal, entradaPct: g.entradaPct, entradaValor: g.entradaValor,
                parcelas: g.parcelas, parcelaValor: g.parcelaValor,
                balaoQtd: g.balaoQtd, balaoValor: g.balaoValor, permutaValor: g.permutaValor, permutaDesc: g.permutaDesc,
              })),
              currentItem,
            });
            setGroupItems([]);
          }
        }}
      />
    </div>
  );
}

// ── UI components ──

function formatCompactBRL(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `R$ ${m >= 10 || m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `R$ ${Math.round(value / 1_000)}K`;
  }
  return `R$ ${Math.round(value)}`;
}

function CompositionDonut({ entrada, parcelas, balao, permuta, total }: { entrada: number; parcelas: number; balao: number; permuta: number; total: number }) {
  if (total <= 0) return null;
  const segments = [
    { label: "Entrada", value: entrada, color: "#4ADE80" },
    { label: "Parcelas", value: parcelas, color: "#60A5FA" },
    { label: "Balão", value: balao, color: "#D97706" },
    { label: "Permuta", value: permuta, color: "#A78BFA" },
  ].filter((s) => s.value > 0);
  if (segments.length === 0) return null;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;
  return (
    <div style={{ padding: "16px 20px", background: "linear-gradient(145deg, var(--surface-raised), var(--surface-base))", border: "1px solid var(--border-default)", borderRadius: 12 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.12em", marginBottom: 12, fontWeight: 600 }}>COMPOSIÇÃO FINANCEIRA</div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <svg width="120" height="120" viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
          <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--surface-overlay)" strokeWidth="12" />
          {segments.map((seg) => {
            const pct = seg.value / total;
            const dashLength = pct * circumference;
            const dashOffset = -accumulated * circumference;
            accumulated += pct;
            return (
              <circle key={seg.label} cx="60" cy="60" r={radius} fill="none" stroke={seg.color} strokeWidth="12"
                strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 60 60)"
                style={{ transition: "stroke-dasharray 0.4s ease, stroke-dashoffset 0.4s ease" }} />
            );
          })}
          <text x="60" y="54" textAnchor="middle" style={{ fontFamily: "var(--font-mono)", fontSize: 9, fill: "var(--text-muted)", letterSpacing: "0.08em" }}>TOTAL</text>
          <text x="60" y="72" textAnchor="middle" style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, fill: "var(--text-primary)" }}>{formatCompactBRL(total)}</text>
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
          {segments.map((seg) => {
            const pct = ((seg.value / total) * 100).toFixed(0);
            return (
              <div key={seg.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{seg.label}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: seg.color, flexShrink: 0 }}>{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SC({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: "linear-gradient(145deg, var(--surface-raised), var(--surface-base))", border: "1px solid var(--border-default)", borderRadius: 12, padding: "20px 24px", boxSizing: "border-box", maxWidth: "100%", overflow: "hidden", ...style }}>{children}</div>;
}
// SL removed — section labels are now inline
function MS({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span><span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: green ? "var(--interactive-primary)" : "var(--text-secondary)" }}>{value}</span></div>;
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
          <input type="number" value={value} min={min} max={max} onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value))))} onFocus={(e) => e.target.select()} style={{ width: 64, background: "var(--surface-base)", border: `1px solid ${error ? "rgba(217,119,6,0.4)" : "var(--border-strong)"}`, borderRadius: 6, padding: "4px 8px", color: "var(--text-secondary)", fontSize: 14, fontWeight: 600, textAlign: "right", outline: "none", fontFamily: "var(--font-mono)" }} />
          {suffix ? <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{suffix}</span> : null}
        </div>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: "100%", accentColor: "#4ADE80", cursor: "pointer", height: 4 }} />
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

const INP_S: React.CSSProperties = { width: "100%", background: "var(--surface-base)", border: "1px solid var(--border-strong)", borderRadius: 8, padding: "10px 12px", color: "var(--text-secondary)", fontSize: 14, outline: "none", fontFamily: "var(--font-mono)", boxSizing: "border-box" };
const LBL_S: React.CSSProperties = { fontSize: 12, color: "var(--text-muted)", fontWeight: 500, display: "block", marginBottom: 6 };
