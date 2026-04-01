import { useEffect, useState } from "react";
import { canPerformAction, PermissionAction } from "../../../app/authorization/permissions";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { getUserRoleLabel } from "../../../shared/types/role";
import { useCommercialSettings } from "../hooks/useCommercialSettings";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import { supabase } from "../../../infra/supabase/supabaseClient";
import UploadImagem from "../../../shared/components/UploadImagem";
import EditorMapaPins from "../components/EditorMapaPins";
import { useUnits } from "../../units/hooks/useUnits";

type Aba = "marca" | "empreendimento" | "documentos" | "operacao" | "materiais";

const INPUT: React.CSSProperties = { width: "100%", boxSizing: "border-box", background: "var(--color-ink)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "10px 14px", color: "var(--color-bone)", fontSize: 14 };

export default function SettingsPage() {
  const actx = useAccount();
  const dctx = useDevelopment();
  const screen = useScreen();
  const isMobile = !screen.isDesktop;
  const ss = useCommercialSettings(actx.account?.accountId ?? null, dctx.development?.developmentId ?? null, actx.isUsingMock || dctx.isUsingMock, actx.account?.role ?? null);
  const { units: allUnits } = useUnits(actx.account?.accountId ?? null, dctx.development?.developmentId ?? null, actx.isUsingMock || dctx.isUsingMock);
  const canUpd = canPerformAction(actx.account?.role ?? null, PermissionAction.UPDATE_SETTINGS);
  const saving = ss.isSaving;
  const dis = !canUpd || saving;

  const [aba, setAba] = useState<Aba>("marca");
  const [msg, setMsg] = useState<string | null>(null);

  // Account form
  const [af, setAf] = useState({ reservationDurationHours: 48, requireAccepted: true, requireComplete: false, queueEnabled: false, logoUrl: "", corPrimaria: "#14532d", corSecundaria: "#16a34a", nomeComercial: "", site: "", telefone: "", slogan: "", fraseImpactoPdf: "Patrimonio nao se constroi esperando o momento certo. O momento certo e quando voce age.", tituloProposta: "", bulletPdf1: "", bulletPdf2: "", bulletPdf3: "" });

  // Development form
  const [df, setDf] = useState({
    reservationDurationHours: "", requireAccepted: "", requireComplete: "", queueEnabled: "",
    logoEmpreendimentoUrl: "", imagemCapaUrl: "", corEmpreendimento: "",
    entradaMinimaPct: 10, entradaMaximaPct: 80, entradaParceladaPermitida: true, entradaParceladaMaxVezes: 12,
    parcelasMinimas: 12, parcelasMaximas: 120, indicePreEntrega: "INCC", indicePosEntrega: "IPCA",
    dataEntregaEmpreendimento: "", carenciaMaximaMeses: 6,
    aceitaBalao: true, balaoMaxQuantidade: 12, aceitaPermuta: true, permutaValorMaximoPct: 30,
    descontoMaximoPct: 5, comissaoCorretorPct: 4, aceitaDesconto: true,
    tipoSaldo: "parcelas_incorporadora" as string, textoSaldoPersonalizado: "",
    usarLogoEmpreendimentoNoPdf: true, usarCorEmpreendimentoNoPdf: false, incluirFotoCapaNoPdf: false,
    aceitaSaldoEntrega: false, saldoEntregaMaxPct: 30, textoSaldoEntrega: "",
    labelAgrupamento: "Quadra", labelUnidade: "Lote", labelArea: "m²",
    mapaUrl: "", mapaConfigurado: false,
    pdfTitulo: "", pdfBullet1: "", pdfBullet2: "", pdfBullet3: "",
    pdfDisclaimer: "", pdfFraseRodape: "", pdfValidadeHoras: 48, pdfTextoParcelamento: "",
  });

  // Drive folder
  const [driveLink, setDriveLink] = useState("");
  const [driveSaved, setDriveSaved] = useState(false);
  const [driveTesting, setDriveTesting] = useState(false);
  const [driveTestResult, setDriveTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [driveSaving, setDriveSaving] = useState(false);
  const SA_EMAIL = "nexa-drive@eighth-way-491210-e6.iam.gserviceaccount.com";

  useEffect(() => {
    if (!supabase || !dctx.development?.developmentId) return;
    supabase.from("developments").select("drive_folder_id").eq("id", dctx.development.developmentId).maybeSingle().then(({ data }) => {
      if (data?.drive_folder_id) { setDriveLink(`https://drive.google.com/drive/folders/${data.drive_folder_id}`); setDriveSaved(true); }
    });
  }, [dctx.development?.developmentId]);

  function extractFolderId(url: string): string | null {
    const m = url.match(/folders\/([a-zA-Z0-9_-]+)/);
    return m ? m[1] : null;
  }

  async function handleDriveTest() {
    const fid = extractFolderId(driveLink);
    if (!fid || !supabase) return;
    setDriveTesting(true); setDriveTestResult(null);
    try {
      const { data: s } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/drive-files`, {
        method: "POST", headers: { Authorization: `Bearer ${s.session?.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ folder_id: fid }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || "Sem acesso");
      setDriveTestResult({ ok: true, msg: `Conexão estabelecida! ${(d.files ?? []).length} arquivos encontrados.` });
    } catch (e: unknown) { setDriveTestResult({ ok: false, msg: e instanceof Error ? e.message : "Sem acesso. Verifique se compartilhou a pasta." }); }
    finally { setDriveTesting(false); }
  }

  async function handleDriveSave() {
    const fid = extractFolderId(driveLink);
    if (!fid || !supabase || !dctx.development?.developmentId) return;
    setDriveSaving(true);
    const { error } = await supabase.from("developments").update({ drive_folder_id: fid }).eq("id", dctx.development.developmentId);
    setDriveSaving(false);
    if (error) { setMsg("Erro ao salvar: " + error.message); } else { setMsg("Pasta do Drive salva!"); setDriveSaved(true); setTimeout(() => setMsg(null), 3000); }
  }

  useEffect(() => {
    if (!ss.accountSettings) return;
    const a = ss.accountSettings;
    setAf({ reservationDurationHours: a.reservationDurationHours, requireAccepted: a.requireAcceptedProposalForReservationRequest, requireComplete: a.requireCompleteClientDataForReservationRequest, queueEnabled: a.queueEnabled, logoUrl: a.logoUrl ?? "", corPrimaria: a.corPrimaria, corSecundaria: a.corSecundaria, nomeComercial: a.nomeComercial ?? "", site: a.site ?? "", telefone: a.telefone ?? "", slogan: a.slogan ?? "", fraseImpactoPdf: a.fraseImpactoPdf, tituloProposta: a.tituloProposta ?? "", bulletPdf1: a.bulletPdf1 ?? "", bulletPdf2: a.bulletPdf2 ?? "", bulletPdf3: a.bulletPdf3 ?? "" });
  }, [ss.accountSettings]);

  useEffect(() => {
    if (!ss.developmentSettings) return;
    const d = ss.developmentSettings;
    setDf({
      reservationDurationHours: d.reservationDurationHours?.toString() ?? "",
      requireAccepted: d.requireAcceptedProposalForReservationRequest === null ? "" : d.requireAcceptedProposalForReservationRequest ? "true" : "false",
      requireComplete: d.requireCompleteClientDataForReservationRequest === null ? "" : d.requireCompleteClientDataForReservationRequest ? "true" : "false",
      queueEnabled: d.queueEnabled === null ? "" : d.queueEnabled ? "true" : "false",
      logoEmpreendimentoUrl: d.logoEmpreendimentoUrl ?? "", imagemCapaUrl: d.imagemCapaUrl ?? "", corEmpreendimento: d.corEmpreendimento ?? "",
      entradaMinimaPct: d.entradaMinimaPct, entradaMaximaPct: d.entradaMaximaPct,
      entradaParceladaPermitida: d.entradaParceladaPermitida, entradaParceladaMaxVezes: d.entradaParceladaMaxVezes,
      parcelasMinimas: d.parcelasMinimas, parcelasMaximas: d.parcelasMaximas,
      indicePreEntrega: d.indicePreEntrega, indicePosEntrega: d.indicePosEntrega,
      dataEntregaEmpreendimento: d.dataEntregaEmpreendimento ?? "", carenciaMaximaMeses: d.carenciaMaximaMeses,
      aceitaBalao: d.aceitaBalao, balaoMaxQuantidade: d.balaoMaxQuantidade,
      aceitaPermuta: d.aceitaPermuta, permutaValorMaximoPct: d.permutaValorMaximoPct,
      descontoMaximoPct: d.descontoMaximoPct, comissaoCorretorPct: d.comissaoCorretorPct,
      aceitaDesconto: d.descontoMaximoPct > 0,
      tipoSaldo: d.tipoSaldo, textoSaldoPersonalizado: d.textoSaldoPersonalizado ?? "",
      usarLogoEmpreendimentoNoPdf: d.usarLogoEmpreendimentoNoPdf, usarCorEmpreendimentoNoPdf: d.usarCorEmpreendimentoNoPdf, incluirFotoCapaNoPdf: d.incluirFotoCapaNoPdf,
      aceitaSaldoEntrega: d.aceitaSaldoEntrega, saldoEntregaMaxPct: d.saldoEntregaMaxPct, textoSaldoEntrega: d.textoSaldoEntrega ?? "",
      labelAgrupamento: d.labelAgrupamento, labelUnidade: d.labelUnidade, labelArea: d.labelArea,
      mapaUrl: d.mapaUrl ?? "", mapaConfigurado: d.mapaConfigurado,
      pdfTitulo: d.pdfTitulo ?? "", pdfBullet1: d.pdfBullet1 ?? "", pdfBullet2: d.pdfBullet2 ?? "", pdfBullet3: d.pdfBullet3 ?? "",
      pdfDisclaimer: d.pdfDisclaimer ?? "", pdfFraseRodape: d.pdfFraseRodape ?? "", pdfValidadeHoras: d.pdfValidadeHoras, pdfTextoParcelamento: d.pdfTextoParcelamento ?? "",
    });
  }, [ss.developmentSettings]);

  // Guard: apenas director pode acessar configurações
  if (actx.account?.role && actx.account.role !== "director" && (actx.account.role as string) !== "owner") {
    return <p style={{ color: "var(--color-fog)" }}>Acesso restrito ao diretor da conta.</p>;
  }

  if (ss.isLoading) return <p style={{ color: "var(--color-fog)" }}>Carregando configurações...</p>;
  if (actx.status === "no_access" || actx.status === "error") return <p style={{ color: "var(--color-fog)" }}>{actx.errorMessage}</p>;
  if (dctx.status === "empty" || dctx.status === "error") return <p style={{ color: "var(--color-fog)" }}>{dctx.errorMessage}</p>;

  function flash() { setMsg("Salvo com sucesso"); setTimeout(() => setMsg(null), 3000); }

  async function saveAccount() {
    await ss.updateAccountSettings({ reservationDurationHours: af.reservationDurationHours, requireAcceptedProposalForReservationRequest: af.requireAccepted, requireCompleteClientDataForReservationRequest: af.requireComplete, queueEnabled: af.queueEnabled, logoUrl: af.logoUrl || null, corPrimaria: af.corPrimaria, corSecundaria: af.corSecundaria, nomeComercial: af.nomeComercial || null, site: af.site || null, telefone: af.telefone || null, slogan: af.slogan || null, fraseImpactoPdf: af.fraseImpactoPdf, tituloProposta: af.tituloProposta || null, bulletPdf1: af.bulletPdf1 || null, bulletPdf2: af.bulletPdf2 || null, bulletPdf3: af.bulletPdf3 || null });
    flash();
  }

  async function saveDev() {
    await ss.updateDevelopmentSettings({
      reservationDurationHours: df.reservationDurationHours === "" ? null : Number(df.reservationDurationHours),
      requireAcceptedProposalForReservationRequest: df.requireAccepted === "" ? null : df.requireAccepted === "true",
      requireCompleteClientDataForReservationRequest: df.requireComplete === "" ? null : df.requireComplete === "true",
      queueEnabled: df.queueEnabled === "" ? null : df.queueEnabled === "true",
      logoEmpreendimentoUrl: df.logoEmpreendimentoUrl || null, imagemCapaUrl: df.imagemCapaUrl || null, corEmpreendimento: df.corEmpreendimento || null,
      entradaMinimaPct: df.entradaMinimaPct, entradaMaximaPct: df.entradaMaximaPct,
      entradaParceladaPermitida: df.entradaParceladaPermitida, entradaParceladaMaxVezes: df.entradaParceladaMaxVezes,
      parcelasMinimas: df.parcelasMinimas, parcelasMaximas: df.parcelasMaximas,
      indicePreEntrega: df.indicePreEntrega, indicePosEntrega: df.indicePosEntrega,
      dataEntregaEmpreendimento: df.dataEntregaEmpreendimento || null, carenciaMaximaMeses: df.carenciaMaximaMeses,
      aceitaBalao: df.aceitaBalao, balaoMaxQuantidade: df.balaoMaxQuantidade,
      aceitaPermuta: df.aceitaPermuta, permutaValorMaximoPct: df.permutaValorMaximoPct,
      descontoMaximoPct: df.aceitaDesconto ? df.descontoMaximoPct : 0, comissaoCorretorPct: df.comissaoCorretorPct,
      tipoSaldo: df.aceitaSaldoEntrega ? "saldo_entrega" : "parcelas_incorporadora" as "parcelas_incorporadora" | "financiamento_bancario" | "saldo_entrega",
      textoSaldoPersonalizado: df.textoSaldoEntrega?.trim() || df.textoSaldoPersonalizado?.trim() || null,
      usarLogoEmpreendimentoNoPdf: df.usarLogoEmpreendimentoNoPdf, usarCorEmpreendimentoNoPdf: df.usarCorEmpreendimentoNoPdf, incluirFotoCapaNoPdf: df.incluirFotoCapaNoPdf,
      aceitaSaldoEntrega: df.aceitaSaldoEntrega, saldoEntregaMaxPct: df.saldoEntregaMaxPct, textoSaldoEntrega: df.textoSaldoEntrega?.trim() || null,
      labelAgrupamento: df.labelAgrupamento, labelUnidade: df.labelUnidade, labelArea: df.labelArea,
      mapaUrl: df.mapaUrl || null, mapaConfigurado: df.mapaConfigurado,
      pdfTitulo: df.pdfTitulo?.trim() || null, pdfBullet1: df.pdfBullet1?.trim() || null, pdfBullet2: df.pdfBullet2?.trim() || null, pdfBullet3: df.pdfBullet3?.trim() || null,
      pdfDisclaimer: df.pdfDisclaimer?.trim() || null, pdfFraseRodape: df.pdfFraseRodape?.trim() || null, pdfValidadeHoras: df.pdfValidadeHoras, pdfTextoParcelamento: df.pdfTextoParcelamento?.trim() || null,
    });
    flash();
  }

  const tabs: { key: Aba; label: string; icon: string }[] = [
    { key: "marca", label: "Marca", icon: "M" },
    { key: "empreendimento", label: "Empreendimento", icon: "E" },
    { key: "documentos", label: "Documentos", icon: "D" },
    { key: "operacao", label: "Operação", icon: "O" },
    { key: "materiais", label: "Materiais", icon: "G" },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--color-bone)", marginBottom: 4 }}>Configurações</h1>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-fog)", marginBottom: 24 }}>{actx.account?.accountName} · {dctx.development?.developmentName} · {getUserRoleLabel(actx.account?.role)}</div>
      {msg ? <div style={{ background: "var(--color-sprout-muted)", border: "1px solid var(--color-sprout)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "var(--color-sprout)" }}>{msg}</div> : null}
      {!canUpd ? <div style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.3)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: "var(--color-terracotta)" }}>Sem permissão para alterar.</div> : null}

      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 24 }}>
        <nav style={{ width: isMobile ? "100%" : 210, flexShrink: 0, display: "flex", flexDirection: isMobile ? "row" : "column", gap: 2 }}>
          {tabs.map((t) => (
            <button key={t.key} type="button" onClick={() => setAba(t.key)}
              style={{ flex: isMobile ? 1 : undefined, textAlign: "left", padding: "12px 16px", borderRadius: "0 8px 8px 0", background: aba === t.key ? "rgba(74,222,128,0.08)" : "transparent", color: aba === t.key ? "var(--color-sprout)" : "var(--color-fog)", border: "none", borderLeft: `3px solid ${aba === t.key ? "var(--color-sprout)" : "transparent"}`, fontSize: 13, fontWeight: aba === t.key ? 600 : 400, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, transition: "all 0.15s" }}>
              <span style={{ width: 24, height: 24, borderRadius: 6, background: aba === t.key ? "rgba(74,222,128,0.15)" : "var(--color-stone)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)", color: aba === t.key ? "var(--color-sprout)" : "var(--color-fog)" }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        <div style={{ flex: 1, minWidth: 0 }}>

          {/* ═══ MARCA ═══ */}
          {aba === "marca" ? (
            <div>
              <PageTitle title="Identidade da Marca" sub="Configurações que representam sua empresa em todo o sistema." />

              <Card>
                <Sec title="Identidade visual" sub="Aparece no cabeçalho dos documentos gerados" />
                <UploadImagem label="Logo da empresa" value={af.logoUrl || null} disabled={dis} preview="banner" onChange={(u) => setAf((c) => ({ ...c, logoUrl: u }))} />
                <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                  <ColorField label="Cor primária" value={af.corPrimaria} disabled={dis} onChange={(v) => setAf((c) => ({ ...c, corPrimaria: v }))} />
                  <ColorField label="Cor secundária" value={af.corSecundaria} disabled={dis} onChange={(v) => setAf((c) => ({ ...c, corSecundaria: v }))} />
                </div>
                <div style={{ marginTop: 12, padding: 12, background: af.corPrimaria, borderRadius: 8, borderBottom: `3px solid ${af.corSecundaria}` }}>
                  {af.logoUrl ? <img src={af.logoUrl} alt="" style={{ height: 24, objectFit: "contain" }} /> : <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{af.nomeComercial || actx.account?.accountName || "Sua Empresa"}</span>}
                </div>
                <SaveBtn onClick={() => void saveAccount()} saving={saving} />
              </Card>

              <Card>
                <Sec title="Informações da empresa" />
                <F label="Nome comercial" sub="Como a empresa aparece nos documentos. Se vazio, usa o nome da conta."><input style={INPUT} value={af.nomeComercial} disabled={dis} onChange={(e) => setAf((c) => ({ ...c, nomeComercial: e.target.value }))} placeholder="Bomm Urbanizadora" /></F>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                  <F label="Site"><input style={INPUT} type="url" value={af.site} disabled={dis} onChange={(e) => setAf((c) => ({ ...c, site: e.target.value }))} placeholder="https://suaempresa.com.br" /></F>
                  <F label="Telefone"><input style={INPUT} type="tel" value={af.telefone} disabled={dis} onChange={(e) => setAf((c) => ({ ...c, telefone: e.target.value }))} placeholder="(45) 99999-9999" /></F>
                </div>
                <F label="Slogan" sub="Tagline que aparece no rodapé dos documentos"><input style={INPUT} value={af.slogan} disabled={dis} onChange={(e) => setAf((c) => ({ ...c, slogan: e.target.value }))} placeholder="Velocidade para vender. Controle para crescer." /></F>
                <SaveBtn onClick={() => void saveAccount()} saving={saving} />
              </Card>

              <Card>
                <Sec title="Regras gerais" sub="Valem para todos os empreendimentos da conta" />
                <NumField label="Prazo padrão de reserva" sub="Horas até a reserva expirar" value={af.reservationDurationHours} suffix="h" min={1} max={720} disabled={dis} onChange={(v) => setAf((c) => ({ ...c, reservationDurationHours: v }))} />
                <Tog ativo={af.requireAccepted} disabled={dis} onChange={(v) => setAf((c) => ({ ...c, requireAccepted: v }))} label="Proposta aceita obrigatória para reserva" sub="O cliente precisa ter uma proposta aceita antes de solicitar reserva" />
                <Tog ativo={af.requireComplete} disabled={dis} onChange={(v) => setAf((c) => ({ ...c, requireComplete: v }))} label="Dados completos do cliente obrigatórios" sub="CPF, endereço e telefone precisam estar preenchidos" />
                <SaveBtn onClick={() => void saveAccount()} saving={saving} />
              </Card>
            </div>
          ) : null}

          {/* ═══ EMPREENDIMENTO ═══ */}
          {aba === "empreendimento" ? (
            <div>
              <div style={{ padding: "8px 14px", background: "rgba(74,222,128,0.08)", borderRadius: 8, border: "1px solid rgba(74,222,128,0.2)", fontSize: 13, color: "var(--color-sprout)", marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-sprout)" }} />
                <strong>{dctx.development?.developmentName}</strong>
                <span style={{ color: "var(--color-fog)", fontWeight: 400 }}>· Configurações específicas</span>
              </div>

              <Card>
                <Sec title="Identidade do empreendimento" sub="Identidade visual específica deste loteamento (opcional)" />
                <UploadImagem label="Logo do empreendimento" value={df.logoEmpreendimentoUrl || null} disabled={dis} preview="banner" onChange={(u) => setDf((c) => ({ ...c, logoEmpreendimentoUrl: u }))} />
                <div style={{ marginTop: 16 }}>
                  <UploadImagem label="Foto de capa (para o PDF)" value={df.imagemCapaUrl || null} disabled={dis} accept="image/png,image/jpeg" maxSizeMB={5} preview="banner" onChange={(u) => setDf((c) => ({ ...c, imagemCapaUrl: u }))} />
                </div>
                <div style={{ marginTop: 16 }}>
                  <ColorField label="Cor do empreendimento (opcional)" value={df.corEmpreendimento || "#16a34a"} disabled={dis} onChange={(v) => setDf((c) => ({ ...c, corEmpreendimento: v }))} />
                  <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 4 }}>Se vazio, usa a cor da marca.</div>
                </div>
                <SaveBtn onClick={() => void saveDev()} saving={saving} />
              </Card>

              <Card>
                <Sec title="Nomenclatura" sub="Como as unidades são chamadas neste empreendimento" />
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12 }}>
                  <F label="Agrupamento" sub="Ex: Quadra, Torre, Bloco"><input style={INPUT} value={df.labelAgrupamento} disabled={dis} onChange={(e) => setDf((c) => ({ ...c, labelAgrupamento: e.target.value }))} placeholder="Quadra" /></F>
                  <F label="Unidade" sub="Ex: Lote, Apartamento, Sala"><input style={INPUT} value={df.labelUnidade} disabled={dis} onChange={(e) => setDf((c) => ({ ...c, labelUnidade: e.target.value }))} placeholder="Lote" /></F>
                  <F label="Área" sub="Ex: m², ha"><input style={INPUT} value={df.labelArea} disabled={dis} onChange={(e) => setDf((c) => ({ ...c, labelArea: e.target.value }))} placeholder="m²" /></F>
                </div>
                <SaveBtn onClick={() => void saveDev()} saving={saving} />
              </Card>

              <Card>
                <Sec title="Mapa interativo" sub="Configure a planta do empreendimento com os lotes marcados" />
                <UploadImagem label="Planta do empreendimento (PNG ou JPG, até 10MB)" value={df.mapaUrl || null} disabled={dis} accept="image/png,image/jpeg" maxSizeMB={10} preview="banner"
                  onChange={(url) => setDf((c) => ({ ...c, mapaUrl: url }))} />
                <SaveBtn onClick={() => void saveDev()} saving={saving} />
                {df.mapaUrl && actx.account?.accountId && dctx.development?.developmentId ? (
                  <EditorMapaPins
                    mapaUrl={df.mapaUrl}
                    units={allUnits}
                    developmentId={dctx.development.developmentId}
                    accountId={actx.account.accountId}
                    labelAgrupamento={df.labelAgrupamento}
                    labelUnidade={df.labelUnidade}
                  />
                ) : null}
              </Card>

              <Card>
                <Sec title="Condições comerciais" sub="Define os limites que os corretores podem usar no simulador" />
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                  <NumField label="Entrada mínima" suffix="%" value={df.entradaMinimaPct} min={0} max={100} disabled={dis} onChange={(v) => setDf((c) => ({ ...c, entradaMinimaPct: v }))} />
                  <NumField label="Entrada máxima" suffix="%" value={df.entradaMaximaPct} min={0} max={100} disabled={dis} onChange={(v) => setDf((c) => ({ ...c, entradaMaximaPct: v }))} />
                </div>
                <Tog ativo={df.entradaParceladaPermitida} disabled={dis} onChange={(v) => setDf((c) => ({ ...c, entradaParceladaPermitida: v }))} label="Aceita entrada parcelada" sub="Cliente pode parcelar o valor da entrada" />
                {df.entradaParceladaPermitida ? <NumField label="Máximo de vezes" suffix="x" value={df.entradaParceladaMaxVezes} min={1} max={24} disabled={dis} onChange={(v) => setDf((c) => ({ ...c, entradaParceladaMaxVezes: v }))} /> : null}
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                  <NumField label="Mínimo de parcelas" suffix="x" value={df.parcelasMinimas} disabled={dis} onChange={(v) => setDf((c) => ({ ...c, parcelasMinimas: v }))} />
                  <NumField label="Máximo de parcelas" suffix="x" value={df.parcelasMaximas} disabled={dis} onChange={(v) => setDf((c) => ({ ...c, parcelasMaximas: v }))} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                  <F label="Índice pré-entrega"><select style={INPUT} value={df.indicePreEntrega} disabled={dis} onChange={(e) => setDf((c) => ({ ...c, indicePreEntrega: e.target.value }))}><option>INCC</option><option>IGP-M</option><option>IPCA</option><option>Fixo</option><option>Sem correção</option></select></F>
                  <F label="Índice pós-entrega"><select style={INPUT} value={df.indicePosEntrega} disabled={dis} onChange={(e) => setDf((c) => ({ ...c, indicePosEntrega: e.target.value }))}><option>IPCA</option><option>INCC</option><option>IGP-M</option><option>Fixo</option><option>Sem correção</option></select></F>
                </div>
                <F label="Data prevista de entrega" sub="Quando atingida, o sistema muda para o índice pós-entrega"><input style={INPUT} type="date" value={df.dataEntregaEmpreendimento} disabled={dis} onChange={(e) => setDf((c) => ({ ...c, dataEntregaEmpreendimento: e.target.value }))} /></F>
                <NumField label="Carência máxima" suffix=" meses" sub="Meses sem pagamento que o corretor pode oferecer" value={df.carenciaMaximaMeses} min={0} max={24} disabled={dis} onChange={(v) => setDf((c) => ({ ...c, carenciaMaximaMeses: v }))} />
                <SaveBtn onClick={() => void saveDev()} saving={saving} />
              </Card>

              <Card>
                <Sec title="Pagamento flexível" sub="Modalidades adicionais que podem ser oferecidas nas simulações" />
                <Tog ativo={df.aceitaBalao} disabled={dis} onChange={(v) => setDf((c) => ({ ...c, aceitaBalao: v }))} label="Aceita balões" sub="Pagamentos extras em datas específicas" />
                {df.aceitaBalao ? <NumField label="Quantidade máxima de balões" value={df.balaoMaxQuantidade} min={1} max={24} disabled={dis} onChange={(v) => setDf((c) => ({ ...c, balaoMaxQuantidade: v }))} /> : null}
                <Tog ativo={df.aceitaPermuta} disabled={dis} onChange={(v) => setDf((c) => ({ ...c, aceitaPermuta: v }))} label="Aceita permuta" sub="Cliente pode dar bens como parte do pagamento" />
                {df.aceitaPermuta ? <NumField label="Valor máximo da permuta" suffix="% do valor" value={df.permutaValorMaximoPct} min={0} max={100} disabled={dis} onChange={(v) => setDf((c) => ({ ...c, permutaValorMaximoPct: v }))} /> : null}
                <Tog ativo={df.aceitaSaldoEntrega} disabled={dis} onChange={(v) => setDf((c) => ({ ...c, aceitaSaldoEntrega: v }))} label="Aceita saldo na entrega" sub="Cliente pode reservar um percentual para pagar nas chaves" />
                {df.aceitaSaldoEntrega ? (
                  <>
                    <NumField label="Percentual máximo do saldo na entrega" suffix="%" value={df.saldoEntregaMaxPct} min={0} max={100} disabled={dis} onChange={(v) => setDf((c) => ({ ...c, saldoEntregaMaxPct: v }))} />
                    <F label="Como chamar este saldo nos documentos" sub="Este texto aparece no simulador e no PDF"><input style={INPUT} value={df.textoSaldoEntrega} disabled={dis} onChange={(e) => setDf((c) => ({ ...c, textoSaldoEntrega: e.target.value }))} placeholder="Ex: Saldo nas chaves, Parcela final" /></F>
                  </>
                ) : null}
                <Tog ativo={df.aceitaDesconto} disabled={dis} onChange={(v) => setDf((c) => ({ ...c, aceitaDesconto: v }))} label="Aceita desconto" sub="Corretores podem oferecer desconto no valor da unidade" />
                {df.aceitaDesconto ? <NumField label="Desconto máximo permitido" suffix="%" sub="Acima deste limite, requer aprovação do gestor" value={df.descontoMaximoPct} min={0} max={50} disabled={dis} onChange={(v) => setDf((c) => ({ ...c, descontoMaximoPct: v }))} /> : null}
                <SaveBtn onClick={() => void saveDev()} saving={saving} />
              </Card>

              <Card>
                <Sec title="Comercial" />
                <NumField label="Comissão padrão do corretor" suffix="%" sub="Percentual sobre o valor negociado. Visível apenas para o corretor." value={df.comissaoCorretorPct} min={0} max={20} disabled={dis} onChange={(v) => setDf((c) => ({ ...c, comissaoCorretorPct: v }))} />
                <SaveBtn onClick={() => void saveDev()} saving={saving} />
              </Card>
            </div>
          ) : null}

          {/* ═══ DOCUMENTOS ═══ */}
          {aba === "documentos" ? (
            <div>
              <PageTitle title="Personalização dos Documentos" sub="Configure como as simulações e propostas são apresentadas ao cliente" />

              <Card>
                <Sec title="Aparência do PDF" />
                <Tog ativo={df.usarLogoEmpreendimentoNoPdf} disabled={dis} onChange={(v) => setDf((c) => ({ ...c, usarLogoEmpreendimentoNoPdf: v }))} label="Usar logo do empreendimento no PDF" sub="Quando ativo, exibe o logo do empreendimento junto ao da empresa" />
                <Tog ativo={df.incluirFotoCapaNoPdf} disabled={dis} onChange={(v) => setDf((c) => ({ ...c, incluirFotoCapaNoPdf: v }))} label="Incluir foto de capa no PDF" sub="Adiciona a foto do empreendimento no início do documento" />
                <Tog ativo={df.usarCorEmpreendimentoNoPdf} disabled={dis} onChange={(v) => setDf((c) => ({ ...c, usarCorEmpreendimentoNoPdf: v }))} label="Usar cor do empreendimento" sub="Usa a cor específica do loteamento em vez da cor da marca" />
                <SaveBtn onClick={() => void saveDev()} saving={saving} />
              </Card>

              <Card>
                <Sec title="Mensagem e copy" />
                <F label="Frase de impacto" sub="Aparece no rodapé de todas as simulações geradas">
                  <textarea value={af.fraseImpactoPdf} disabled={dis} onChange={(e) => setAf((c) => ({ ...c, fraseImpactoPdf: e.target.value }))}
                    rows={3} style={{ ...INPUT, resize: "vertical" }} />
                </F>
                <SaveBtn onClick={() => void saveAccount()} saving={saving} />
              </Card>

              <Card>
                <Sec title="Textos da Simulação (PDF)" sub="Textos configuráveis por empreendimento. Se vazio, usa o padrão." />
                <F label="Título do documento" sub="Aparece como eyebrow no topo do PDF">
                  <input style={INPUT} value={df.pdfTitulo} disabled={dis} onChange={(e) => setDf((c) => ({ ...c, pdfTitulo: e.target.value }))} placeholder="SIMULAÇÃO COMERCIAL" />
                </F>
                <F label="Texto legal 1" sub="Primeira linha dos avisos na parte inferior">
                  <input style={INPUT} value={df.pdfBullet1} disabled={dis} onChange={(e) => setDf((c) => ({ ...c, pdfBullet1: e.target.value }))} placeholder="Simulação meramente ilustrativa, sem caráter de proposta comercial" />
                </F>
                <F label="Texto legal 2">
                  <input style={INPUT} value={df.pdfBullet2} disabled={dis} onChange={(e) => setDf((c) => ({ ...c, pdfBullet2: e.target.value }))} placeholder="Valores e condições sujeitos à análise e aprovação da incorporadora" />
                </F>
                <F label="Texto legal 3">
                  <input style={INPUT} value={df.pdfBullet3} disabled={dis} onChange={(e) => setDf((c) => ({ ...c, pdfBullet3: e.target.value }))} placeholder="Condições válidas mediante formalização contratual" />
                </F>
                <F label="Disclaimer" sub="Texto legal exibido antes do resumo financeiro">
                  <textarea value={df.pdfDisclaimer} disabled={dis} onChange={(e) => setDf((c) => ({ ...c, pdfDisclaimer: e.target.value }))}
                    rows={2} style={{ ...INPUT, resize: "vertical" }} placeholder="Esta simulação é meramente ilustrativa e não constitui proposta formal. Condições sujeitas à análise e aprovação da incorporadora." />
                </F>
                <F label="Frase de impacto" sub="Aparece em itálico no rodapé do PDF">
                  <input style={INPUT} value={df.pdfFraseRodape} disabled={dis} onChange={(e) => setDf((c) => ({ ...c, pdfFraseRodape: e.target.value }))} placeholder="Patrimônio não se constrói esperando o momento certo. O momento certo é quando você age." />
                </F>
                <F label="Texto abaixo do parcelamento" sub="Aparece no detalhamento das parcelas do PDF">
                  <input style={INPUT} value={df.pdfTextoParcelamento} disabled={dis} onChange={(e) => setDf((c) => ({ ...c, pdfTextoParcelamento: e.target.value }))} placeholder="Com correção monetária · sem juros bancários" />
                </F>
                <NumField label="Validade da simulação" suffix="horas" sub="Exibido nos avisos do PDF" value={df.pdfValidadeHoras} min={1} max={720} disabled={dis} onChange={(v) => setDf((c) => ({ ...c, pdfValidadeHoras: v }))} />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 24 }}>
                  <button type="button" disabled={dis} onClick={() => setDf((c) => ({ ...c, pdfTitulo: "", pdfBullet1: "", pdfBullet2: "", pdfBullet3: "", pdfDisclaimer: "", pdfFraseRodape: "", pdfValidadeHoras: 48, pdfTextoParcelamento: "" }))} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid var(--color-stone)", background: "transparent", color: "var(--color-fog)", fontSize: 13, cursor: "pointer" }}>Restaurar padrão</button>
                  <button type="button" onClick={() => void saveDev()} disabled={saving} style={{ background: saving ? "var(--color-stone)" : "var(--color-sprout)", color: saving ? "var(--color-fog)" : "var(--color-ink)", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>{saving ? "Salvando..." : "Salvar"}</button>
                </div>
              </Card>

              <Card>
                <Sec title="Prévia do documento" sub="Simulação visual com configurações atuais" />
                <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden", border: "1px solid var(--color-stone)", maxWidth: 360, margin: "0 auto" }}>
                  <div style={{ background: af.corPrimaria, padding: "16px 20px" }}>
                    {af.logoUrl ? <img src={af.logoUrl} alt="" style={{ height: 32, objectFit: "contain" }} /> : <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{af.nomeComercial || actx.account?.accountName || "Sua Empresa"}</div>}
                    <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, marginTop: 4 }}>{dctx.development?.developmentName}</div>
                  </div>
                  <div style={{ padding: "16px 20px" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, textAlign: "center", color: "#111", marginBottom: 12 }}>SIMULAÇÃO COMERCIAL</div>
                    <div style={{ background: "#f0fdf4", border: `1px solid ${af.corSecundaria}`, borderRadius: 6, padding: 12, textAlign: "center", marginBottom: 12 }}>
                      <div style={{ fontSize: 10, color: "#6b7280" }}>SUA CONDIÇÃO</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: af.corPrimaria }}>36x de R$ 17.541</div>
                    </div>
                    <div style={{ fontSize: 9, color: "#6b7280", fontStyle: "italic", textAlign: "center", borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>{(af.fraseImpactoPdf || "").substring(0, 70)}...</div>
                  </div>
                </div>
              </Card>
            </div>
          ) : null}

          {/* ═══ OPERACAO ═══ */}
          {aba === "operacao" ? (
            <div>
              <PageTitle title="Configurações Operacionais" sub="Regras de fluxo comercial e automações do sistema" />

              <Card>
                <Sec title="Reservas" />
                <NumField label="Prazo de reserva" suffix="h" sub="Após este prazo, a reserva expira. Se vazio, herda da conta." value={df.reservationDurationHours === "" ? 0 : Number(df.reservationDurationHours)} min={0} max={720} disabled={dis} onChange={(v) => setDf((c) => ({ ...c, reservationDurationHours: v === 0 ? "" : v.toString() }))} />
                <Tog ativo={df.requireAccepted === "true"} disabled={dis} onChange={(v) => setDf((c) => ({ ...c, requireAccepted: v ? "true" : "false" }))} label="Proposta aceita obrigatória" sub="O corretor precisa ter uma proposta aceita antes de solicitar reserva" />
                <Tog ativo={df.requireComplete === "true"} disabled={dis} onChange={(v) => setDf((c) => ({ ...c, requireComplete: v ? "true" : "false" }))} label="Dados completos obrigatórios" sub="Todos os dados do cliente precisam estar preenchidos" />
                <SaveBtn onClick={() => void saveDev()} saving={saving} />
              </Card>

              <Card>
                <Sec title="Fila de espera" />
                <Tog ativo={df.queueEnabled === "true"} disabled={dis} onChange={(v) => setDf((c) => ({ ...c, queueEnabled: v ? "true" : "false" }))} label="Fila habilitada" sub="Quando ativo, clientes podem entrar na fila de uma unidade reservada" />
                <SaveBtn onClick={() => void saveDev()} saving={saving} />
              </Card>

              <div style={{ padding: 20, background: "var(--color-ink)", border: "1px dashed var(--color-stone)", borderRadius: 10, marginTop: 16, textAlign: "center" }}>
                <div style={{ fontSize: 13, color: "var(--color-fog)" }}>Em breve: configurações de aprovação de proposta, limites por corretor, alertas automáticos e integrações.</div>
              </div>
            </div>
          ) : null}

          {/* Materiais (Google Drive) */}
          {aba === "materiais" ? (
            <div className="nexa-card">
              <div className="nexa-label" style={{ marginBottom: 20 }}>Google Drive — Materiais do empreendimento</div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: "var(--color-fog)", marginBottom: 8, lineHeight: 1.6 }}>
                  1. Crie uma pasta no Google Drive com os materiais do empreendimento.<br />
                  2. Compartilhe a pasta como <strong style={{ color: "var(--color-bone)" }}>Leitor</strong> com o email abaixo:<br />
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
                  <input readOnly value={SA_EMAIL} style={{ ...INPUT, flex: 1, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-fog)" }} onFocus={(e) => e.target.select()} />
                  <button type="button" onClick={() => { navigator.clipboard.writeText(SA_EMAIL); setMsg("Email copiado!"); setTimeout(() => setMsg(null), 2000); }} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--color-stone)", background: "transparent", color: "var(--color-bone)", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>Copiar</button>
                </div>
                <div style={{ fontSize: 12, color: "var(--color-fog)", marginBottom: 8 }}>3. Cole o link da pasta abaixo:</div>
                <input type="text" value={driveLink} onChange={(e) => { setDriveLink(e.target.value); setDriveSaved(false); setDriveTestResult(null); }} placeholder="https://drive.google.com/drive/folders/..." style={INPUT} disabled={dis} />
              </div>

              {driveTestResult ? (
                <div style={{ background: driveTestResult.ok ? "var(--color-sprout-muted)" : "rgba(248,113,113,0.08)", border: `1px solid ${driveTestResult.ok ? "var(--color-sprout)" : "rgba(248,113,113,0.3)"}`, borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: driveTestResult.ok ? "var(--color-sprout)" : "#F87171" }}>
                  {driveTestResult.msg}
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => void handleDriveTest()} disabled={!extractFolderId(driveLink) || driveTesting || dis} style={{ padding: "0 16px", height: 36, borderRadius: 8, border: "1px solid var(--color-stone)", background: "transparent", color: "var(--color-bone)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  {driveTesting ? "Testando..." : "Testar conexão"}
                </button>
                <button type="button" onClick={() => void handleDriveSave()} disabled={!extractFolderId(driveLink) || driveSaving || dis} style={{ padding: "0 16px", height: 36, borderRadius: 8, border: "none", background: "var(--color-sprout)", color: "var(--color-ink)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  {driveSaving ? "Salvando..." : driveSaved ? "Salvo ✓" : "Salvar"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {ss.errorMessage ? <p style={{ color: "var(--color-red)", marginTop: 12, fontSize: 12 }}>{ss.errorMessage}</p> : null}
    </div>
  );
}

// ── Components ──

function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-bone)", margin: 0 }}>{title}</h2>
      {sub ? <p style={{ fontSize: 13, color: "var(--color-fog)", marginTop: 4 }}>{sub}</p> : null}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="nexa-card" style={{ marginBottom: 16 }}>{children}</div>;
}

function Sec({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-sprout)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>{title}</div>
      {sub ? <div style={{ fontSize: 12, color: "var(--color-fog)" }}>{sub}</div> : null}
      <div style={{ height: 1, background: "var(--color-stone)", marginTop: 12 }} />
    </div>
  );
}

