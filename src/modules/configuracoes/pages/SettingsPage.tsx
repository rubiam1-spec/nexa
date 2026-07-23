import { useEffect, useState } from "react";
import { canPerformAction, PermissionAction } from "../../../app/authorization/permissions";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useAuth } from "../../../app/contexts/AuthContext";
import { usePermissions } from "../../../shared/hooks/usePermissions";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { getUserRoleLabel } from "../../../shared/types/role";
import { formatDateBRT } from "../../../shared/utils/dateUtils";
import { useCommercialSettings } from "../hooks/useCommercialSettings";
import { useLeadDistributionAdmin } from "../hooks/useLeadDistributionAdmin";
import { useDocumentRequirements } from "../../empreendimentos/hooks/useDocumentRequirements";
import type { PartyRole, RequirementCellState } from "../../../shared/types/documentRequirement";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import { supabase } from "../../../infra/supabase/supabaseClient";
import UploadImagem from "../../../shared/components/UploadImagem";
import EditorMapaPins from "../components/EditorMapaPins";
import PermissionsPanel from "../components/PermissionsPanel";
import DocumentThemeSection from "../components/DocumentThemeSection";
import { useUnits } from "../../units/hooks/useUnits";
import { NexaSelect } from "../../../shared/ui/NexaSelect";
import { NexaModal } from "../../../shared/ui/NexaModal";
import { useLeadOrigins } from "../hooks/useLeadOrigins";
import { useLeadCampaigns } from "../hooks/useLeadCampaigns";
import type { LeadCampaign, LeadCampaignInput } from "../../../infra/repositories/leadCampaignsSupabaseRepository";
import { useLeadChannels } from "../hooks/useLeadChannels";
import { RECEIVE_LEAD_URL, PROVIDER_ADAPTERS, DISTRIBUTION_MODES, providerLabel, providerInstructions, type LeadChannel, type LeadChannelInput } from "../../../infra/repositories/webhookChannelsSupabaseRepository";

type Aba = "marca" | "empreendimento" | "documentos" | "operacao" | "materiais" | "leads" | "cadencia" | "checklist" | "notificacoes" | "permissoes";

const INPUT: React.CSSProperties = { width: "100%", boxSizing: "border-box", background: "var(--color-ink)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "10px 14px", color: "var(--color-bone)", fontSize: 14 };

export default function SettingsPage() {
  const actx = useAccount();
  const { authenticatedProfile } = useAuth();
  const dctx = useDevelopment();
  const screen = useScreen();
  const isMobile = !screen.isDesktop;
  const { can } = usePermissions();
  const ss = useCommercialSettings(actx.account?.accountId ?? null, dctx.development?.developmentId ?? null, actx.isUsingMock || dctx.isUsingMock, actx.account?.role ?? null);
  const { units: allUnits } = useUnits(actx.account?.accountId ?? null, dctx.development?.developmentId ?? null, actx.isUsingMock || dctx.isUsingMock);
  const canUpd = canPerformAction(actx.account?.role ?? null, PermissionAction.UPDATE_SETTINGS);
  const saving = ss.isSaving;
  const dis = !canUpd || saving;

  const [aba, setAba] = useState<Aba>("marca");
  const [msg, setMsg] = useState<string | null>(null);

  // Cadence settings
  const CADENCE_DEFAULTS = { negotiation_idle_hours: 48, proposal_response_hours: 24, counter_proposal_decision_hours: 48, simulation_followup_hours: 72, client_cooling_hours: 168, broker_inactivity_hours: 72, escalation_yellow_pct: 75, escalation_red_pct: 100, escalation_abandoned_pct: 150 };
  const [cadence, setCadence] = useState(CADENCE_DEFAULTS);
  const [cadenceLoaded, setCadenceLoaded] = useState(false);
  const [cadenceSaving, setCadenceSaving] = useState(false);
  useEffect(() => {
    if (!supabase || !actx.account?.accountId || !dctx.development?.developmentId || cadenceLoaded) return;
    supabase.from("cadence_settings").select("*").eq("account_id", actx.account.accountId).eq("development_id", dctx.development.developmentId).maybeSingle().then(({ data }) => {
      if (data) setCadence({ ...CADENCE_DEFAULTS, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v != null && typeof v === "number")) });
      setCadenceLoaded(true);
    });
  }, [actx.account?.accountId, dctx.development?.developmentId, cadenceLoaded]);

  // Checklist document type configs
  async function saveCadence() {
    if (!supabase || !actx.account?.accountId || !dctx.development?.developmentId) return;
    setCadenceSaving(true);
    const { error } = await supabase.from("cadence_settings").upsert({ account_id: actx.account.accountId, development_id: dctx.development.developmentId, ...cadence, updated_at: new Date().toISOString() }, { onConflict: "account_id,development_id" });
    setCadenceSaving(false);
    setMsg(error ? `Erro: ${error.message}` : "Cadência salva ✓");
    setTimeout(() => setMsg(null), 3000);
  }

  // Preferências de notificação (por usuário — não por conta). Defaults ON.
  // Convite e recuperação de senha IGNORAM estas preferências (transacionais).
  const notifProfileId = authenticatedProfile?.id ?? null;
  const [notif, setNotif] = useState({ immediate_emails: true, daily_digest: true });
  const [notifLoaded, setNotifLoaded] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);
  useEffect(() => {
    if (!supabase || !notifProfileId || notifLoaded) return;
    supabase.from("notification_preferences").select("immediate_emails, daily_digest").eq("profile_id", notifProfileId).maybeSingle().then(({ data }) => {
      if (data) setNotif({ immediate_emails: data.immediate_emails !== false, daily_digest: data.daily_digest !== false });
      setNotifLoaded(true);
    });
  }, [notifProfileId, notifLoaded]);
  async function saveNotif(next: { immediate_emails: boolean; daily_digest: boolean }) {
    if (!supabase || !notifProfileId) return;
    setNotif(next); // otimista
    setNotifSaving(true);
    const { error } = await supabase.from("notification_preferences").upsert({ profile_id: notifProfileId, ...next, updated_at: new Date().toISOString() }, { onConflict: "profile_id" });
    setNotifSaving(false);
    setMsg(error ? `Erro: ${error.message}` : "Preferências salvas ✓");
    setTimeout(() => setMsg(null), 3000);
  }

  // Account form
  const [af, setAf] = useState({ reservationDurationHours: 48, requireAccepted: true, requireComplete: false, queueEnabled: false, logoUrl: "", logoLightUrl: "", logoDarkUrl: "", corPrimaria: "#14532d", corSecundaria: "#16a34a", nomeComercial: "", site: "", telefone: "", slogan: "", fraseImpactoPdf: "Patrimonio nao se constroi esperando o momento certo. O momento certo e quando voce age.", tituloProposta: "", bulletPdf1: "", bulletPdf2: "", bulletPdf3: "" });

  // Development form
  const [df, setDf] = useState({
    reservationDurationHours: "", requireAccepted: "", requireComplete: "", queueEnabled: "",
    logoEmpreendimentoUrl: "", logoLightUrl: "", logoDarkUrl: "", imagemCapaUrl: "", corEmpreendimento: "",
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
    setAf({ reservationDurationHours: a.reservationDurationHours, requireAccepted: a.requireAcceptedProposalForReservationRequest, requireComplete: a.requireCompleteClientDataForReservationRequest, queueEnabled: a.queueEnabled, logoUrl: a.logoUrl ?? "", logoLightUrl: a.logoLightUrl ?? "", logoDarkUrl: a.logoDarkUrl ?? "", corPrimaria: a.corPrimaria, corSecundaria: a.corSecundaria, nomeComercial: a.nomeComercial ?? "", site: a.site ?? "", telefone: a.telefone ?? "", slogan: a.slogan ?? "", fraseImpactoPdf: a.fraseImpactoPdf, tituloProposta: a.tituloProposta ?? "", bulletPdf1: a.bulletPdf1 ?? "", bulletPdf2: a.bulletPdf2 ?? "", bulletPdf3: a.bulletPdf3 ?? "" });
  }, [ss.accountSettings]);

  useEffect(() => {
    if (!ss.developmentSettings) return;
    const d = ss.developmentSettings;
    setDf({
      reservationDurationHours: d.reservationDurationHours?.toString() ?? "",
      requireAccepted: d.requireAcceptedProposalForReservationRequest === null ? "" : d.requireAcceptedProposalForReservationRequest ? "true" : "false",
      requireComplete: d.requireCompleteClientDataForReservationRequest === null ? "" : d.requireCompleteClientDataForReservationRequest ? "true" : "false",
      queueEnabled: d.queueEnabled === null ? "" : d.queueEnabled ? "true" : "false",
      logoEmpreendimentoUrl: d.logoEmpreendimentoUrl ?? "", logoLightUrl: d.logoLightUrl ?? "", logoDarkUrl: d.logoDarkUrl ?? "", imagemCapaUrl: d.imagemCapaUrl ?? "", corEmpreendimento: d.corEmpreendimento ?? "",
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

  // Guard via flag: permite que overrides (categoria/individual) abram Configurações
  // para gestores/etc que normalmente nao teriam acesso.
  if (actx.account?.role && !can("can_manage_settings")) {
    return <p style={{ color: "var(--color-fog)" }}>Acesso restrito. Você não tem permissão para acessar configurações.</p>;
  }

  if (ss.isLoading) return <p style={{ color: "var(--color-fog)" }}>Carregando configurações...</p>;
  if (actx.status === "no_access" || actx.status === "error") return <p style={{ color: "var(--color-fog)" }}>{actx.errorMessage}</p>;
  if (dctx.status === "empty" || dctx.status === "error") return <p style={{ color: "var(--color-fog)" }}>{dctx.errorMessage}</p>;

  function flash() { setMsg("Salvo com sucesso"); setTimeout(() => setMsg(null), 3000); }

  async function saveAccount() {
    await ss.updateAccountSettings({ reservationDurationHours: af.reservationDurationHours, requireAcceptedProposalForReservationRequest: af.requireAccepted, requireCompleteClientDataForReservationRequest: af.requireComplete, queueEnabled: af.queueEnabled, logoUrl: af.logoUrl || null, logoLightUrl: af.logoLightUrl || null, logoDarkUrl: af.logoDarkUrl || null, corPrimaria: af.corPrimaria, corSecundaria: af.corSecundaria, nomeComercial: af.nomeComercial || null, site: af.site || null, telefone: af.telefone || null, slogan: af.slogan || null, fraseImpactoPdf: af.fraseImpactoPdf, tituloProposta: af.tituloProposta || null, bulletPdf1: af.bulletPdf1 || null, bulletPdf2: af.bulletPdf2 || null, bulletPdf3: af.bulletPdf3 || null });
    flash();
  }

  async function saveDev() {
    await ss.updateDevelopmentSettings({
      reservationDurationHours: df.reservationDurationHours === "" ? null : Number(df.reservationDurationHours),
      requireAcceptedProposalForReservationRequest: df.requireAccepted === "" ? null : df.requireAccepted === "true",
      requireCompleteClientDataForReservationRequest: df.requireComplete === "" ? null : df.requireComplete === "true",
      queueEnabled: df.queueEnabled === "" ? null : df.queueEnabled === "true",
      logoEmpreendimentoUrl: df.logoEmpreendimentoUrl || null, logoLightUrl: df.logoLightUrl || null, logoDarkUrl: df.logoDarkUrl || null, imagemCapaUrl: df.imagemCapaUrl || null, corEmpreendimento: df.corEmpreendimento || null,
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

  // Aba "Permissões": sempre restrita a owner/director E com can_manage_settings
  // (um gestor com override de settings NAO deve gerenciar permissoes dos outros).
  const rawRole = (actx.account?.role ?? "") as string;
  const isAdminRole = (rawRole === "owner" || rawRole === "director") && can("can_manage_settings");

  const tabs: { key: Aba; label: string; icon: string }[] = [
    { key: "marca", label: "Marca", icon: "M" },
    { key: "empreendimento", label: "Empreendimento", icon: "E" },
    { key: "documentos", label: "Documentos", icon: "D" },
    { key: "operacao", label: "Operação", icon: "O" },
    { key: "materiais", label: "Materiais", icon: "G" },
    { key: "leads", label: "Leads", icon: "L" },
    { key: "cadencia", label: "Cadência", icon: "⏱" },
    { key: "checklist", label: "Checklist Docs", icon: "📋" },
    { key: "notificacoes", label: "Notificações", icon: "🔔" },
    ...(isAdminRole ? [{ key: "permissoes" as Aba, label: "Permissões", icon: "P" }] : []),
  ];

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--color-bone)", marginBottom: 4 }}>Configurações</h1>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-fog)", marginBottom: 24 }}>{actx.account?.accountName} · {dctx.development?.developmentName} · {getUserRoleLabel(actx.account?.role)}</div>
      {msg ? <div style={{ background: "var(--color-sprout-muted)", border: "1px solid var(--color-sprout)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "var(--color-sprout)" }}>{msg}</div> : null}
      {!canUpd ? <div style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.3)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: "var(--color-terracotta)" }}>Sem permissão para alterar.</div> : null}

      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 16 : 24 }}>
        <nav
          className="nexa-settings-tabs"
          style={
            isMobile
              ? {
                  width: "100%",
                  display: "flex",
                  flexDirection: "row",
                  flexWrap: "nowrap",
                  gap: 8,
                  overflowX: "auto",
                  overflowY: "hidden",
                  WebkitOverflowScrolling: "touch",
                  paddingBottom: 4,
                }
              : { width: 210, flexShrink: 0, display: "flex", flexDirection: "column", gap: 2 }
          }
        >
          {tabs.map((t) => {
            const active = aba === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setAba(t.key)}
                style={
                  isMobile
                    ? {
                        flexShrink: 0,
                        minHeight: 44,
                        padding: "10px 14px",
                        borderRadius: 999,
                        background: active ? "rgba(74,222,128,0.1)" : "transparent",
                        color: active ? "var(--color-sprout)" : "var(--color-fog)",
                        border: `1px solid ${active ? "var(--color-sprout)" : "var(--color-stone)"}`,
                        fontSize: 13,
                        fontWeight: active ? 600 : 500,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        whiteSpace: "nowrap",
                        transition: "all 0.15s",
                      }
                    : {
                        textAlign: "left",
                        padding: "12px 16px",
                        borderRadius: "0 8px 8px 0",
                        background: active ? "rgba(74,222,128,0.08)" : "transparent",
                        color: active ? "var(--color-sprout)" : "var(--color-fog)",
                        border: "none",
                        borderLeft: `3px solid ${active ? "var(--color-sprout)" : "transparent"}`,
                        fontSize: 13,
                        fontWeight: active ? 600 : 400,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        transition: "all 0.15s",
                      }
                }
              >
                <span
                  style={{
                    width: isMobile ? 20 : 24,
                    height: isMobile ? 20 : 24,
                    borderRadius: isMobile ? 999 : 6,
                    background: active ? "rgba(74,222,128,0.15)" : "var(--color-stone)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: isMobile ? 10 : 11,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                    color: active ? "var(--color-sprout)" : "var(--color-fog)",
                    flexShrink: 0,
                  }}
                >
                  {t.icon}
                </span>
                {t.label}
              </button>
            );
          })}
        </nav>

        <div style={{ flex: 1, minWidth: 0 }}>

          {/* ═══ MARCA ═══ */}
          {aba === "marca" ? (
            <div>
              <PageTitle title="Identidade da Marca" sub="Configurações que representam sua empresa em todo o sistema." />

              <Card>
                <Sec title="Identidade visual" sub="Aparece no cabeçalho dos documentos gerados" />
                <UploadImagem label="Logo da empresa (padrão)" value={af.logoUrl || null} disabled={dis} preview="banner" onChange={(u) => setAf((c) => ({ ...c, logoUrl: u }))} />
                <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                  <UploadImagem label="Logo versão clara (para banners e fundos escuros)" value={af.logoLightUrl || null} disabled={dis} preview="banner" onChange={(u) => setAf((c) => ({ ...c, logoLightUrl: u }))} />
                  <UploadImagem label="Logo versão escura (para documentos e fundos claros)" value={af.logoDarkUrl || null} disabled={dis} preview="banner" onChange={(u) => setAf((c) => ({ ...c, logoDarkUrl: u }))} />
                </div>
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
                <UploadImagem label="Logo do empreendimento (padrão)" value={df.logoEmpreendimentoUrl || null} disabled={dis} preview="banner" onChange={(u) => setDf((c) => ({ ...c, logoEmpreendimentoUrl: u }))} />
                <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                  <UploadImagem label="Logo versão clara (para banners e fundos escuros)" value={df.logoLightUrl || null} disabled={dis} preview="banner" onChange={(u) => setDf((c) => ({ ...c, logoLightUrl: u }))} />
                  <UploadImagem label="Logo versão escura (para documentos e fundos claros)" value={df.logoDarkUrl || null} disabled={dis} preview="banner" onChange={(u) => setDf((c) => ({ ...c, logoDarkUrl: u }))} />
                </div>
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
                  <F label="Índice pré-entrega"><NexaSelect value={df.indicePreEntrega} disabled={dis} onChange={(v) => setDf((c) => ({ ...c, indicePreEntrega: v }))} ariaLabel="Índice pré-entrega" options={[{ value: "INCC", label: "INCC" }, { value: "IGP-M", label: "IGP-M" }, { value: "IPCA", label: "IPCA" }, { value: "Fixo", label: "Fixo" }, { value: "Sem correção", label: "Sem correção" }]} /></F>
                  <F label="Índice pós-entrega"><NexaSelect value={df.indicePosEntrega} disabled={dis} onChange={(v) => setDf((c) => ({ ...c, indicePosEntrega: v }))} ariaLabel="Índice pós-entrega" options={[{ value: "IPCA", label: "IPCA" }, { value: "INCC", label: "INCC" }, { value: "IGP-M", label: "IGP-M" }, { value: "Fixo", label: "Fixo" }, { value: "Sem correção", label: "Sem correção" }]} /></F>
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

              {/* Documentos Temáveis v3 — a pele do documento (a mesma porta p/ qualquer conta). */}
              <div style={{ marginBottom: 28 }}>
                <Sec title="Tema do documento" />
                <DocumentThemeSection accountId={actx.account?.accountId ?? null} userId={authenticatedProfile?.id ?? null} role={actx.account?.role ?? null} />
              </div>

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

          {aba === "leads" ? <>
            <WebhooksPanel accountId={actx.account?.accountId ?? null} isMobile={isMobile} setMsg={setMsg} developments={dctx.availableDevelopments.map((d) => ({ id: d.developmentId, name: d.developmentName }))} />
            <div style={{ marginTop: 20 }} />
            <LeadDistributionPanel accountId={actx.account?.accountId ?? null} developmentId={dctx.development?.developmentId ?? null} canEdit={canUpd} />
            <div style={{ marginTop: 20 }} />
            <LeadOriginsPanel canEdit={canUpd} />
            <div style={{ marginTop: 20 }} />
            <LeadCampaignsPanel canEdit={canUpd} isMobile={isMobile} setMsg={setMsg} developments={dctx.availableDevelopments.map((d) => ({ id: d.developmentId, name: d.developmentName }))} />
          </> : null}

          {aba === "cadencia" ? (
            <div className="nexa-card">
              <div className="nexa-label" style={{ marginBottom: 20 }}>Cadência Comercial</div>
              <div style={{ fontSize: 12, color: "var(--color-fog)", marginBottom: 20 }}>Configure os tempos limites para cada etapa do fluxo comercial. Alertas são gerados automaticamente quando os limites são atingidos.</div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-dust)", marginBottom: 12 }}>Tempos de ação</div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                  {([["negotiation_idle_hours", "Negociação parada", "Alerta quando negociação fica sem ação"], ["proposal_response_hours", "Proposta sem resposta", "Alerta quando proposta aguarda decisão"], ["counter_proposal_decision_hours", "Contraproposta pendente", "Alerta quando contraproposta não foi decidida"], ["simulation_followup_hours", "Follow-up de simulação", "Alerta para retomar contato após simulação"]] as const).map(([key, label, helper]) => (
                    <div key={key}>
                      <label style={{ fontSize: 11, color: "var(--color-fog)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>{label}</label>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input type="number" min={1} value={cadence[key]} onChange={(e) => setCadence((p) => ({ ...p, [key]: Number(e.target.value) || 0 }))} disabled={dis} style={{ ...INPUT, width: 80 }} />
                        <span style={{ fontSize: 12, color: "var(--color-fog)" }}>horas</span>
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-disabled)", marginTop: 2 }}>{helper}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-dust)", marginBottom: 12 }}>Monitoramento</div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                  {([["client_cooling_hours", "Cliente esfriando", "Alerta quando cliente não interage"], ["broker_inactivity_hours", "Corretor inativo", "Alerta quando corretor não registra atividade"]] as const).map(([key, label, helper]) => (
                    <div key={key}>
                      <label style={{ fontSize: 11, color: "var(--color-fog)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>{label}</label>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input type="number" min={1} value={cadence[key]} onChange={(e) => setCadence((p) => ({ ...p, [key]: Number(e.target.value) || 0 }))} disabled={dis} style={{ ...INPUT, width: 80 }} />
                        <span style={{ fontSize: 12, color: "var(--color-fog)" }}>horas</span>
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-disabled)", marginTop: 2 }}>{helper}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-dust)", marginBottom: 12 }}>Escalação de alertas</div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12 }}>
                  {([["escalation_yellow_pct", "Alerta amarelo", "#FBBF24"], ["escalation_red_pct", "Alerta vermelho", "#F87171"], ["escalation_abandoned_pct", "Abandonado", "#9C9686"]] as const).map(([key, label, color]) => (
                    <div key={key}>
                      <label style={{ fontSize: 11, color, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>{label}</label>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input type="number" min={1} max={300} value={cadence[key]} onChange={(e) => setCadence((p) => ({ ...p, [key]: Number(e.target.value) || 0 }))} disabled={dis} style={{ ...INPUT, width: 80 }} />
                        <span style={{ fontSize: 12, color: "var(--color-fog)" }}>% do tempo limite</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--surface-overlay)", borderRadius: 8, fontSize: 11, color: "var(--color-fog)", fontFamily: "var(--font-mono)" }}>
                  Ex: Negociação parada ({cadence.negotiation_idle_hours}h) → amarelo em {Math.round(cadence.negotiation_idle_hours * cadence.escalation_yellow_pct / 100)}h · vermelho em {Math.round(cadence.negotiation_idle_hours * cadence.escalation_red_pct / 100)}h · abandonado em {Math.round(cadence.negotiation_idle_hours * cadence.escalation_abandoned_pct / 100)}h
                </div>
              </div>

              {canUpd && <button type="button" onClick={saveCadence} disabled={cadenceSaving} style={{ padding: "10px 20px", borderRadius: 8, background: "var(--color-sprout)", color: "var(--interactive-on-primary)", border: "none", fontSize: 13, fontWeight: 600, cursor: cadenceSaving ? "wait" : "pointer" }}>{cadenceSaving ? "Salvando..." : "Salvar cadência"}</button>}
            </div>
          ) : null}

          {/* CHECKLIST DOCS — document_requirements (papel x documento) + catalogo */}
          {aba === "checklist" ? (
            <DocumentChecklistPanel
              accountId={actx.account?.accountId ?? null}
              developmentId={dctx.development?.developmentId ?? null}
              developmentName={dctx.development?.developmentName ?? null}
              canEdit={canUpd}
            />
          ) : null}

          {/* ═══ NOTIFICAÇÕES ═══ */}
          {aba === "notificacoes" ? (
            <div>
              <PageTitle title="Notificações" sub="Suas preferências de e-mail. Valem apenas para você." />
              <Card>
                <Sec title="E-mails do NEXA" sub="Convites e recuperação de senha são sempre enviados (não dependem destas opções)." />
                <Tog
                  ativo={notif.immediate_emails}
                  onChange={(v) => saveNotif({ ...notif, immediate_emails: v })}
                  label="E-mails imediatos"
                  sub="Novo lead, reserva, proposta, venda e demais avisos do fluxo, no momento em que acontecem."
                  disabled={notifSaving || !notifProfileId}
                />
                <Tog
                  ativo={notif.daily_digest}
                  onChange={(v) => saveNotif({ ...notif, daily_digest: v })}
                  label="Resumo diário"
                  sub="Um e-mail por dia pela manhã: leads novos, sem resposta e convertidos — só quando houver o que mostrar."
                  disabled={notifSaving || !notifProfileId}
                />
              </Card>
            </div>
          ) : null}

          {/* ═══ PERMISSÕES ═══ */}
          {aba === "permissoes" && isAdminRole ? (
            <PermissionsPanel accountId={actx.account?.accountId ?? null} enabled={isAdminRole} />
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

// ── Canais de Entrada (wizard self-service) ──
// Regra de negócio vive no hook useLeadChannels + repositório. A UI apenas
// coleta intenções e exibe. NÃO tocar em receive-lead (L2.2).

const MONO_LABEL: React.CSSProperties = { fontSize: 10, color: "var(--color-fog)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 4, textTransform: "uppercase" };
const CH_READONLY: React.CSSProperties = { ...INPUT, flex: 1, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-fog)" };
const CH_COPY_BTN: React.CSSProperties = { minHeight: 44, padding: "8px 12px", borderRadius: 6, border: "1px solid var(--color-stone)", background: "transparent", color: "var(--color-bone)", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" };

type ChannelForm = {
  providerAdapter: string; name: string; source: string; defaultDevelopmentId: string;
  defaultTemperature: string; distributionMode: string; defaultAssignedTo: string; fallbackAssignedTo: string;
};
const EMPTY_CHANNEL_FORM: ChannelForm = { providerAdapter: "", name: "", source: "", defaultDevelopmentId: "", defaultTemperature: "warm", distributionMode: "fixed", defaultAssignedTo: "", fallbackAssignedTo: "" };

// Membros da conta (para "Responsável" fixo e "Fallback" do rodízio).
function useAccountPeople(accountId: string | null) {
  const [people, setPeople] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    if (!supabase || !accountId) { setPeople([]); return; }
    let active = true;
    void supabase.from("user_account_access").select("user_id, profiles!inner(name)").eq("account_id", accountId).then(({ data }) => {
      if (!active) return;
      const list = ((data ?? []) as Record<string, unknown>[]).map((r) => {
        const p = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) as Record<string, unknown> | null;
        return { value: r.user_id as string, label: (p?.name as string) ?? "—" };
      }).sort((a, b) => a.label.localeCompare(b.label));
      setPeople(list);
    });
    return () => { active = false; };
  }, [accountId]);
  return people;
}

// Bloco de entrega (URL + API Key + instruções) — reutilizado na lista e no passo 3.
function ChannelDelivery({ channel, onCopy }: { channel: LeadChannel; onCopy: (t: string, l: string) => void }) {
  const url = `${RECEIVE_LEAD_URL}?key=${channel.apiKey}`;
  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <div style={MONO_LABEL}>URL de entrega</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input readOnly value={url} style={CH_READONLY} onFocus={(e) => e.target.select()} />
          <button type="button" onClick={() => onCopy(url, "URL")} style={CH_COPY_BTN}>Copiar</button>
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={MONO_LABEL}>API Key</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input readOnly value={channel.apiKey} style={CH_READONLY} onFocus={(e) => e.target.select()} />
          <button type="button" onClick={() => onCopy(channel.apiKey, "API Key")} style={CH_COPY_BTN}>Copiar</button>
        </div>
      </div>
      <div style={{ fontSize: 12, color: "var(--color-fog)", lineHeight: 1.6, padding: "10px 12px", background: "rgba(96,165,250,0.06)", borderRadius: 8, border: "1px solid rgba(96,165,250,0.15)" }}>
        <strong style={{ color: "var(--color-bone)" }}>Como conectar:</strong> {providerInstructions(channel.providerAdapter)}
      </div>
    </>
  );
}

function WebhooksPanel({ accountId, isMobile, setMsg, developments }: { accountId: string | null; isMobile: boolean; setMsg: (m: string | null) => void; developments: { id: string; name: string }[] }) {
  const { channels, loading, error, actions } = useLeadChannels();
  const { origins } = useLeadOrigins();
  const people = useAccountPeople(accountId);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ChannelForm>(EMPTY_CHANNEL_FORM);
  const [saving, setSaving] = useState(false);
  const [createdName, setCreatedName] = useState<string | null>(null);
  const [regen, setRegen] = useState<{ id: string; stage: 1 | 2 } | null>(null);
  const [regenKey, setRegenKey] = useState<{ id: string; key: string } | null>(null);

  const originLabel = (slug: string) => origins.find((o) => o.slug === slug)?.label ?? slug;
  const devName = (id: string | null) => (id ? developments.find((d) => d.id === id)?.name ?? "—" : "—");
  const distLabel = (v: string) => DISTRIBUTION_MODES.find((m) => m.value === v)?.label ?? v;

  // Origens do catálogo (ativas) + garante que a origem atual do form apareça.
  const sourceOptions = () => {
    const opts = origins.filter((o) => o.active).map((o) => ({ value: o.slug, label: o.label }));
    if (form.source && !opts.some((o) => o.value === form.source)) opts.unshift({ value: form.source, label: form.source });
    return opts;
  };

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setMsg(`${label} copiada!`); setTimeout(() => setMsg(null), 2000);
  }

  const openCreate = () => { setEditingId(null); setForm(EMPTY_CHANNEL_FORM); setCreatedName(null); setStep(1); setRegen(null); setRegenKey(null); setWizardOpen(true); };
  const openEdit = (c: LeadChannel) => {
    setEditingId(c.id);
    setForm({ providerAdapter: c.providerAdapter, name: c.name, source: c.source, defaultDevelopmentId: c.defaultDevelopmentId ?? "", defaultTemperature: c.defaultTemperature, distributionMode: c.distributionMode, defaultAssignedTo: c.defaultAssignedTo ?? "", fallbackAssignedTo: c.fallbackAssignedTo ?? "" });
    setCreatedName(null); setStep(2); setWizardOpen(true);
  };
  const closeWizard = () => { setWizardOpen(false); setEditingId(null); setForm(EMPTY_CHANNEL_FORM); setStep(1); setCreatedName(null); };

  const selectProvider = (p: typeof PROVIDER_ADAPTERS[number]) => {
    setForm((f) => ({ ...f, providerAdapter: p.value, source: f.source || p.originSlug }));
    setStep(2);
  };

  // Regra na UI apenas de bloqueio de avanço: round_robin exige fallback.
  const canSubmit = form.name.trim() !== "" && form.source !== "" && !(form.distributionMode === "round_robin" && !form.fallbackAssignedTo);

  const buildInput = (): LeadChannelInput => ({
    name: form.name.trim(), source: form.source, providerAdapter: form.providerAdapter,
    distributionMode: form.distributionMode, defaultTemperature: form.defaultTemperature,
    defaultDevelopmentId: form.defaultDevelopmentId || null,
    defaultAssignedTo: form.distributionMode === "fixed" ? (form.defaultAssignedTo || null) : null,
    fallbackAssignedTo: form.distributionMode === "round_robin" ? (form.fallbackAssignedTo || null) : null,
  });

  const submitStep2 = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      if (editingId) { await actions.update(editingId, buildInput()); setMsg("Canal atualizado"); }
      else { await actions.create(buildInput()); setCreatedName(form.name.trim()); setMsg("Canal criado"); }
      setTimeout(() => setMsg(null), 2500);
      setStep(3);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Não foi possível salvar o canal."); setTimeout(() => setMsg(null), 4000);
    } finally { setSaving(false); }
  };

  const handleRegenerate = async (id: string) => {
    try {
      const key = await actions.regenerate(id);
      setRegen(null); setRegenKey({ id, key });
      setMsg("Chave regenerada — copie a nova chave"); setTimeout(() => setMsg(null), 3500);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Não foi possível regenerar a chave."); setTimeout(() => setMsg(null), 4000);
    }
  };

  const handleDelete = async (c: LeadChannel) => {
    if (!confirm(`Excluir canal "${c.name}"? Esta ação não pode ser desfeita.`)) return;
    try { await actions.remove(c); setMsg("Canal excluído"); setTimeout(() => setMsg(null), 2500); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Canal com leads recebidos não pode ser excluído — desative-o."); setTimeout(() => setMsg(null), 4000); }
  };

  const wizardChannel = editingId ? channels.find((c) => c.id === editingId) ?? null : (createdName ? channels.find((c) => c.name === createdName) ?? null : null);

  const cardStyle: React.CSSProperties = isMobile
    ? { width: "100%", height: "100%", maxHeight: "100%", borderRadius: 0, background: "var(--surface-raised)", border: "1px solid var(--border-default)", padding: 20, overflowY: "auto", boxSizing: "border-box" }
    : { width: "100%", maxWidth: 560, maxHeight: "90vh", borderRadius: 12, background: "var(--surface-raised)", border: "1px solid var(--border-default)", padding: 24, overflowY: "auto", boxSizing: "border-box" };

  if (loading) return <div className="nexa-card" id="lead-channels-panel"><div style={{ fontSize: 13, color: "var(--color-fog)" }}>Carregando canais...</div></div>;

  return (
    <div className="nexa-card" id="lead-channels-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ minWidth: 0 }}>
          <div className="nexa-label" style={{ margin: 0 }}>Canais de Entrada</div>
          <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 2 }}>Cada canal gera uma URL de entrega e uma chave. Os leads recebidos entram automaticamente em Contatos.</div>
        </div>
        <button type="button" onClick={openCreate} style={{ minHeight: 44, padding: "0 16px", borderRadius: 8, border: "none", background: "var(--color-sprout)", color: "var(--color-ink)", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>+ Novo canal</button>
      </div>

      {error ? <div style={{ marginBottom: 12, fontSize: 12, color: "var(--color-terracotta)" }}>{error}</div> : null}

      {channels.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: "var(--color-fog)", fontSize: 13 }}>Nenhum canal configurado. Crie um para receber leads automaticamente.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {channels.map((c) => {
            const isExpanded = expandedId === c.id;
            return (
              <div key={c.id} style={{ background: "var(--color-ink)", border: `1px solid ${c.isActive ? "var(--color-stone)" : "rgba(248,113,113,0.2)"}`, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer" }} onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.isActive ? "#4ADE80" : "#F87171", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-bone)" }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 2 }}>{providerLabel(c.providerAdapter)} · {originLabel(c.source)} · {devName(c.defaultDevelopmentId)} · {distLabel(c.distributionMode)} · {c.totalReceived} recebidos{c.lastReceivedAt ? ` · Último: ${formatDateBRT(c.lastReceivedAt)}` : ""}</div>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--color-fog)", transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
                </div>
                {isExpanded ? (
                  <div style={{ padding: "12px 16px 16px", borderTop: "1px solid var(--color-stone)" }}>
                    <ChannelDelivery channel={c} onCopy={copyToClipboard} />
                    <div style={{ marginTop: 12, marginBottom: 12 }}>
                      {regenKey?.id === c.id ? (
                        <div style={{ marginBottom: 8 }}>
                          <div style={MONO_LABEL}>Nova API Key</div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input readOnly value={regenKey.key} style={CH_READONLY} onFocus={(e) => e.target.select()} />
                            <button type="button" onClick={() => copyToClipboard(regenKey.key, "Nova API Key")} style={CH_COPY_BTN}>Copiar</button>
                          </div>
                        </div>
                      ) : null}
                      {regen?.id === c.id && regen.stage === 1 ? (
                        <div style={{ padding: "10px 12px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 8, fontSize: 12, color: "var(--color-bone)" }}>
                          <div style={{ marginBottom: 8 }}>Regenerar a chave deste canal?</div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button type="button" onClick={() => setRegen({ id: c.id, stage: 2 })} style={{ minHeight: 40, padding: "6px 12px", borderRadius: 6, border: "1px solid #F59E0B", background: "rgba(245,158,11,0.12)", color: "#F59E0B", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Sim, continuar</button>
                            <button type="button" onClick={() => setRegen(null)} style={{ minHeight: 40, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--color-stone)", background: "transparent", color: "var(--color-fog)", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
                          </div>
                        </div>
                      ) : regen?.id === c.id && regen.stage === 2 ? (
                        <div style={{ padding: "10px 12px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)", borderRadius: 8, fontSize: 12, color: "var(--color-bone)" }}>
                          <div style={{ marginBottom: 8 }}>A chave atual <strong>para de funcionar imediatamente</strong>. Você precisará colar a nova chave no formulário da plataforma.</div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button type="button" onClick={() => void handleRegenerate(c.id)} style={{ minHeight: 40, padding: "6px 12px", borderRadius: 6, border: "none", background: "#F87171", color: "var(--color-ink)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Confirmar regeneração</button>
                            <button type="button" onClick={() => setRegen(null)} style={{ minHeight: 40, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--color-stone)", background: "transparent", color: "var(--color-fog)", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <button type="button" onClick={() => { setRegen({ id: c.id, stage: 1 }); setRegenKey(null); }} style={{ minHeight: 40, padding: "8px 14px", borderRadius: 6, border: "1px solid var(--color-stone)", background: "transparent", color: "var(--color-bone)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Regenerar chave</button>
                      )}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      <button type="button" onClick={() => openEdit(c)} style={{ minHeight: 40, padding: "8px 14px", borderRadius: 6, border: "1px solid var(--color-stone)", background: "transparent", color: "var(--color-bone)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Editar</button>
                      <button type="button" onClick={() => void actions.toggleActive(c.id, !c.isActive)} style={{ minHeight: 40, padding: "8px 14px", borderRadius: 6, border: `1px solid ${c.isActive ? "rgba(248,113,113,0.3)" : "rgba(74,222,128,0.3)"}`, background: c.isActive ? "rgba(248,113,113,0.06)" : "rgba(74,222,128,0.06)", color: c.isActive ? "#F87171" : "#4ADE80", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{c.isActive ? "Desativar" : "Ativar"}</button>
                      <button type="button" onClick={() => void handleDelete(c)} style={{ minHeight: 40, padding: "8px 14px", borderRadius: 6, border: "none", background: "transparent", color: "var(--color-fog)", fontSize: 12, cursor: "pointer" }}>Excluir</button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {wizardOpen ? (
        <NexaModal onClose={closeWizard} padding={isMobile ? 0 : 24} ariaLabel={editingId ? "Editar canal" : "Novo canal de entrada"}>
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div className="nexa-label" style={{ margin: 0 }}>{editingId ? "Editar canal" : "Novo canal de entrada"}</div>
              <button type="button" onClick={closeWizard} aria-label="Fechar" style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>×</button>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
              {[1, 2, 3].map((n) => <div key={n} style={{ flex: 1, height: 4, borderRadius: 2, background: step >= n ? "var(--color-sprout)" : "var(--color-stone)" }} />)}
            </div>

            {step === 1 ? (
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-bone)", marginBottom: 4 }}>De onde vêm esses leads?</div>
                <div style={{ fontSize: 12, color: "var(--color-fog)", marginBottom: 16 }}>Selecione a plataforma de origem. Isso ajusta as instruções de conexão e pré-seleciona a origem.</div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 10 }}>
                  {PROVIDER_ADAPTERS.map((p) => (
                    <button key={p.value} type="button" onClick={() => selectProvider(p)} style={{ textAlign: "left", minHeight: 64, padding: "14px 16px", borderRadius: 10, border: `1px solid ${form.providerAdapter === p.value ? "var(--color-sprout)" : "var(--color-stone)"}`, background: form.providerAdapter === p.value ? "rgba(74,222,128,0.08)" : "var(--color-ink)", cursor: "pointer", display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-bone)" }}>{p.label}</span>
                      <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--color-fog)", letterSpacing: "0.04em" }}>{p.originSlug}</span>
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
                  <button type="button" onClick={closeWizard} style={{ minHeight: 44, padding: "0 16px", borderRadius: 8, border: "1px solid var(--border-default)", background: "transparent", color: "var(--text-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <label style={MONO_LABEL}>Nome *</label>
                  <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Meta — Lançamento Vivendas" style={INPUT} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={MONO_LABEL}>Origem *</label>
                    <NexaSelect value={form.source} onChange={(v) => setForm((f) => ({ ...f, source: v }))} ariaLabel="Origem do lead" placeholder="Selecionar origem…" options={sourceOptions()} emptyLabel="Nenhuma origem cadastrada" />
                  </div>
                  <div>
                    <label style={MONO_LABEL}>Empreendimento padrão</label>
                    <NexaSelect value={form.defaultDevelopmentId} onChange={(v) => setForm((f) => ({ ...f, defaultDevelopmentId: v }))} ariaLabel="Empreendimento padrão" placeholder="Opcional" allowClear options={developments.map((dd) => ({ value: dd.id, label: dd.name }))} />
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={MONO_LABEL}>Temperatura padrão</label>
                  <div style={{ display: "flex", gap: 4 }}>
                    {(["cold", "warm", "hot"] as const).map((t) => { const cc = { hot: "#F87171", warm: "#F59E0B", cold: "#60A5FA" }[t]; const l = { hot: "Quente", warm: "Morno", cold: "Frio" }[t]; return <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, defaultTemperature: t }))} style={{ flex: 1, minHeight: 44, padding: "8px", borderRadius: 6, border: `1.5px solid ${form.defaultTemperature === t ? cc : "var(--color-stone)"}`, background: form.defaultTemperature === t ? cc + "15" : "transparent", color: form.defaultTemperature === t ? cc : "var(--color-fog)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{l}</button>; })}
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={MONO_LABEL}>Modo de distribuição</label>
                  <NexaSelect value={form.distributionMode} onChange={(v) => setForm((f) => ({ ...f, distributionMode: v }))} ariaLabel="Modo de distribuição" options={DISTRIBUTION_MODES.map((m) => ({ value: m.value, label: m.label }))} />
                </div>
                {form.distributionMode === "fixed" ? (
                  <div style={{ marginBottom: 16 }}>
                    <label style={MONO_LABEL}>Responsável</label>
                    <NexaSelect value={form.defaultAssignedTo} onChange={(v) => setForm((f) => ({ ...f, defaultAssignedTo: v }))} ariaLabel="Responsável fixo" placeholder="Sem responsável definido" allowClear options={people} emptyLabel="Nenhuma pessoa na conta" />
                  </div>
                ) : null}
                {form.distributionMode === "round_robin" ? (
                  <div style={{ marginBottom: 16 }}>
                    <label style={MONO_LABEL}>Fallback (obrigatório)</label>
                    <NexaSelect value={form.fallbackAssignedTo} onChange={(v) => setForm((f) => ({ ...f, fallbackAssignedTo: v }))} ariaLabel="Fallback do rodízio" placeholder="Selecionar pessoa…" options={people} emptyLabel="Nenhuma pessoa na conta" />
                    {!form.fallbackAssignedTo ? <div style={{ fontSize: 11, color: "var(--color-terracotta)", marginTop: 6 }}>Defina um fallback para quando o rodízio não encontrar destino.</div> : null}
                  </div>
                ) : null}
                <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 8 }}>
                  {editingId ? <span /> : <button type="button" onClick={() => setStep(1)} style={{ minHeight: 44, padding: "0 16px", borderRadius: 8, border: "1px solid var(--border-default)", background: "transparent", color: "var(--text-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Voltar</button>}
                  <button type="button" onClick={() => void submitStep2()} disabled={!canSubmit || saving} style={{ minHeight: 44, padding: "0 24px", borderRadius: 8, border: "none", background: "var(--color-sprout)", color: "var(--color-ink)", fontSize: 13, fontWeight: 700, cursor: !canSubmit || saving ? "default" : "pointer", opacity: !canSubmit || saving ? 0.6 : 1 }}>{saving ? "Salvando..." : editingId ? "Salvar" : "Criar canal"}</button>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-bone)", marginBottom: 4 }}>Entrega</div>
                <div style={{ fontSize: 12, color: "var(--color-fog)", marginBottom: 16 }}>Use a URL e a chave abaixo na plataforma de origem.</div>
                {wizardChannel ? (
                  <ChannelDelivery channel={wizardChannel} onCopy={copyToClipboard} />
                ) : (
                  <div style={{ fontSize: 12, color: "var(--color-fog)", padding: "12px 14px", background: "var(--surface-base)", borderRadius: 8 }}>Canal salvo. Abra o canal na lista para copiar a URL e a chave.</div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
                  <button type="button" onClick={closeWizard} style={{ minHeight: 44, padding: "0 24px", borderRadius: 8, border: "none", background: "var(--color-sprout)", color: "var(--color-ink)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Concluir</button>
                </div>
              </div>
            ) : null}
          </div>
        </NexaModal>
      ) : null}
    </div>
  );
}

// ── Lead Distribution Panel ──

function LeadDistributionPanel({ accountId, developmentId, canEdit }: { accountId: string | null; developmentId: string | null; canEdit: boolean }) {
  const d = useLeadDistributionAdmin(accountId, developmentId);
  const { hasRoundRobinChannel } = useLeadChannels();
  const [showAdd, setShowAdd] = useState(false);

  const ROLE_LABELS: Record<string, string> = { commercial_consultant: "Consultor", broker: "Corretor", director: "Diretor", manager: "Gestor", owner: "Dono", administrative: "Administrativo" };
  const ROLE_OPTIONS: { key: string; label: string }[] = [
    { key: "commercial_consultant", label: "Consultor" },
    { key: "broker", label: "Corretor" },
    { key: "manager", label: "Gestor" },
    { key: "director", label: "Diretor" },
  ];
  const activeCount = d.participants.filter((p) => p.active).length;

  const toggleRole = (key: string) => {
    if (!canEdit) return;
    const next = d.eligibleRoles.includes(key) ? d.eligibleRoles.filter((r) => r !== key) : [...d.eligibleRoles, key];
    if (next.length === 0) return; // mantém ao menos um papel elegível
    void d.saveEligibleRoles(next);
  };

  if (d.loading) return <div className="nexa-card" style={{ padding: 20 }}><div style={{ fontSize: 13, color: "var(--color-fog)" }}>Carregando distribuição...</div></div>;

  return (
    <div className="nexa-card" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div className="nexa-label" style={{ margin: 0 }}>Distribuição de Leads</div>
          <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 2 }}>Novos contatos sem responsável são distribuídos automaticamente por rodízio com peso.</div>
        </div>
        <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: d.enabled ? "var(--color-sprout)" : "var(--color-slate)", padding: "4px 10px", borderRadius: 6, background: d.enabled ? "var(--color-sprout-muted)" : "transparent", border: `1px solid ${d.enabled ? "var(--color-sprout)" : "var(--color-stone)"}`, fontWeight: 600 }}>
          {d.enabled ? `Ativa · ${activeCount}` : "Desligada"}
        </div>
      </div>

      {d.error ? <div style={{ marginBottom: 12, fontSize: 12, color: "var(--color-terracotta)" }}>{d.error}</div> : null}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "var(--surface-base)", border: "1px solid var(--border-default)", borderRadius: 10, marginBottom: 14 }}>
        <div style={{ minWidth: 0, paddingRight: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Rodízio automático</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Quando ligado, leads recebidos sem responsável são atribuídos ao próximo participante ativo.</div>
        </div>
        <button type="button" disabled={!canEdit || d.busy} onClick={() => void d.toggleEnabled(!d.enabled)} style={{ width: 40, height: 22, borderRadius: 11, border: "none", cursor: canEdit ? "pointer" : "default", background: d.enabled ? "var(--interactive-primary)" : "var(--surface-hover)", position: "relative", flexShrink: 0, opacity: canEdit ? 1 : 0.6 }}>
          <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: d.enabled ? 20 : 2, transition: "left 150ms ease", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
        </button>
      </div>

      {d.enabled && !hasRoundRobinChannel ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, justifyContent: "space-between", padding: "10px 14px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 10, marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "var(--color-bone)", lineHeight: 1.5, minWidth: 0 }}>A roleta está ativa, mas nenhum canal usa o modo Rodízio — os leads não serão distribuídos automaticamente.</div>
          <button type="button" onClick={() => document.getElementById("lead-channels-panel")?.scrollIntoView({ behavior: "smooth", block: "start" })} style={{ minHeight: 36, padding: "6px 12px", borderRadius: 8, border: "1px solid #F59E0B", background: "rgba(245,158,11,0.12)", color: "#F59E0B", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>Configurar canais</button>
        </div>
      ) : null}

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-disabled)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Papéis elegíveis</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ROLE_OPTIONS.map((r) => {
            const on = d.eligibleRoles.includes(r.key);
            return (
              <button key={r.key} type="button" disabled={!canEdit || d.busy} onClick={() => toggleRole(r.key)} style={{ padding: "6px 12px", borderRadius: 16, minHeight: 32, border: `1px solid ${on ? "var(--interactive-primary)" : "var(--border-default)"}`, background: on ? "rgba(74,222,128,0.12)" : "transparent", color: on ? "var(--interactive-primary)" : "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: canEdit ? "pointer" : "default" }}>{r.label}</button>
            );
          })}
        </div>
      </div>

      {d.participants.length === 0 ? (
        <div style={{ textAlign: "center", padding: "20px 0", color: "var(--color-fog)", fontSize: 13 }}>Nenhum participante no rodízio. Adicione abaixo.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {d.participants.map((p) => {
            const dimmed = !p.active || p.paused;
            return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: dimmed ? "transparent" : "var(--surface-base)", border: `1px solid ${dimmed ? "var(--border-subtle)" : "var(--border-default)"}`, borderRadius: 10, opacity: dimmed ? 0.6 : 1 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: dimmed ? "var(--surface-overlay)" : "var(--status-sprout-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: dimmed ? "var(--text-disabled)" : "var(--interactive-primary)", flexShrink: 0 }}>{p.name.charAt(0).toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                  {p.paused ? <span style={{ flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#F59E0B", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 6, padding: "1px 6px" }}>Pausado</span> : null}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{ROLE_LABELS[p.role] ?? p.role}</div>
              </div>
              {canEdit && (
                <button type="button" onClick={() => void d.setPaused(p.id, !p.paused)} disabled={d.busy} title={p.paused ? "Retomar (fim do afastamento)" : "Pausar (férias/afastamento)"} style={{ minHeight: 32, padding: "6px 10px", borderRadius: 8, border: `1px solid ${p.paused ? "rgba(245,158,11,0.45)" : "var(--border-default)"}`, background: p.paused ? "rgba(245,158,11,0.12)" : "transparent", color: p.paused ? "#F59E0B" : "var(--text-muted)", fontSize: 11, fontWeight: 600, cursor: d.busy ? "default" : "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>{p.paused ? "Retomar" : "Pausar"}</button>
              )}
              {canEdit && (
                <button type="button" onClick={() => void d.toggleActive(p.id, !p.active)} disabled={d.busy} title={p.active ? "Desativar" : "Ativar"} style={{ width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer", background: p.active ? "var(--interactive-primary)" : "var(--surface-hover)", position: "relative", flexShrink: 0 }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: p.active ? 18 : 2, transition: "left 150ms ease", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                </button>
              )}
              <div style={{ textAlign: "center", width: 56, flexShrink: 0 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-disabled)", letterSpacing: "0.1em", marginBottom: 2 }}>PESO</div>
                <input type="number" min={1} max={10} value={p.weight} disabled={!canEdit || d.busy} onChange={(e) => { const w = Number(e.target.value); if (w >= 1 && w <= 10) void d.setWeight(p.id, w); }} style={{ width: 40, textAlign: "center", padding: "4px", borderRadius: 6, border: "1px solid var(--border-default)", background: "var(--surface-raised)", color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700 }} />
              </div>
              <div style={{ textAlign: "center", width: 54, flexShrink: 0 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-disabled)", letterSpacing: "0.1em" }}>LEADS</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: "var(--text-secondary)" }}>{p.currentCount}</div>
              </div>
              {canEdit && (
                <button type="button" onClick={() => void d.remove(p.id)} disabled={d.busy} title="Remover" style={{ background: "none", border: "none", color: "var(--text-disabled)", fontSize: 16, cursor: "pointer", flexShrink: 0, lineHeight: 1, padding: "0 2px" }}>×</button>
              )}
            </div>
            );
          })}
        </div>
      )}

      {canEdit && (
        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {showAdd ? (
            <div style={{ width: 240 }}>
              <NexaSelect
                value=""
                disabled={d.busy}
                onChange={(v) => { if (v) { void d.add(v); setShowAdd(false); } }}
                placeholder="Escolher pessoa…"
                ariaLabel="Escolher pessoa"
                options={d.addable.map((p) => ({ value: p.userId, label: `${p.name} · ${ROLE_LABELS[p.role] ?? p.role}` }))}
              />
            </div>
          ) : (
            <button type="button" onClick={() => setShowAdd(true)} disabled={d.busy || d.addable.length === 0} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: d.addable.length === 0 ? "default" : "pointer", opacity: d.addable.length === 0 ? 0.5 : 1 }}>+ Adicionar participante</button>
          )}
          {showAdd && <button type="button" onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>Cancelar</button>}
          {d.participants.some((p) => p.currentCount > 0) && (
            <button type="button" onClick={() => void d.reset()} disabled={d.busy} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-disabled)", fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Zerar contadores</button>
          )}
        </div>
      )}

      <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--surface-base)", borderRadius: 8, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
        O próximo lead vai para o participante ativo com menor carga relativa (leads ÷ peso). Peso maior recebe proporcionalmente mais. Participantes são vinculados ao empreendimento ativo.
      </div>
    </div>
  );
}

// Matriz de documentos exigidos (document_requirements + catálogo) por
// empreendimento e papel. Substitui o editor antigo de document_type_configs.
// Reaproveita o hook useDocumentRequirements; persistência via repositório.
const CHECKLIST_ROLES: { key: PartyRole; label: string }[] = [
  { key: "primary_buyer", label: "Comprador" },
  { key: "spouse", label: "Cônjuge" },
  { key: "co_obligor", label: "Coobrigado" },
  { key: "attorney_in_fact", label: "Procurador" },
];

function DocumentChecklistPanel({ accountId, developmentId, developmentName, canEdit }: { accountId: string | null; developmentId: string | null; developmentName: string | null; canEdit: boolean }) {
  const dr = useDocumentRequirements(developmentId, accountId);

  const cellState = (role: PartyRole, typeId: string): RequirementCellState => {
    const r = dr.requirements.find((x) => x.partyRole === role && x.documentTypeId === typeId);
    return !r ? "missing" : r.isRequired ? "required" : "optional";
  };
  const cellStyle = (st: RequirementCellState): React.CSSProperties =>
    st === "required"
      ? { background: "rgba(74,222,128,0.14)", color: "var(--interactive-primary)", border: "1px solid rgba(74,222,128,0.35)" }
      : st === "optional"
      ? { background: "rgba(96,165,250,0.12)", color: "#60A5FA", border: "1px solid rgba(96,165,250,0.35)" }
      : { background: "transparent", color: "var(--text-disabled)", border: "1px solid var(--border-default)" };
  const cellText = (st: RequirementCellState) => (st === "required" ? "Obrig." : st === "optional" ? "Opc." : "—");

  if (!developmentId) {
    return <div style={{ fontSize: 13, color: "var(--color-fog)" }}>Selecione um empreendimento ativo para configurar o checklist de documentos.</div>;
  }
  if (dr.isLoading && dr.catalog.length === 0) {
    return <div className="nexa-card" style={{ padding: 20 }}><div style={{ fontSize: 13, color: "var(--color-fog)" }}>Carregando checklist...</div></div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 4, fontSize: 18, fontWeight: 700, color: "var(--color-bone)" }}>Checklist de Documentos</div>
      <div style={{ fontSize: 12, color: "var(--color-fog)", marginBottom: 16 }}>Documentos exigidos por papel — {developmentName ?? "empreendimento ativo"}. O checklist de cada cliente é semeado a partir do papel "Comprador".</div>
      {dr.errorMessage ? <div style={{ marginBottom: 12, fontSize: 12, color: "var(--color-terracotta)" }}>{dr.errorMessage}</div> : null}

      <div className="nexa-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 12, color: "var(--color-fog)", marginBottom: 14 }}>Clique numa célula para alternar: vazio → obrigatório → opcional.</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", minWidth: 520 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-disabled)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Documento</th>
                {CHECKLIST_ROLES.map((r) => (
                  <th key={r.key} style={{ textAlign: "center", padding: "8px 6px", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-disabled)", letterSpacing: "0.06em", textTransform: "uppercase", minWidth: 84 }}>{r.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dr.catalog.map((t) => (
                <tr key={t.id}>
                  <td style={{ padding: "8px 10px", fontSize: 13, color: "var(--text-secondary)", borderTop: "1px solid var(--border-subtle)", whiteSpace: "nowrap" }}>{t.label}</td>
                  {CHECKLIST_ROLES.map((r) => {
                    const st = cellState(r.key, t.id);
                    const busy = dr.mutatingCell === `${r.key}:${t.id}`;
                    return (
                      <td key={r.key} style={{ textAlign: "center", padding: "6px", borderTop: "1px solid var(--border-subtle)" }}>
                        <button type="button" disabled={!canEdit || busy} onClick={() => void dr.toggleRequirement(r.key, t.id, st)} style={{ minWidth: 64, padding: "5px 8px", borderRadius: 8, fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)", cursor: canEdit ? "pointer" : "default", opacity: busy ? 0.5 : 1, ...cellStyle(st) }}>{cellText(st)}</button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <div style={{ marginTop: 14 }}>
            <button type="button" onClick={() => void dr.restoreDefaults()} disabled={dr.isLoading} style={{ background: "none", border: "none", color: "var(--text-disabled)", fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Restaurar padrão do empreendimento</button>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, padding: "10px 14px", background: "var(--surface-overlay)", borderRadius: 8, fontSize: 11, color: "var(--color-fog)", lineHeight: 1.6 }}>
        Estes requisitos alimentam o checklist semeado para novos clientes (papel Comprador) e a ficha de documentos. Clientes existentes mantêm seus documentos atuais.
      </div>
    </div>
  );
}

// ── Lead Origins Panel (catálogo de origens) ──

function LeadOriginsPanel({ canEdit }: { canEdit: boolean }) {
  const { origins, loading, error, actions } = useLeadOrigins();
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    const label = newLabel.trim();
    if (!label || busy) return;
    setBusy(true);
    try { await actions.create(label); setNewLabel(""); } finally { setBusy(false); }
  };

  if (loading) return <div className="nexa-card" style={{ padding: 20 }}><div style={{ fontSize: 13, color: "var(--color-fog)" }}>Carregando origens...</div></div>;

  return (
    <div className="nexa-card" style={{ padding: 20 }}>
      <div>
        <div className="nexa-label" style={{ margin: 0 }}>Origens</div>
        <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 2 }}>Catálogo de canais de origem dos leads. Origens do sistema não podem ser excluídas — apenas desativadas.</div>
      </div>

      {error ? <div style={{ marginTop: 12, fontSize: 12, color: "var(--color-terracotta)" }}>{error}</div> : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
        {origins.length === 0 ? (
          <div style={{ textAlign: "center", padding: "16px 0", color: "var(--color-fog)", fontSize: 13 }}>Nenhuma origem cadastrada.</div>
        ) : origins.map((o) => (
          <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: o.active ? "var(--surface-base)" : "transparent", border: `1px solid ${o.active ? "var(--border-default)" : "var(--border-subtle)"}`, borderRadius: 10, opacity: o.active ? 1 : 0.6 }}>
            <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</span>
              {o.isSystem ? <span style={{ flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", background: "var(--surface-overlay)", border: "1px solid var(--border-default)", borderRadius: 6, padding: "1px 6px" }}>sistema</span> : null}
            </div>
            {canEdit ? (
              <button type="button" onClick={() => void actions.toggleActive(o.id, !o.active)} title={o.active ? "Desativar" : "Ativar"} style={{ width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer", background: o.active ? "var(--interactive-primary)" : "var(--surface-hover)", position: "relative", flexShrink: 0 }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: o.active ? 18 : 2, transition: "left 150ms ease", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
              </button>
            ) : (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-disabled)" }}>{o.active ? "Ativa" : "Inativa"}</span>
            )}
          </div>
        ))}
      </div>

      {canEdit ? (
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }} placeholder="Nova origem (ex: Indicação)" disabled={busy} style={{ ...INPUT, flex: 1 }} />
          <button type="button" onClick={() => void handleCreate()} disabled={!newLabel.trim() || busy} style={{ minHeight: 44, padding: "0 16px", borderRadius: 8, border: "none", background: "var(--color-sprout)", color: "var(--color-ink)", fontSize: 13, fontWeight: 700, cursor: !newLabel.trim() || busy ? "default" : "pointer", opacity: !newLabel.trim() || busy ? 0.6 : 1, whiteSpace: "nowrap" }}>+ Nova origem</button>
        </div>
      ) : null}
    </div>
  );
}

// ── Lead Campaigns Panel (Campanhas & Ações) ──

type CampaignForm = { name: string; channel: string; developmentId: string; utmCampaignMatch: string; startsAt: string; endsAt: string; budget: string; active: boolean };
const EMPTY_CAMPAIGN_FORM: CampaignForm = { name: "", channel: "", developmentId: "", utmCampaignMatch: "", startsAt: "", endsAt: "", budget: "", active: true };
const MODAL_LABEL: React.CSSProperties = { fontSize: 10, color: "var(--color-fog)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", display: "block", marginBottom: 4, textTransform: "uppercase" };

function LeadCampaignsPanel({ canEdit, isMobile, setMsg, developments }: { canEdit: boolean; isMobile: boolean; setMsg: (m: string | null) => void; developments: { id: string; name: string }[] }) {
  const { campaigns, loading, error, actions } = useLeadCampaigns();
  const { origins } = useLeadOrigins();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LeadCampaign | null>(null);
  const [form, setForm] = useState<CampaignForm>(EMPTY_CAMPAIGN_FORM);
  const [saving, setSaving] = useState(false);

  const originLabel = (slug: string) => origins.find((o) => o.slug === slug)?.label ?? slug;
  const channelOptions = origins.map((o) => ({ value: o.slug, label: o.active ? o.label : `${o.label} (inativa)` }));
  const devName = (id: string | null) => (id ? developments.find((d) => d.id === id)?.name ?? "—" : null);

  const openNew = () => {
    const firstActive = origins.find((o) => o.active)?.slug ?? "";
    setEditing(null);
    setForm({ ...EMPTY_CAMPAIGN_FORM, channel: firstActive });
    setModalOpen(true);
  };
  const openEdit = (c: LeadCampaign) => {
    setEditing(c);
    setForm({
      name: c.name, channel: c.channel, developmentId: c.developmentId ?? "",
      utmCampaignMatch: c.utmCampaignMatch ?? "", startsAt: (c.startsAt ?? "").slice(0, 10),
      endsAt: (c.endsAt ?? "").slice(0, 10), budget: c.budget != null ? String(c.budget) : "", active: c.active,
    });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name || !form.channel || saving) return;
    setSaving(true);
    const input: LeadCampaignInput = {
      name, channel: form.channel,
      developmentId: form.developmentId || null,
      utmCampaignMatch: form.utmCampaignMatch.trim() || null,
      startsAt: form.startsAt || null, endsAt: form.endsAt || null,
      budget: form.budget.trim() === "" ? null : Number(form.budget),
      active: form.active,
    };
    try {
      if (editing) await actions.update(editing.id, input); else await actions.create(input);
      closeModal();
      setMsg("Campanha salva"); setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Não foi possível salvar a campanha."); setTimeout(() => setMsg(null), 4000);
    } finally { setSaving(false); }
  };

  const handleDelete = async (c: LeadCampaign) => {
    if (!confirm(`Excluir campanha "${c.name}"?`)) return;
    try {
      await actions.remove(c.id);
      setMsg("Campanha excluída"); setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Campanha com leads vinculados não pode ser excluída — desative-a."); setTimeout(() => setMsg(null), 4000);
    }
  };

  if (loading) return <div className="nexa-card" style={{ padding: 20 }}><div style={{ fontSize: 13, color: "var(--color-fog)" }}>Carregando campanhas...</div></div>;

  const cardStyle: React.CSSProperties = isMobile
    ? { width: "100%", height: "100%", maxHeight: "100%", borderRadius: 0, background: "var(--surface-raised)", border: "1px solid var(--border-default)", padding: 20, overflowY: "auto", boxSizing: "border-box" }
    : { width: "100%", maxWidth: 520, maxHeight: "90vh", borderRadius: 12, background: "var(--surface-raised)", border: "1px solid var(--border-default)", padding: 24, overflowY: "auto", boxSizing: "border-box" };

  return (
    <div className="nexa-card" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <div style={{ minWidth: 0 }}>
          <div className="nexa-label" style={{ margin: 0 }}>Campanhas &amp; Ações</div>
          <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 2 }}>Campanhas de captação com casamento de UTM, período e orçamento. A contagem mostra os leads vinculados.</div>
        </div>
        {canEdit ? <button type="button" onClick={openNew} style={{ minHeight: 44, padding: "0 16px", borderRadius: 8, border: "none", background: "var(--color-sprout)", color: "var(--color-ink)", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>+ Nova campanha</button> : null}
      </div>

      {error ? <div style={{ marginTop: 12, fontSize: 12, color: "var(--color-terracotta)" }}>{error}</div> : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
        {campaigns.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: "var(--color-fog)", fontSize: 13 }}>Nenhuma campanha cadastrada.</div>
        ) : campaigns.map((c) => {
          const period = c.startsAt || c.endsAt ? `${c.startsAt ? formatDateBRT(c.startsAt) : "…"} – ${c.endsAt ? formatDateBRT(c.endsAt) : "…"}` : null;
          return (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: c.active ? "var(--surface-base)" : "transparent", border: `1px solid ${c.active ? "var(--border-default)" : "var(--border-subtle)"}`, borderRadius: 10, opacity: c.active ? 1 : 0.6, flexWrap: isMobile ? "wrap" : "nowrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                  <span style={{ flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: c.active ? "var(--interactive-primary)" : "var(--text-disabled)", background: c.active ? "var(--status-sprout-muted)" : "var(--surface-overlay)", border: `1px solid ${c.active ? "rgba(74,222,128,0.35)" : "var(--border-default)"}`, borderRadius: 6, padding: "1px 6px" }}>{c.active ? "Ativa" : "Inativa"}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 3 }}>
                  {originLabel(c.channel)}
                  {devName(c.developmentId) ? ` · ${devName(c.developmentId)}` : ""}
                  {period ? ` · ${period}` : ""}
                  {c.utmCampaignMatch ? ` · UTM: ${c.utmCampaignMatch}` : ""}
                </div>
              </div>
              <div style={{ textAlign: "center", width: 54, flexShrink: 0 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-disabled)", letterSpacing: "0.1em" }}>LEADS</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: "var(--text-secondary)" }}>{c.leadCount}</div>
              </div>
              {canEdit ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <button type="button" onClick={() => openEdit(c)} style={{ minHeight: 32, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-default)", background: "transparent", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Editar</button>
                  <button type="button" onClick={() => void actions.toggleActive(c.id, !c.active)} title={c.active ? "Desativar" : "Ativar"} style={{ width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer", background: c.active ? "var(--interactive-primary)" : "var(--surface-hover)", position: "relative" }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: c.active ? 18 : 2, transition: "left 150ms ease", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                  </button>
                  <button type="button" onClick={() => void handleDelete(c)} title="Excluir" style={{ background: "none", border: "none", color: "var(--text-disabled)", fontSize: 16, cursor: "pointer", lineHeight: 1, padding: "0 2px" }}>×</button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {modalOpen ? (
        <NexaModal onClose={closeModal} padding={isMobile ? 0 : 24} ariaLabel={editing ? "Editar campanha" : "Nova campanha"}>
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div className="nexa-label" style={{ margin: 0 }}>{editing ? "Editar campanha" : "Nova campanha"}</div>
              <button type="button" onClick={closeModal} aria-label="Fechar" style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>×</button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={MODAL_LABEL}>Nome *</label>
              <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Facebook — Lançamento Vivendas" style={INPUT} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={MODAL_LABEL}>Canal (origem) *</label>
                <NexaSelect value={form.channel} onChange={(v) => setForm((f) => ({ ...f, channel: v }))} ariaLabel="Canal da campanha" placeholder="Selecionar origem…" options={channelOptions} emptyLabel="Nenhuma origem cadastrada" />
              </div>
              <div>
                <label style={MODAL_LABEL}>Empreendimento</label>
                <NexaSelect value={form.developmentId} onChange={(v) => setForm((f) => ({ ...f, developmentId: v }))} ariaLabel="Empreendimento da campanha" placeholder="Todos os empreendimentos" allowClear options={developments.map((d) => ({ value: d.id, label: d.name }))} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={MODAL_LABEL}>Início</label>
                <input type="date" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} style={INPUT} />
              </div>
              <div>
                <label style={MODAL_LABEL}>Fim</label>
                <input type="date" value={form.endsAt} onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))} style={INPUT} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={MODAL_LABEL}>Casamento UTM</label>
                <input type="text" value={form.utmCampaignMatch} onChange={(e) => setForm((f) => ({ ...f, utmCampaignMatch: e.target.value }))} placeholder="utm_campaign a casar" style={INPUT} />
              </div>
              <div>
                <label style={MODAL_LABEL}>Orçamento (R$)</label>
                <input type="number" min={0} value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))} placeholder="Opcional" style={INPUT} />
              </div>
            </div>

            <Tog ativo={form.active} onChange={(v) => setForm((f) => ({ ...f, active: v }))} label="Campanha ativa" sub="Campanhas inativas não recebem novos leads pelo casamento de UTM" />

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
              <button type="button" onClick={closeModal} style={{ minHeight: 44, padding: "0 16px", borderRadius: 8, border: "1px solid var(--border-default)", background: "transparent", color: "var(--text-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button type="button" onClick={() => void handleSave()} disabled={!form.name.trim() || !form.channel || saving} style={{ minHeight: 44, padding: "0 24px", borderRadius: 8, border: "none", background: "var(--color-sprout)", color: "var(--color-ink)", fontSize: 13, fontWeight: 700, cursor: !form.name.trim() || !form.channel || saving ? "default" : "pointer", opacity: !form.name.trim() || !form.channel || saving ? 0.6 : 1 }}>{saving ? "Salvando..." : "Salvar"}</button>
            </div>
          </div>
        </NexaModal>
      ) : null}
    </div>
  );
}