function F({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-dust)", display: "block", marginBottom: sub ? 2 : 8 }}>{label}</label>
      {sub ? <div style={{ fontSize: 11, color: "var(--color-fog)", marginBottom: 8 }}>{sub}</div> : null}
      {children}
    </div>
  );
}

function NumField({ label, sub, value, onChange, min, max, suffix, disabled }: { label: string; sub?: string; value: number; onChange: (v: number) => void; min?: number; max?: number; suffix?: string; disabled?: boolean }) {
  const S: React.CSSProperties = { width: "100%", boxSizing: "border-box", background: "var(--color-ink)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: suffix ? "10px 40px 10px 14px" : "10px 14px", color: "var(--color-bone)", fontSize: 14 };
  return (
    <F label={label} sub={sub}>
      <div style={{ position: "relative" }}>
        <input type="number" value={value} min={min} max={max} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} onFocus={(e) => e.target.select()} style={S} />
        {suffix ? <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--color-fog)", fontFamily: "var(--font-mono)" }}>{suffix}</span> : null}
      </div>
    </F>
  );
}

function ColorField({ label, value, disabled, onChange }: { label: string; value: string; disabled?: boolean; onChange: (v: string) => void }) {
  return (
    <F label={label}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="color" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={{ width: 36, height: 36, padding: 0, border: "1px solid var(--color-stone)", borderRadius: 6, cursor: "pointer" }} />
        <input type="text" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={{ flex: 1, background: "var(--color-ink)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "8px 12px", color: "var(--color-bone)", fontFamily: "var(--font-mono)", fontSize: 12 }} />
      </div>
    </F>
  );
}

function Tog({ ativo, onChange, label, sub, disabled }: { ativo: boolean; onChange: (v: boolean) => void; label: string; sub?: string; disabled?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16, padding: "12px 16px", background: "var(--color-ink)", border: "1px solid var(--color-stone)", borderRadius: 8, opacity: disabled ? 0.5 : 1 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-bone)" }}>{label}</div>
        {sub ? <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 2 }}>{sub}</div> : null}
      </div>
      <button type="button" onClick={() => !disabled && onChange(!ativo)} disabled={disabled} style={{ width: 44, height: 24, borderRadius: 12, border: "none", background: ativo ? "var(--color-sprout)" : "var(--color-stone)", position: "relative", flexShrink: 0, cursor: disabled ? "not-allowed" : "pointer", transition: "background 0.2s" }}>
        <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: ativo ? 23 : 3, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
      </button>
    </div>
  );
}

function SaveBtn({ onClick, saving, label = "Salvar" }: { onClick: () => void; saving: boolean; label?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
      <button type="button" onClick={onClick} disabled={saving} style={{ background: saving ? "var(--color-stone)" : "var(--color-sprout)", color: saving ? "var(--color-fog)" : "var(--color-ink)", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
        {saving ? "Salvando..." : label}
      </button>
    </div>
  );
}
