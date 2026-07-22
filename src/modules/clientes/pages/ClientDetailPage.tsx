import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { useAuth } from "../../../app/contexts/AuthContext";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { createNegotiationFromClient, markClientActiveNegotiationsLost } from "../../../infra/repositories/negotiationsSupabaseRepository";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import { fluidGrid } from "../../../shared/responsive";
import { useClientDocuments, type ClientDoc } from "../hooks/useClientDocuments";
import { getNegotiationStatusLabel } from "../../../domain/negociacao/NegotiationStatusLabel";
import { timeAgo } from "../../../shared/utils/timeAgo";
import { formatDateBRT, formatTimeBRT, formatDateLongBRT, getTodayDateStringBRT } from "../../../shared/utils/dateUtils";
import LostReasonModal from "../../../shared/components/LostReasonModal";
import SpouseLinkModal from "../components/SpouseLinkModal";
import SpousePeek from "../components/SpousePeek";
import type { Client, LegalRegime, MaritalStatus } from "../../../shared/types/client";
import { getClientWithSpouse, unlinkSpouses, registerContactInteraction } from "../../../infra/repositories/clientsSupabaseRepository";
import { filterMirroredActivities, simulationTimelineItems } from "../timelineMerge";
import { ConfirmacaoDestructiva } from "../../../shared/components/ConfirmacaoDestructiva";
import { isNegotiationActive } from "../../../domain/status/negotiation";
import { fromLeadQualificationDb, isLeadActive } from "../../../domain/status/leadQualification";
import { LEAD_STAGE_META } from "../../leads/leadDisplay";
import { NexaSelect } from "../../../shared/ui/NexaSelect";
import { NexaModal } from "../../../shared/ui/NexaModal";
import { useReturnTo } from "../../../shared/navigation/useReturnTo";
import { ENTITY_LIST_HOME, simulatorForClient, simulationRoute } from "../../../shared/navigation/entityRoutes";
import { EntityLink } from "../../../shared/navigation/EntityLink";
import { listSimulationsByClient } from "../../../infra/repositories/pipelineSimulationsSupabaseRepository";
import type { PipelineSimulation } from "../../../shared/types/simulation";
import JSZip from "jszip";
import { saveAs } from "file-saver";

// ── Types ──

interface ClientData {
  id: string; name: string; full_name: string | null; email: string | null; phone: string | null;
  cpf: string | null; rg: string | null; rg_orgao: string | null; data_nascimento: string | null;
  nacionalidade: string | null; naturalidade: string | null; genero: string | null;
  marital_status: string | null; profession: string | null; renda_mensal: number | null;
  cep: string | null; endereco: string | null; numero: string | null; complemento: string | null;
  bairro: string | null; city: string | null; uf: string | null;
  conjuge_nome: string | null; conjuge_cpf: string | null; conjuge_rg: string | null;
  conjuge_data_nascimento: string | null; conjuge_profissao: string | null;
  conjuge_email: string | null; conjuge_telefone: string | null; regime_casamento: string | null;
  observations: string | null; temperature: string | null; last_interaction_at: string | null;
  doc_status: string | null; created_at: string;
  // Engrenagem de Partes v1 — novo vínculo relacional de cônjuge
  current_spouse_client_id: string | null;
  // Extended fields from unification
  status: string | null; qualification_status: string | null; score: number | null; origin: string | null; origin_detail: string | null;
  buyer_profile: string | null; budget_min: number | null; budget_max: number | null;
  purchase_timeline: string | null; payment_preference: string | null; interested_unit_type: string | null;
  lost_at: string | null; lost_reason: string | null; lost_reason_detail: string | null;
  reactivated_at: string | null; reactivation_count: number | null;
  assigned_to: string | null; assigned_at: string | null; assigned_by: string | null;
}

const STATUS_LABELS: Record<string, string> = { new: "Novo", contacted: "Contatado", qualifying: "Qualificando", qualified: "Qualificado", nurturing: "Nutrição", negotiating: "Em negociação", active: "Ativo", converted: "Convertido", lost: "Perdido", inactive: "Inativo" };
const STATUS_COLORS: Record<string, string> = { new: "#60A5FA", contacted: "#A78BFA", qualifying: "#FBBF24", qualified: "#4ADE80", nurturing: "#38BDF8", negotiating: "#F97316", active: "#22C55E", converted: "#22C55E", lost: "#F87171", inactive: "#6B7280" };
const TEMP_CFG: Record<string, { label: string; color: string; bg: string }> = { hot: { label: "Quente", color: "#F87171", bg: "rgba(248,113,113,0.12)" }, warm: { label: "Morno", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" }, cold: { label: "Frio", color: "#60A5FA", bg: "rgba(96,165,250,0.12)" } };
const SOURCE_LABELS: Record<string, string> = { website: "Website", instagram: "Instagram", facebook: "Facebook", google_ads: "Google Ads", whatsapp: "WhatsApp", phone: "Telefone", referral: "Indicação", broker_indication: "Indicação corretor", event: "Evento", walk_in: "Presencial", landing_page: "Landing Page", rd_station: "RD Station", import: "Importação", other: "Outro" };

// ClientDoc vem do repositório (fonte única do shape de client_documents).


interface ClientNeg { id: string; status: string; score: number | null; updated_at: string; unit_quadra: string | null; unit_lote: string | null; unit_valor: number | null; broker_name: string | null }
interface ClientAct { id: string; type: string; title: string; status: string; activity_date: string; outcome: string | null; duration_minutes: number; profile_id: string | null; created_at: string | null }

const T = { ink: "var(--surface-base)", carbon: "var(--surface-raised)", stone: "var(--border-default)", chalk: "var(--text-primary)", bone: "var(--text-secondary)", fog: "var(--text-muted)", slate: "var(--text-disabled)", sprout: "var(--interactive-primary)", blue: "#60A5FA", red: "#F87171", amber: "#FBBF24", purple: "#A78BFA" };
const TYPE_LABELS: Record<string, string> = { visit_broker: "Visita corretor", visit_client: "Visita cliente", visit_development: "Visita empreend.", training: "Treinamento", phone_call: "Ligação", follow_up: "Follow-up", meeting_internal: "Reunião interna", meeting_external: "Reunião externa", other: "Outro" };
const DOC_TYPES = [
  { key: "rg_frente", label: "RG (frente)" }, { key: "rg_verso", label: "RG (verso)" },
  { key: "cpf", label: "CPF" }, { key: "comprovante_renda", label: "Comprovante de renda" },
  { key: "comprovante_endereco", label: "Comprovante de endereço" },
  { key: "certidao_casamento", label: "Certidão de casamento" }, { key: "irpf", label: "IRPF" },
];
const ESTADO_CIVIL_OPTS = [{ v: "solteiro", l: "Solteiro(a)" }, { v: "casado", l: "Casado(a)" }, { v: "divorciado", l: "Divorciado(a)" }, { v: "viuvo", l: "Viúvo(a)" }, { v: "uniao_estavel", l: "União estável" }];
const UF_OPTS = UF_OPTIONS;
const SPOUSE_LINKABLE_STATUSES: MaritalStatus[] = ["casado", "uniao_estavel"];
const REGIME_CASAMENTO_LABEL: Record<string, string> = {
  comunhao_parcial: "Comunhão parcial",
  comunhao_universal: "Comunhão universal",
  separacao_total: "Separação total",
  participacao_final_aquestos: "Participação final nos aquestos",
};

// SVG icons inline para o card hero de cônjuge — substitui emojis sem
// adicionar dependência de lucide-react (Sprint A.1).
type SpouseIconProps = { size?: number; color?: string };
const SpouseIcon = {
  Heart: ({ size = 14, color = "currentColor" }: SpouseIconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
    </svg>
  ),
  Phone: ({ size = 12, color = "currentColor" }: SpouseIconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  AlertTriangle: ({ size = 14, color = "currentColor" }: SpouseIconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  ),
  ArrowRight: ({ size = 12, color = "currentColor" }: SpouseIconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  ),
};

import { maskCPF, maskPhone, maskCurrency, currencyToNumber, maskRG, maskCEP, formatCurrency, formatCPF, formatPhone, UF_OPTIONS } from "../../../shared/utils/masks";
import { secureMaskCPF, secureMaskRG, secureMaskRenda } from "../../../lib/security";
import SensitiveField from "../../../shared/components/SensitiveField";
function fmtBRL(v: number | null) { return formatCurrency(v); }

const IS: React.CSSProperties = { width: "100%", background: "linear-gradient(168deg, rgba(34,33,28,0.5), rgba(18,17,14,0.15))", border: "1px solid rgba(61,58,48,0.15)", borderRadius: 8, padding: "10px 14px", color: T.chalk, fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border-color 150ms ease" };
const LBL: React.CSSProperties = { fontSize: 8, color: "#5C5647", fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: 6 };

// ── Animated temperature badge ──
function TempBadge({ temp }: { temp: string | null }) {
  const t = temp || "warm";
  const cfg: Record<string, { label: string; color: string; bg: string; anim: string }> = {
    hot: { label: "Quente", color: "#FF6B35", bg: "rgba(255,75,0,0.12)", anim: "tempShimmer 3s ease infinite" },
    warm: { label: "Morno", color: "#F59E0B", bg: "rgba(245,158,11,0.12)", anim: "tempPulse 2.5s ease infinite" },
    cold: { label: "Frio", color: "#60A5FA", bg: "rgba(96,165,250,0.10)", anim: "" },
  };
  const c = cfg[t] || cfg.warm;
  return <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 14px", borderRadius: 99, background: c.bg, color: c.color, border: `1px solid ${c.color}25`, animation: c.anim, display: "inline-flex", alignItems: "center", gap: 4 }}>{t === "hot" ? "🔥" : t === "cold" ? "❄" : "☀"} {c.label}</span>;
}

// ── Quick activity modal ──
function QuickActivityModal({ clientId, clientName, accountId, developmentId, profileId, onClose, onSaved }: { clientId: string; clientName: string; accountId: string; developmentId: string; profileId: string; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState("phone_call");
  const [title, setTitle] = useState("");
  const [outcome, setOutcome] = useState("");
  const [saving, setSaving] = useState(false);
  const submittingRef = useRef(false);
  const types = [["phone_call", "Ligação"], ["follow_up", "Follow-up"], ["visit_client", "Visita"], ["meeting_external", "Reunião"], ["other", "Outro"]];
  async function handleSave() {
    if (!supabase || !title.trim() || submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    try {
      await supabase.from("activities").insert({ account_id: accountId, development_id: developmentId, profile_id: profileId, client_id: clientId, type, title: title.trim(), activity_date: new Date().toISOString().slice(0, 10), duration_minutes: 30, status: "completed", outcome: outcome.trim() || null, contact_name: clientName });
      await supabase.from("clients").update({ last_interaction_at: new Date().toISOString() }).eq("id", clientId);
      onSaved(); onClose();
    } catch (err) { setOutcome(err instanceof Error ? err.message : "Erro ao salvar"); }
    finally { submittingRef.current = false; setSaving(false); }
  }
  const IS2: React.CSSProperties = { width: "100%", background: "var(--surface-base)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "10px 14px", color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box" };
  return (
    <NexaModal onClose={onClose}>
      <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 14, padding: 24, width: 420, maxWidth: "90vw" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Registrar atendimento</h3>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 18, cursor: "pointer" }}>x</button>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, padding: "8px 12px", background: "var(--surface-base)", borderRadius: 8, border: "1px solid var(--border-default)" }}>Cliente: <strong style={{ color: "var(--text-secondary)" }}>{clientName}</strong></div>
        <label style={LBL}>Tipo</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {types.map(([k, l]) => <button key={k} type="button" onClick={() => setType(k)} style={{ padding: "6px 14px", borderRadius: 8, border: type === k ? "2px solid var(--interactive-primary)" : "1px solid var(--border-default)", background: type === k ? "rgba(74,222,128,0.08)" : "transparent", color: type === k ? "var(--interactive-primary)" : "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{l}</button>)}
        </div>
        <label style={LBL}>Título *</label>
        <input style={{ ...IS2, marginBottom: 14 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Retorno sobre proposta" autoFocus />
        <label style={LBL}>Resultado</label>
        <input style={{ ...IS2, marginBottom: 20 }} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="O que aconteceu?" />
        <button type="button" onClick={handleSave} disabled={!title.trim() || saving} style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", background: "var(--interactive-primary)", color: "var(--interactive-on-primary)", fontSize: 14, fontWeight: 700, cursor: !title.trim() || saving ? "not-allowed" : "pointer", opacity: !title.trim() || saving ? 0.5 : 1 }}>{saving ? "Salvando..." : "Registrar"}</button>
      </div>
    </NexaModal>
  );
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const returnTo = useReturnTo(ENTITY_LIST_HOME.contact); // "← Leads/Negociações/Contatos" conforme a origem
  const { account } = useAccount();
  const { development } = useDevelopment();
  const { authenticatedProfile } = useAuth();
  const screen = useScreen();
  const isMobile = screen.isMobile;
  const accountId = account?.accountId ?? null;
  const userId = authenticatedProfile?.id ?? null;
  const canReview = ["owner", "director", "manager", "concierge", "administrative"].includes((account?.role as string) ?? "");
  const isManagerRole = ["owner", "director", "manager"].includes((account?.role as string) ?? "");
  const canEditItem = (performedBy: string | null) => isManagerRole || performedBy === userId;

  const [client, setClient] = useState<ClientData | null>(null);
  const [negotiations, setNegotiations] = useState<ClientNeg[]>([]);
  const [simulations, setSimulations] = useState<PipelineSimulation[]>([]);
  const [simUnits, setSimUnits] = useState<Record<string, string>>({}); // unitId -> "Q·L"
  const [activities, setActivities] = useState<ClientAct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<"interacoes" | "dados" | "endereco" | "interesse" | "documentos" | "historico">("interacoes");
  const [showLostModal, setShowLostModal] = useState(false);
  const [contactInteractions, setContactInteractions] = useState<{ id: string; type: string; direction: string | null; title: string | null; description: string | null; performed_by: string | null; performed_at: string; activity_id: string | null; profiles?: { name: string } | null }[]>([]);
  // B2: guarda síncrona in-flight (ref) — o disabled por estado não protege contra duplo-clique rápido.
  const busyRef = useRef(false);
  const [showInlineInteraction, setShowInlineInteraction] = useState(false);
  const [intType, setIntType] = useState("phone_call");
  const [intTitle, setIntTitle] = useState("");
  const [intDesc, setIntDesc] = useState("");
  const [showSuccessHint, setShowSuccessHint] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<ClientData>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<ClientDoc | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void; variant?: "default" | "danger" } | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);

  // Documentos do cliente: regra/persistência no hook (checklist canônico via
  // document_requirements + catálogo; upload/revisão/lote/remoção). O
  // componente só renderiza e dispara ações.
  const cd = useClientDocuments({
    clientId: id ?? null,
    accountId,
    developmentId: ((client as { development_id?: string | null } | null)?.development_id) ?? null,
    userId,
    clientName: client?.full_name || client?.name || "Cliente",
    accountName: account?.accountName ?? null,
    developmentName: development?.developmentName ?? null,
    onToast: setToast,
  });
  const { documents, checklistTypes, uploadingDocType, setUploadingDocType, approvingAll } = cd;
  const uploadDocument = cd.upload;
  const reviewDoc = cd.review;
  const approveAllDocs = cd.approveAll;
  const removeDocument = cd.remove;
  // Follow-up
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [fuDate, setFuDate] = useState("");
  const [fuType, setFuType] = useState("phone_call");
  const [fuNote, setFuNote] = useState("");
  // Assignment
  const [teamMembers, setTeamMembers] = useState<{ userId: string; name: string; role: string }[]>([]);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  // Conversion
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convDevId, setConvDevId] = useState("");
  const [convNote, setConvNote] = useState("");
  const [devList, setDevList] = useState<{ id: string; name: string }[]>([]);
  // Interaction edit/delete
  const [activeIntMenu, setActiveIntMenu] = useState<string | null>(null);
  const [editingInt, setEditingInt] = useState<{ id: string; title: string; description: string } | null>(null);
  const [showSpouseModal, setShowSpouseModal] = useState(false);
  const [spouse, setSpouse] = useState<Client | null>(null);
  const [spouseLoading, setSpouseLoading] = useState(false);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const [showSpousePeek, setShowSpousePeek] = useState(false);

  useEffect(() => {
    if (!activeIntMenu) return;
    const h = () => setActiveIntMenu(null);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [activeIntMenu]);


  async function handleSaveEditInteraction() {
    if (!supabase || !editingInt) return;
    const { error } = await supabase.from("contact_interactions").update({ title: editingInt.title || null, description: editingInt.description || null }).eq("id", editingInt.id);
    if (error) { setToast("Erro ao salvar"); return; }
    setEditingInt(null);
    setToast("Interação atualizada");
    load(true);
  }

  const f = (key: keyof ClientData) => (form[key] as string) ?? (client?.[key] as string) ?? "";
  const setF = (key: keyof ClientData, val: string) => setForm((p) => ({ ...p, [key]: val }));

  const load = useCallback(async (silent = false) => {
    if (!supabase || !id || !accountId) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const { data: cl } = await supabase.from("clients").select(`
        id, account_id, development_id, name, full_name, email, phone, phone_secondary,
        cpf, rg, rg_orgao, data_nascimento, nacionalidade, naturalidade, genero,
        marital_status, profession, renda_mensal,
        cep, endereco, numero, complemento, bairro, city, uf,
        conjuge_nome, conjuge_cpf, conjuge_rg, conjuge_data_nascimento, conjuge_profissao,
        conjuge_email, conjuge_telefone, regime_casamento,
        current_spouse_client_id,
        observations, temperature, last_interaction_at, doc_status, created_at,
        status, qualification_status, score, origin, origin_detail, buyer_profile, budget_min, budget_max,
        purchase_timeline, payment_preference, interested_unit_type,
        lost_at, lost_reason, lost_reason_detail, reactivated_at, reactivation_count,
        assigned_to, assigned_at, assigned_by
      `).eq("id", id).single();
      const loaded = cl as ClientData | null;
      setClient(loaded);
      if (loaded?.current_spouse_client_id) {
        setSpouseLoading(true);
        try {
          const result = await getClientWithSpouse(loaded.id);
          setSpouse(result?.spouse ?? null);
        } catch (err) {
          console.error("[ClientDetailPage] Falha ao carregar cônjuge:", err);
          setSpouse(null);
        } finally {
          setSpouseLoading(false);
        }
      } else {
        setSpouse(null);
      }
      const { data: negs } = await supabase.from("negotiations").select("id, status, score, updated_at, units(quadra, lote, valor), brokers(name)").eq("client_id", id).eq("account_id", accountId).order("created_at", { ascending: false });
      setNegotiations((negs ?? []).map((n: Record<string, unknown>) => { const u = (Array.isArray(n.units) ? n.units[0] : n.units) as Record<string, unknown> | null; const b = (Array.isArray(n.brokers) ? n.brokers[0] : n.brokers) as Record<string, unknown> | null; return { id: n.id as string, status: n.status as string, score: n.score as number | null, updated_at: n.updated_at as string, unit_quadra: u?.quadra as string | null, unit_lote: u?.lote as string | null, unit_valor: u?.valor as number | null, broker_name: b?.name as string | null }; }));
      // Simulações ativas do cliente (Lei 2: o que existe no banco aparece).
      try {
        const sims = await listSimulationsByClient(id);
        setSimulations(sims);
        const uids = Array.from(new Set(sims.map((sm) => sm.unitId).filter(Boolean))) as string[];
        if (uids.length) {
          const { data: us } = await supabase.from("units").select("id, quadra, lote").in("id", uids);
          const m: Record<string, string> = {};
          (us ?? []).forEach((u) => { const r = u as Record<string, unknown>; m[r.id as string] = `Q${r.quadra}·L${r.lote}`; });
          setSimUnits(m);
        } else setSimUnits({});
      } catch { setSimulations([]); setSimUnits({}); }
      const { data: acts } = await supabase.from("activities").select("id, type, title, status, activity_date, outcome, duration_minutes, profile_id, created_at").eq("client_id", id).eq("account_id", accountId).order("activity_date", { ascending: false }).limit(10);
      setActivities((acts ?? []) as ClientAct[]);
      // Documentos e checklist são carregados pelo hook useClientDocuments.
      const { data: ints } = await supabase.from("contact_interactions").select("id, type, direction, title, description, performed_by, performed_at, activity_id, profiles(name)").eq("client_id", id).order("performed_at", { ascending: false }).limit(50);
      setContactInteractions((ints ?? []) as unknown as typeof contactInteractions);
      // Load team members for assignment
      const { data: team } = await supabase.from("user_account_access").select("user_id, role, profiles!inner(id, name)").eq("account_id", accountId);
      setTeamMembers((team ?? []).map((t: Record<string, unknown>) => { const p = (Array.isArray(t.profiles) ? t.profiles[0] : t.profiles) as Record<string, unknown>; return { userId: t.user_id as string, name: (p?.name as string) ?? "—", role: t.role as string }; }));
      // Load developments for conversion
      const { data: devs } = await supabase.from("developments").select("id, name").eq("account_id", accountId).order("name");
      setDevList((devs ?? []).map((d: Record<string, unknown>) => ({ id: d.id as string, name: d.name as string })));
    } catch (err) { console.error("ClientDetail load error:", err); }
    finally { setLoading(false); }
  }, [id, accountId]);

  useEffect(() => { void load(); }, [load]);

  async function handleSave() {
    if (!supabase || !id || !client) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(form)) { if (v !== undefined && v !== (client as unknown as Record<string, unknown>)[k]) payload[k] = v || null; }
      if (Object.keys(payload).length > 0) {
        // Bug primário corrigido: Supabase retorna { error } em vez de throw.
        // Validar explicitamente para não aplicar update otimista em caso de
        // falha (RLS, constraint, rede) e não mentir pro usuário via toast.
        const { data: updated, error } = await supabase
          .from("clients")
          .update(payload)
          .eq("id", id)
          .select()
          .maybeSingle();
        if (error) {
          console.error("[ClientDetailPage] Erro ao salvar:", error);
          setToast(`Erro ao salvar: ${error.message}`);
          return;
        }
        if (!updated) {
          setToast("Erro ao salvar: cliente não foi atualizado (verifique permissões).");
          return;
        }
        // Fonte da verdade vem do banco, não do payload local.
        setClient(updated as unknown as ClientData);
      }
      setEditing(false); setForm({}); setToast("Cliente atualizado");
    } catch (err) {
      console.error("[ClientDetailPage] Exceção ao salvar:", err);
      setToast("Erro ao salvar");
    } finally { setSaving(false); }
  }

  async function buscarCep() {
    const cep = f("cep").replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) { setF("endereco", data.logradouro || ""); setF("bairro", data.bairro || ""); setF("city", data.localidade || ""); setF("uf", data.uf || ""); }
    } catch {}
  }

  const canRemoveDoc = (doc: ClientDoc) => {
    const role = (account?.role as string) ?? "";
    if (["owner", "director", "administrative"].includes(role)) return true;
    if (role === "concierge") return false;
    return doc.uploaded_by === userId;
  };

  function fmtFileSize(bytes: number | null | undefined): string {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function downloadClientPackage() {
    if (!supabase || !client) return;
    const approvedDocs = documents.filter((d) => d.status === "approved" && d.storage_path);
    if (approvedDocs.length === 0) { setToast("Nenhum documento aprovado para baixar"); return; }
    setDownloadingZip(true);
    try {
      const zip = new JSZip();
      const sanitize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
      const clientName = sanitize(client.full_name || client.name || "Cliente");
      const root = zip.folder(clientName)!;
      const docsFolder = root.folder("Documentos")!;

      // 1. Download approved documents
      for (const doc of approvedDocs) {
        try {
          const { data: signed } = await supabase.storage.from("client-documents").createSignedUrl(doc.storage_path!, 300);
          if (signed?.signedUrl) {
            const res = await fetch(signed.signedUrl);
            const blob = await res.blob();
            const ext = doc.file_name?.split(".").pop() || "pdf";
            const typeName = sanitize(effectiveDocTypes.find((dt) => dt.key === doc.document_type)?.label || doc.document_type);
            docsFolder.file(`${typeName}.${ext}`, blob);
          }
        } catch (err) { console.warn(`Skip ${doc.document_type}:`, err); }
      }

      // 2. Ficha cadastral PDF
      try {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF();
        pdf.setFontSize(18); pdf.setFont("helvetica", "bold");
        pdf.text("Ficha Cadastral do Cliente", 20, 25);
        pdf.setFontSize(10); pdf.setFont("helvetica", "normal"); pdf.setTextColor(120);
        pdf.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} via NEXA`, 20, 33);
        pdf.setDrawColor(200); pdf.line(20, 37, 190, 37);
        pdf.setTextColor(40); pdf.setFontSize(11);
        let y = 48;
        const add = (label: string, val: string | null | undefined) => { if (!val) return; pdf.setFont("helvetica", "bold"); pdf.text(`${label}:`, 20, y); pdf.setFont("helvetica", "normal"); pdf.text(val, 75, y); y += 8; };
        add("Nome completo", client.full_name || client.name);
        add("CPF", client.cpf);
        add("RG", client.rg ? `${client.rg}${client.rg_orgao ? ` — ${client.rg_orgao}` : ""}` : null);
        add("Data nascimento", client.data_nascimento);
        add("Nacionalidade", client.nacionalidade);
        add("Naturalidade", client.naturalidade);
        add("Estado civil", client.marital_status ? ESTADO_CIVIL_OPTS.find((o) => o.v === client.marital_status)?.l || client.marital_status : null);
        add("Profissão", client.profession);
        add("Renda mensal", client.renda_mensal ? fmtBRL(client.renda_mensal) : null);
        add("Telefone", client.phone);
        add("Email", client.email);
        y += 4;
        add("Endereço", client.endereco ? `${client.endereco}${client.numero ? `, ${client.numero}` : ""}${client.complemento ? ` — ${client.complemento}` : ""}` : null);
        add("Bairro", client.bairro);
        add("Cidade/UF", client.city ? `${client.city}${client.uf ? ` — ${client.uf}` : ""}` : null);
        add("CEP", client.cep);
        if (client.conjuge_nome) { y += 6; pdf.setFontSize(13); pdf.setFont("helvetica", "bold"); pdf.text("Cônjuge", 20, y); y += 8; pdf.setFontSize(11); add("Nome", client.conjuge_nome); add("CPF", client.conjuge_cpf); add("RG", client.conjuge_rg); add("Profissão", client.conjuge_profissao); add("Email", client.conjuge_email); add("Telefone", client.conjuge_telefone); }
        y += 12; pdf.setFontSize(9); pdf.setTextColor(150);
        pdf.text("Documento gerado automaticamente pelo NEXA Plataforma Comercial", 20, y);
        pdf.text("app.nexacomercial.com.br", 20, y + 5);
        root.file("Ficha_Cadastral.pdf", pdf.output("blob"));
      } catch (err) { console.warn("Ficha PDF error:", err); }

      // 3. Generate ZIP
      const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      const ts = new Date().toISOString().slice(0, 10);
      saveAs(zipBlob, `${clientName}_Documentos_${ts}.zip`);
      setToast("Pacote baixado");
    } catch (err) { console.error("ZIP error:", err); setToast("Erro ao gerar pacote"); }
    finally { setDownloadingZip(false); }
  }

  if (loading) return <div style={{ padding: 32 }}><div style={{ fontSize: 13, color: T.fog, fontFamily: "var(--font-mono)" }}>Carregando...</div></div>;
  if (!client) return <div style={{ padding: 32 }}><div style={{ fontSize: 14, color: T.red }}>Cliente não encontrado.</div><button type="button" onClick={() => navigate(returnTo.to)} style={{ marginTop: 16, background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8, padding: "8px 16px", color: T.bone, fontSize: 13, cursor: "pointer" }}>← {returnTo.label}</button></div>;

  // Checklist canônico vindo de document_requirements + catálogo (via hook);
  // fallback para a lista mínima caso a conta/empreendimento não tenha requisitos.
  const effectiveDocTypes: { key: string; label: string; required: boolean; description?: string | null }[] = checklistTypes.length > 0
    ? checklistTypes
    : DOC_TYPES.map((d) => ({ ...d, required: d.key !== "certidao_casamento" }));
  const docsByType: Record<string, ClientDoc> = {}; documents.forEach((d) => { if (!docsByType[d.document_type] || d.created_at > docsByType[d.document_type].created_at) docsByType[d.document_type] = d; });
  const docApproved = effectiveDocTypes.filter((dt) => docsByType[dt.key]?.status === "approved").length;
  const docUploaded = effectiveDocTypes.filter((dt) => { const s = docsByType[dt.key]?.status; return s === "uploaded" || s === "sent"; }).length;
  const docRejected = effectiveDocTypes.filter((dt) => docsByType[dt.key]?.status === "rejected").length;
  const docPending = effectiveDocTypes.length - docApproved - docUploaded - docRejected;
  const hasUploadedToApprove = docUploaded > 0 && canReview;
  const allRequiredApproved = effectiveDocTypes.filter((dt) => dt.required).every((dt) => docsByType[dt.key]?.status === "approved");

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: isMobile ? "16px 12px" : "24px 0" }}>
      {/* CSS animations for temperature badge */}
      <style>{`@keyframes tempShimmer{0%{box-shadow:0 0 6px rgba(255,75,0,0.3)}50%{box-shadow:0 0 14px rgba(255,75,0,0.6)}100%{box-shadow:0 0 6px rgba(255,75,0,0.3)}}@keyframes tempPulse{0%,100%{box-shadow:0 0 4px rgba(245,158,11,0.2)}50%{box-shadow:0 0 10px rgba(245,158,11,0.5)}}@keyframes nxSpin{to{transform:rotate(360deg)}}@keyframes nxPulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <button type="button" onClick={() => navigate(returnTo.to)} style={{ background: "none", border: "none", color: T.fog, fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 6 }}>← {returnTo.label}</button>
          <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: T.chalk, margin: 0 }}>{client.full_name || client.name}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            <TempBadge temp={client.temperature} />
            <span onClick={() => setTab("documentos")} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: (docApproved === effectiveDocTypes.length ? T.sprout : docApproved > 0 ? T.blue : T.fog) + "15", color: docApproved === effectiveDocTypes.length ? T.sprout : docApproved > 0 ? T.blue : T.fog, cursor: "pointer", boxShadow: docApproved === effectiveDocTypes.length ? "0 0 6px rgba(74,222,128,0.3)" : "none", transition: "all 0.3s" }}>{docApproved}/{effectiveDocTypes.length} docs</span>
            {client.score != null && client.score > 0 && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: "rgba(74,222,128,0.1)", color: client.score >= 70 ? T.sprout : client.score >= 40 ? T.amber : T.fog, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{client.score}pt</span>}
            {(() => {
              // Conexão com /leads: contato que É lead ativo abre a tela de Leads focada nele.
              const lq = fromLeadQualificationDb(client.qualification_status);
              if (!isLeadActive(lq)) return null;
              const m = LEAD_STAGE_META[lq];
              return (
                <span onClick={() => navigate(`/leads?q=${encodeURIComponent(client.full_name || client.name)}`)} title="Lead ativo — abrir na tela de Leads" style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: m.soft, color: m.color, border: `1px solid ${m.color}40`, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>Lead · {m.label} →</span>
              );
            })()}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!editing && <button type="button" onClick={() => { setEditing(true); setForm({}); }} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.bone, fontSize: 13, cursor: "pointer" }}>✎ Editar</button>}
          {editing && <button type="button" onClick={() => { setEditing(false); setForm({}); }} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 13, cursor: "pointer" }}>Cancelar</button>}
          {editing && <button type="button" onClick={handleSave} disabled={saving} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: T.sprout, color: "var(--interactive-on-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{saving ? "Salvando..." : "Salvar"}</button>}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: fluidGrid(150, "fill"), gap: 10, marginBottom: 16 }}>
        <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: "12px 14px" }}><div style={{ fontSize: 10, color: T.fog, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginBottom: 4 }}>ATENDIMENTOS</div><div style={{ fontSize: 22, fontWeight: 700, color: T.chalk }}>{activities.length}</div></div>
        <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: "12px 14px" }}><div style={{ fontSize: 10, color: T.fog, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginBottom: 4 }}>ÚLTIMO CONTATO</div><div style={{ fontSize: 14, fontWeight: 600, color: client.last_interaction_at ? T.bone : T.slate }}>{client.last_interaction_at ? timeAgo(client.last_interaction_at) : "Nunca"}</div>{!client.last_interaction_at && <button type="button" onClick={() => setActivityModalOpen(true)} style={{ fontSize: 11, color: T.sprout, background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 4 }}>+ Registrar agora</button>}</div>
        <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: "12px 14px" }}><div style={{ fontSize: 10, color: T.fog, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginBottom: 4 }}>NEGOCIAÇÕES</div><div style={{ fontSize: 22, fontWeight: 700, color: T.chalk }}>{negotiations.length}</div></div>
        <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: "12px 14px" }}><div style={{ fontSize: 10, color: T.fog, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginBottom: 4 }}>SIMULAÇÕES</div><div style={{ fontSize: 22, fontWeight: 700, color: T.chalk }}>{simulations.length}</div></div>
        <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: "12px 14px" }}><div style={{ fontSize: 10, color: T.fog, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginBottom: 4 }}>SCORE</div><div style={{ fontSize: 22, fontWeight: 700, color: (client.score ?? 0) >= 70 ? T.sprout : (client.score ?? 0) >= 40 ? T.amber : T.chalk }}>{client.score ?? 0}<span style={{ fontSize: 12, fontWeight: 400, color: T.fog }}>/100</span></div></div>
        <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: "12px 14px" }}><div style={{ fontSize: 10, color: T.fog, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginBottom: 4 }}>INTERESSE</div>{(() => { const INTERESSE_LABELS: Record<string, string> = { lote_urbano: "Lote Urbano", lote_rural: "Lote Rural", terreno: "Terreno", apartamento: "Apartamento", casa: "Casa", outro: "Outro" }; const val = (client as unknown as Record<string, unknown>).interesse as string | null; return <NexaSelect value={val ?? ""} onChange={async (nv) => { if (!supabase) return; const v = nv || null; await supabase.from("clients").update({ interesse: v }).eq("id", client.id); setClient((prev) => prev ? { ...prev, interesse: v } as ClientData : null); setToast("Interesse atualizado"); }} placeholder="— Selecionar" ariaLabel="Interesse" options={Object.entries(INTERESSE_LABELS).map(([k, l]) => ({ value: k, label: l }))} />; })()}</div>
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <button type="button" onClick={() => navigate(simulatorForClient(client.id, client.assigned_to), { state: { from: `/contatos/${client.id}`, fromLabel: "Contato" } })} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.bone, fontSize: 13, cursor: "pointer" }}>Simular</button>
      </div>

      {/* Engrenagem de Cônjuge v2 — card hero */}
      {client.marital_status && SPOUSE_LINKABLE_STATUSES.includes(client.marital_status as MaritalStatus) && (
        <div style={{
          marginBottom: 20,
          padding: 16,
          borderRadius: 8,
          border: `1px solid ${client.current_spouse_client_id ? T.stone : T.amber}`,
          background: T.carbon,
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "stretch" : "center",
          justifyContent: "space-between",
          gap: 12,
        }}>
          {/* Modo A — Vinculado completo */}
          {client.current_spouse_client_id && spouse && !spouseLoading && (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, letterSpacing: 1.2, color: T.bone, fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: 6, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <SpouseIcon.Heart size={14} color={T.bone} />
                  CÔNJUGE
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: T.chalk, marginBottom: 4 }}>
                  {spouse.fullName || spouse.name || "(sem nome)"}
                </div>
                <div style={{ fontSize: 13, color: T.bone, lineHeight: 1.6, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                  {spouse.cpf && <span>CPF: {formatCPF(spouse.cpf)} ·</span>}
                  <SpouseIcon.Phone size={12} color={T.bone} />
                  <span>{spouse.phone ? formatPhone(spouse.phone) : "(sem telefone)"}</span>
                </div>
                {client.regime_casamento && (
                  <div style={{ fontSize: 12, color: T.bone, marginTop: 4 }}>
                    {REGIME_CASAMENTO_LABEL[client.regime_casamento] ?? client.regime_casamento}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setShowSpousePeek(true)}
                  style={{ padding: "8px 14px", borderRadius: 6, border: `1px solid ${T.stone}`, background: "transparent", color: T.chalk, fontSize: 12, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  VER FICHA
                  <SpouseIcon.ArrowRight size={12} color={T.chalk} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowUnlinkConfirm(true)}
                  style={{ padding: "8px 14px", borderRadius: 6, border: `1px solid ${T.stone}`, background: "transparent", color: T.bone, fontSize: 12, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.5, cursor: "pointer" }}
                >
                  DESVINCULAR
                </button>
              </div>
            </>
          )}

          {/* Estado de loading */}
          {client.current_spouse_client_id && spouseLoading && (
            <div style={{ color: T.bone, fontSize: 13 }}>
              Carregando dados do cônjuge...
            </div>
          )}

          {/* Modo B — Casado mas sem cônjuge */}
          {!client.current_spouse_client_id && (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, letterSpacing: 1.2, color: T.amber, fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: 6, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <SpouseIcon.AlertTriangle size={14} color={T.amber} />
                  CÔNJUGE NÃO CADASTRADO
                </div>
                <div style={{ fontSize: 14, color: T.chalk, lineHeight: 1.5 }}>
                  Cliente marcado como casado(a). Cadastre o cônjuge para completar o registro familiar.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSpouseModal(true)}
                style={{ padding: "10px 16px", borderRadius: 6, border: "none", background: T.sprout, color: T.ink, fontSize: 12, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, cursor: "pointer", flexShrink: 0, width: isMobile ? "100%" : "auto" }}
              >
                + CADASTRAR CÔNJUGE
              </button>
            </>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${T.stone}`, marginBottom: 20, overflowX: "auto" }}>
        {([["interacoes", "Interações"], ["dados", "Dados"], ["endereco", "Endereço"], ["interesse", "Interesse"], ["documentos", `Documentos (${docApproved}/${effectiveDocTypes.length})`], ["historico", "Histórico"]] as [string, string][]).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k as typeof tab)} style={{ padding: "10px 16px", background: "none", border: "none", borderBottom: tab === k ? `2px solid ${T.sprout}` : "2px solid transparent", color: tab === k ? T.sprout : T.fog, fontSize: 13, fontWeight: tab === k ? 600 : 400, cursor: "pointer", whiteSpace: "nowrap" }}>{l}</button>
        ))}
      </div>

      {/* Tab: Interações */}
      {tab === "interacoes" && (
        <div>
          {/* Qualificação rápida */}
          <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 12, padding: "16px 20px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: T.fog }}>Temperatura</span>
              <div style={{ display: "flex", gap: 4 }}>
                {(["cold", "warm", "hot"] as const).map((t) => { const c = TEMP_CFG[t]; const active = client.temperature === t; return <button key={t} type="button" onClick={async () => { if (!supabase || !id) return; await supabase.from("clients").update({ temperature: t }).eq("id", id); setClient((p) => p ? { ...p, temperature: t } as ClientData : null); setToast("Temperatura atualizada"); }} style={{ padding: "5px 14px", borderRadius: 20, border: `1.5px solid ${active ? c.color : T.stone}`, background: active ? c.bg : "transparent", color: active ? c.color : T.fog, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>{c.label}</button>; })}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: T.fog, marginRight: 4 }}>Status</span>
              {["new", "contacted", "qualifying", "qualified", "nurturing", "negotiating", "active"].map((s) => { const color = STATUS_COLORS[s] || T.fog; const isCurrent = (client.status || "active") === s; return <button key={s} type="button" onClick={async () => { if (!supabase || !id || saving) return; setSaving(true); try { await supabase.from("clients").update({ status: s }).eq("id", id); setClient((p) => p ? { ...p, status: s } as ClientData : null); setToast("Status atualizado"); } finally { setSaving(false); } }} disabled={saving} style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: `1px solid ${isCurrent ? color : T.stone}`, background: isCurrent ? color + "18" : "transparent", color: isCurrent ? color : T.slate, cursor: "pointer", transition: "all 0.15s" }}>{STATUS_LABELS[s]}</button>; })}
              {client.status === "lost" && <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "#F8717118", color: "#F87171", border: "1px solid #F8717130" }}>Perdido</span>}
              {client.status === "converted" && <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "#22C55E18", color: "#22C55E", border: "1px solid #22C55E30" }}>Convertido</span>}
            </div>
          </div>

          {/* Follow-up destaque (topo) */}
          {(() => { const nextFu = (client as unknown as Record<string, unknown>).next_follow_up_at as string | null; if (!nextFu) return null; const isOverdue = new Date(nextFu) < new Date(); const daysUntil = Math.ceil((new Date(nextFu).getTime() - Date.now()) / 864e5); const isToday = daysUntil === 0; const fuColor = isOverdue ? T.red : isToday ? T.amber : T.blue; return (
            <div style={{ background: isOverdue ? "rgba(248,113,113,0.08)" : isToday ? "rgba(251,191,36,0.08)" : "rgba(96,165,250,0.08)", border: `1px solid ${fuColor}30`, borderRadius: 12, padding: "14px 16px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: fuColor }}>{isOverdue ? `Follow-up atrasado há ${Math.abs(daysUntil)} dia${Math.abs(daysUntil) !== 1 ? "s" : ""}` : isToday ? "Follow-up para hoje" : daysUntil === 1 ? "Follow-up amanhã" : `Follow-up em ${daysUntil} dias`}</div>
                <div style={{ fontSize: 12, color: T.fog, marginTop: 2 }}>{formatDateBRT(nextFu)} às {formatTimeBRT(nextFu)}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={async () => { if (!supabase || !id || !userId || !accountId) return; setSaving(true); try { await supabase.from("contact_interactions").insert({ account_id: accountId, client_id: id, type: "follow_up", direction: "outbound", title: "Follow-up concluído", performed_by: userId }); if (development?.developmentId) { await supabase.from("activities").insert({ account_id: accountId, development_id: development.developmentId, profile_id: userId, client_id: id, type: "follow_up", title: "Follow-up concluído", activity_date: new Date().toISOString().slice(0, 10), duration_minutes: 15, status: "completed", contact_name: client.full_name || client.name }); } await supabase.from("clients").update({ next_follow_up_at: null, last_interaction_at: new Date().toISOString() }).eq("id", id); setShowSuccessHint(true); load(true); } finally { setSaving(false); } }} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: T.sprout, color: "var(--interactive-on-primary)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Concluir</button>
                <button type="button" onClick={() => { setFuDate(nextFu.slice(0, 16)); setShowFollowUpForm(true); setShowInlineInteraction(false); }} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 12, cursor: "pointer" }}>Reagendar</button>
              </div>
            </div>
          ); })()}

          {/* Success hint after interaction */}
          {showSuccessHint && (
            <div style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.blue }}>Interação registrada!</div>
                <div style={{ fontSize: 12, color: T.fog, marginTop: 2 }}>Deseja agendar o próximo contato?</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => { const days = client.temperature === "hot" ? 2 : client.temperature === "cold" ? 14 : 5; const d = new Date(); d.setDate(d.getDate() + days); setFuDate(d.toISOString().slice(0, 16)); setShowSuccessHint(false); setShowFollowUpForm(true); setShowInlineInteraction(false); }} style={{ fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8, background: T.blue, color: "#fff", border: "none", cursor: "pointer" }}>Sim, agendar</button>
                <button type="button" onClick={() => setShowSuccessHint(false)} style={{ fontSize: 12, fontWeight: 500, padding: "6px 14px", borderRadius: 8, background: "transparent", color: T.fog, border: `1px solid ${T.stone}`, cursor: "pointer" }}>Agora não</button>
              </div>
            </div>
          )}

          {/* Responsável */}
          <div style={{ background: "linear-gradient(168deg, rgba(34,33,28,0.5), rgba(18,17,14,0.15))", border: "1px solid rgba(61,58,48,0.08)", borderRadius: 12, padding: "14px 16px", marginBottom: 12, position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 8, color: "#5C5647", fontFamily: "var(--font-mono)", letterSpacing: "0.12em" }}>RESPONSÁVEL</span>
                {(() => { const assignedName = teamMembers.find((m) => m.userId === client.assigned_to)?.name; return assignedName ? <><div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(74,222,128,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#4ADE80", marginLeft: 8 }}>{assignedName.charAt(0)}</div><span style={{ fontSize: 13, fontWeight: 600, color: "#E8E5DE" }}>{assignedName}</span></> : <span style={{ fontSize: 13, color: "#5C5647", marginLeft: 8 }}>Sem responsável</span>; })()}
              </div>
              {canReview && <button type="button" onClick={() => setShowAssignDropdown(!showAssignDropdown)} style={{ fontSize: 11, color: "#706B5F", background: "none", border: "1px solid rgba(61,58,48,0.2)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", transition: "all 150ms ease" }}>Alterar</button>}
            </div>
            {showAssignDropdown && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, background: "linear-gradient(168deg, rgba(34,33,28,0.95), rgba(18,17,14,0.85))", border: "1px solid rgba(61,58,48,0.2)", borderRadius: "0 0 10px 10px", maxHeight: 200, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                <div key="none" onClick={async () => { if (!supabase || !id || !userId || busyRef.current) return; busyRef.current = true; setSaving(true); try { await supabase.from("clients").update({ assigned_to: null, assigned_at: null, assigned_by: null }).eq("id", id); await supabase.from("contact_interactions").insert({ account_id: accountId, client_id: id, type: "assignment_change", title: "Responsável removido", performed_by: userId }); setClient((p) => p ? { ...p, assigned_to: null, assigned_at: null, assigned_by: null } : null); setShowAssignDropdown(false); setToast("Responsável removido"); load(true); } finally { busyRef.current = false; setSaving(false); } }} style={{ padding: "9px 14px", cursor: "pointer", fontSize: 13, color: "#5C5647", fontStyle: "italic", borderBottom: "1px solid rgba(61,58,48,0.1)" }}>— Nenhum</div>
                {teamMembers.map((m) => <div key={m.userId} onClick={async () => { if (!supabase || !id || !userId || busyRef.current) return; busyRef.current = true; setSaving(true); try { await supabase.from("clients").update({ assigned_to: m.userId, assigned_at: new Date().toISOString(), assigned_by: userId }).eq("id", id); await supabase.from("contact_interactions").insert({ account_id: accountId, client_id: id, type: "assignment_change", title: `Atribuído para ${m.name}`, metadata: { to_user: m.userId }, performed_by: userId }); setClient((p) => p ? { ...p, assigned_to: m.userId, assigned_at: new Date().toISOString(), assigned_by: userId } : null); setShowAssignDropdown(false); setToast(`Atribuído para ${m.name}`); load(true); } finally { busyRef.current = false; setSaving(false); } }} style={{ padding: "9px 14px", cursor: "pointer", fontSize: 13, color: "#C4BFB3", borderBottom: "1px solid rgba(61,58,48,0.06)", transition: "all 100ms ease" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(74,222,128,0.04)"; e.currentTarget.style.color = "#E8E5DE"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#C4BFB3"; }}>{m.name} <span style={{ fontSize: 11, color: "#706B5F" }}>· {m.role}</span></div>)}
              </div>
            )}
          </div>

          {/* Two action cards */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <button type="button" onClick={() => { setShowInlineInteraction(!showInlineInteraction); setShowFollowUpForm(false); setShowSuccessHint(false); }} style={{ background: showInlineInteraction ? "rgba(74,222,128,0.06)" : T.carbon, border: `1px solid ${showInlineInteraction ? T.sprout : T.stone}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: showInlineInteraction ? T.sprout : T.chalk, marginBottom: 4 }}>+ Registrar interação</div>
              <div style={{ fontSize: 11, color: T.fog, lineHeight: 1.4 }}>O que você acabou de fazer? Ligou, visitou, enviou mensagem...</div>
            </button>
            <button type="button" onClick={() => { setShowFollowUpForm(!showFollowUpForm); setShowInlineInteraction(false); setShowSuccessHint(false); const d = new Date(); d.setDate(d.getDate() + (client.temperature === "hot" ? 2 : client.temperature === "cold" ? 14 : 5)); if (!showFollowUpForm) setFuDate(d.toISOString().slice(0, 16)); }} style={{ background: showFollowUpForm ? "rgba(96,165,250,0.06)" : T.carbon, border: `1px solid ${showFollowUpForm ? T.blue : T.stone}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: showFollowUpForm ? T.blue : T.chalk, marginBottom: 4 }}>+ Agendar follow-up</div>
              <div style={{ fontSize: 11, color: T.fog, lineHeight: 1.4 }}>Qual será seu próximo passo? Agende uma ligação, visita, reunião...</div>
            </button>
          </div>

          {/* Follow-up form */}
          {showFollowUpForm && (
            <div style={{ background: T.carbon, border: `1px solid rgba(96,165,250,0.3)`, borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
              <div style={{ marginBottom: 12 }}><label style={LBL}>Data e hora</label><input type="datetime-local" style={IS} value={fuDate} onChange={(e) => setFuDate(e.target.value)} /></div>
              <div style={{ fontSize: 11, color: T.fog, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginBottom: 8 }}>TIPO</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {[["phone_call", "Ligação"], ["whatsapp", "WhatsApp"], ["visit_client", "Visita"], ["email", "Email"], ["meeting_external", "Reunião"]].map(([k, l]) => <button key={k} type="button" onClick={() => setFuType(k)} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: `1.5px solid ${fuType === k ? T.blue : T.stone}`, background: fuType === k ? "rgba(96,165,250,0.10)" : "transparent", color: fuType === k ? T.blue : T.fog, cursor: "pointer", transition: "all 0.15s" }}>{l}</button>)}
              </div>
              <div style={{ marginBottom: 14 }}><label style={LBL}>Observação</label><input style={IS} value={fuNote} onChange={(e) => setFuNote(e.target.value)} placeholder="Lembrete para o follow-up..." /></div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowFollowUpForm(false)} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
                <button type="button" disabled={!fuDate || saving} onClick={async () => { if (!supabase || !id || !accountId || !userId || busyRef.current) return; busyRef.current = true; setSaving(true); try { await supabase.from("clients").update({ next_follow_up_at: new Date(fuDate).toISOString() }).eq("id", id); await supabase.from("contact_interactions").insert({ account_id: accountId, client_id: id, type: "follow_up_scheduled", title: `Follow-up agendado`, description: fuNote.trim() || null, metadata: { scheduled_at: fuDate, follow_up_type: fuType }, performed_by: userId }); if (development?.developmentId) { const fuDateStr = new Date(fuDate).toISOString().slice(0, 10); await supabase.from("activities").insert({ account_id: accountId, development_id: development.developmentId, profile_id: userId, client_id: id, type: fuType, title: `Follow-up: ${client.full_name || client.name}`, activity_date: fuDateStr, start_time: new Date(fuDate).toISOString().slice(11, 16), duration_minutes: 30, status: "scheduled", outcome: fuNote.trim() || null, contact_name: client.full_name || client.name }).then(() => {}, () => {}); } setShowFollowUpForm(false); setFuNote(""); setToast("Follow-up agendado"); load(true); } finally { busyRef.current = false; setSaving(false); } }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: T.blue, color: "#fff", fontSize: 13, fontWeight: 600, cursor: !fuDate || saving ? "not-allowed" : "pointer", opacity: !fuDate || saving ? 0.5 : 1 }}>{saving ? "..." : "Agendar"}</button>
              </div>
            </div>
          )}

          {/* Interaction form */}
          {showInlineInteraction && (
            <div style={{ background: T.carbon, border: `1px solid ${T.sprout}30`, borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: T.fog, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginBottom: 10 }}>TIPO</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                {[["phone_call", "Ligação"], ["whatsapp", "WhatsApp"], ["follow_up", "Follow-up"], ["visit_client", "Visita"], ["meeting_external", "Reunião"], ["email", "Email"], ["note", "Nota"]].map(([k, l]) => <button key={k} type="button" onClick={() => setIntType(k)} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: `1.5px solid ${intType === k ? T.sprout : T.stone}`, background: intType === k ? "rgba(74,222,128,0.08)" : "transparent", color: intType === k ? T.sprout : T.fog, cursor: "pointer", transition: "all 0.15s" }}>{l}</button>)}
              </div>
              <div style={{ marginBottom: 10 }}><label style={LBL}>Título *</label><input style={IS} value={intTitle} onChange={(e) => setIntTitle(e.target.value)} placeholder="Ex: Retorno sobre proposta" autoFocus /></div>
              <div style={{ marginBottom: 14 }}><label style={LBL}>Descrição</label><textarea rows={2} style={{ ...IS, resize: "vertical" }} value={intDesc} onChange={(e) => setIntDesc(e.target.value)} placeholder="O que aconteceu?" /></div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => { setShowInlineInteraction(false); setIntTitle(""); setIntDesc(""); }} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
                <button type="button" disabled={!intTitle.trim() || saving} onClick={async () => { if (!supabase || !id || !accountId || !userId || busyRef.current) return; busyRef.current = true; setSaving(true); try {
                  // 1. Activity espelho (mantido — conta como produção nos relatórios). Performer real (profile_id) e hora (created_at) ficam NO DADO.
                  let activityId: string | undefined;
                  if (development?.developmentId) { try { const { data: act } = await supabase.from("activities").insert({ account_id: accountId, development_id: development.developmentId, profile_id: userId, client_id: id, type: intType, title: intTitle.trim(), activity_date: getTodayDateStringBRT(), duration_minutes: 15, status: "completed", outcome: intDesc.trim() || null, contact_name: client.full_name || client.name }).select("id").single(); activityId = (act as { id: string } | null)?.id; } catch { /* espelho é best-effort */ } }
                  // 2. Interação via REPOSITÓRIO (performed_by = usuário) + vínculo ao espelho (dedupe determinístico) + inicia atendimento se lead NEW + contato real.
                  const { startedService } = await registerContactInteraction({ accountId, clientId: id, type: intType, title: intTitle.trim(), description: intDesc.trim() || null, performedBy: userId, currentQualification: fromLeadQualificationDb(client.qualification_status), activityId });
                  await supabase.from("clients").update({ last_interaction_at: new Date().toISOString() }).eq("id", id);
                  setShowInlineInteraction(false); setIntTitle(""); setIntDesc(""); setShowSuccessHint(true);
                  setToast(startedService ? "Interação registrada — atendimento iniciado ✓" : "Interação registrada");
                  load(true);
                } finally { busyRef.current = false; setSaving(false); } }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: T.sprout, color: "var(--interactive-on-primary)", fontSize: 13, fontWeight: 600, cursor: !intTitle.trim() || saving ? "not-allowed" : "pointer", opacity: !intTitle.trim() || saving ? 0.5 : 1 }}>{saving ? "Salvando..." : "Registrar"}</button>
              </div>
            </div>
          )}

          {/* Simulações ativas do cliente (Lei 2) — entre o registrador e a timeline */}
          {simulations.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 10, color: T.fog, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginBottom: 10 }}>SIMULAÇÕES ({simulations.length})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {simulations.map((sm) => {
                  const brokerName = teamMembers.find((m) => m.userId === sm.brokerId)?.name ?? null;
                  const unitLbl = sm.unitId ? (simUnits[sm.unitId] ?? "unidade") : (sm.propertyName ?? null);
                  const overdue = sm.followUpAt ? new Date(sm.followUpAt) < new Date() : false;
                  return (
                    <div key={sm.id} onClick={() => navigate(simulationRoute(sm.id), { state: { from: `/contatos/${id}`, fromLabel: "Contato" } })}
                      style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: "12px 14px", cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: T.chalk, fontFamily: "var(--font-mono)" }}>{fmtBRL(sm.valorTotal)}</span>
                        {sm.unitId ? <EntityLink entity="unit" id={sm.unitId} style={{ fontSize: 12, color: T.bone }}>{unitLbl}</EntityLink> : (unitLbl ? <span style={{ fontSize: 12, color: T.bone }}>{unitLbl}</span> : null)}
                      </div>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 11, color: T.fog }}>
                        {sm.entradaPercentual != null ? <span>entrada {Math.round(sm.entradaPercentual)}%</span> : null}
                        {sm.parcelasQuantidade ? <span>{sm.parcelasQuantidade}x{sm.parcelasValor ? ` ${fmtBRL(sm.parcelasValor)}` : ""}</span> : null}
                        {brokerName ? <span>{brokerName}</span> : null}
                      </div>
                      {sm.followUpAt ? (
                        <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontFamily: "var(--font-mono)", color: overdue ? "#F87171" : "#7DA7F4", background: overdue ? "rgba(248,113,113,0.1)" : "rgba(125,167,244,0.1)", padding: "3px 8px", borderRadius: 6 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: overdue ? "#F87171" : "#7DA7F4" }} />
                          Follow-up: {formatDateBRT(new Date(sm.followUpAt))} {formatTimeBRT(new Date(sm.followUpAt))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Timeline de interações (merged: contact_interactions + activities) */}
          {(() => {
            // Dedupe determinístico por vínculo (fallback heurístico p/ legado) — função pura.
            const activityItems = filterMirroredActivities(activities, contactInteractions)
              .map((a) => {
                // Performer real vem DO DADO (activities.profile_id); só realmente nulo → "Sistema".
                const perfName = teamMembers.find((m) => m.userId === a.profile_id)?.name ?? null;
                return { id: `act-${a.id}`, type: a.type, direction: null as string | null, title: a.title, description: a.outcome || null, performed_by: a.profile_id, performed_at: a.created_at ?? (a.activity_date + "T12:00:00"), profiles: perfName ? { name: perfName } : null, _source: "activity" as const, _activityId: a.id };
              });
            // Simulação = evento real na história do contato (posição temporal). A
            // SEÇÃO acima é a visão acionável (abrir/editar); aqui só o marco "criada
            // · R$ X" — sobreposição mínima, papéis distintos.
            const simItems = simulationTimelineItems(
              simulations,
              (v) => fmtBRL(v) ?? "—",
              (uid) => teamMembers.find((m) => m.userId === uid)?.name ?? null,
            );
            const mergedTimeline = [
              ...contactInteractions.map((ci) => ({ ...ci, _source: "interaction" as const, _activityId: null as string | null })),
              ...activityItems,
              ...simItems,
            ].sort((a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime());

            if (mergedTimeline.length === 0) return (
              <div style={{ textAlign: "center", padding: "40px 0", color: T.fog, fontSize: 14 }}>Nenhuma interação registrada. Clique em "+ Registrar interação" para começar.</div>
            );
            return (
            <div>
              {mergedTimeline.map((i) => {
                const cfg: Record<string, { icon: string; label: string; bg: string; color: string }> = { phone_call: { icon: "📞", label: "Ligação", bg: "rgba(96,165,250,0.12)", color: "#60A5FA" }, whatsapp: { icon: "💬", label: "WhatsApp", bg: "rgba(74,222,128,0.12)", color: "#4ADE80" }, follow_up: { icon: "🔄", label: "Follow-up", bg: "rgba(167,139,250,0.12)", color: "#A78BFA" }, visit_client: { icon: "🏠", label: "Visita", bg: "rgba(251,191,36,0.12)", color: "#FBBF24" }, meeting_external: { icon: "👥", label: "Reunião", bg: "rgba(251,191,36,0.12)", color: "#FBBF24" }, email: { icon: "✉", label: "Email", bg: "rgba(96,165,250,0.12)", color: "#60A5FA" }, note: { icon: "📝", label: "Nota", bg: "rgba(156,150,134,0.12)", color: "#9C9686" }, status_change: { icon: "→", label: "Status", bg: "rgba(74,222,128,0.12)", color: "#4ADE80" }, assignment_change: { icon: "👤", label: "Reatribuição", bg: "rgba(167,139,250,0.12)", color: "#A78BFA" } };
                const tc = cfg[i.type] || { icon: "●", label: i.type, bg: T.stone, color: T.fog };
                const profile = Array.isArray(i.profiles) ? i.profiles[0] : i.profiles;
                const isFromActivity = i._source === "activity";
                const isAuto = !isFromActivity && (i.type === "status_change" || i.type === "assignment_change");
                const isEditing = !isFromActivity && editingInt?.id === i.id;
                return (
                  <div key={i.id} style={{ display: "flex", gap: 12, padding: "14px 0", borderBottom: `1px solid ${T.stone}` }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: tc.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14 }}>{tc.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isEditing ? (
                        <div>
                          <input autoFocus value={editingInt!.title} onChange={(e) => setEditingInt((p) => p ? { ...p, title: e.target.value } : null)} placeholder="Título" style={{ ...IS, marginBottom: 6 }} />
                          <textarea value={editingInt!.description} onChange={(e) => setEditingInt((p) => p ? { ...p, description: e.target.value } : null)} rows={2} placeholder="Descrição" style={{ ...IS, resize: "vertical", marginBottom: 8 }} />
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                            <button type="button" onClick={() => setEditingInt(null)} style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 12, cursor: "pointer" }}>Cancelar</button>
                            <button type="button" onClick={handleSaveEditInteraction} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: T.sprout, color: "#12110F", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Salvar</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: T.chalk }}>{i.title || tc.label}</span>
                                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: tc.bg, color: tc.color, fontWeight: 500 }}>{tc.label}</span>
                              </div>
                              {i.description && <p style={{ fontSize: 13, color: T.bone, margin: "4px 0 0", lineHeight: 1.5 }}>{i.description}</p>}
                              <div style={{ fontSize: 11, color: T.slate, marginTop: 4 }}>{formatDateBRT(i.performed_at)} às {formatTimeBRT(i.performed_at)} · {(profile as Record<string, unknown> | null)?.name as string || "Sistema"}</div>
                            </div>
                            {!isAuto && canEditItem(i.performed_by) && (
                              <div style={{ position: "relative", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                                <button type="button" onClick={(e) => { e.stopPropagation(); setActiveIntMenu(activeIntMenu === i.id ? null : i.id); }} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 8px", color: T.slate, borderRadius: 4, fontSize: 18, lineHeight: 1 }} title="Opções">⋮</button>
                                {activeIntMenu === i.id && (
                                  <div style={{ position: "absolute", right: 0, top: "100%", zIndex: 100, background: "var(--surface-elevated, #1C1B18)", borderRadius: 8, border: `1px solid ${T.stone}`, boxShadow: "0 4px 12px rgba(0,0,0,0.4)", minWidth: 140, padding: "4px 0", marginTop: 4 }}>
                                    {!isFromActivity && <button type="button" onClick={() => { setEditingInt({ id: i.id, title: i.title || "", description: i.description || "" }); setActiveIntMenu(null); }} style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", color: T.chalk, fontSize: 13 }}>Editar</button>}
                                    <button type="button" onClick={() => { setActiveIntMenu(null); const label = isFromActivity ? "esta atividade" : "esta interação"; setConfirmDialog({ title: "Excluir " + (isFromActivity ? "atividade" : "interação"), message: `Tem certeza que deseja excluir ${label}? Esta ação não pode ser desfeita.`, variant: "danger", onConfirm: async () => { setConfirmDialog(null); if (!supabase) return; if (isFromActivity && i._activityId) { await supabase.from("activities").delete().eq("id", i._activityId); } else { await supabase.from("contact_interactions").delete().eq("id", i.id); } setToast("Excluído"); load(true); } }); }} style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", color: "#E24B4A", fontSize: 13 }}>Excluir</button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            );
          })()}
        </div>
      )}

      {/* Tab: Dados */}
      {tab === "dados" && (
        <div style={{ display: "grid", gridTemplateColumns: fluidGrid(230), gap: 14 }}>
          <div style={{ gridColumn: "span 2" }}><label style={LBL}>Nome completo</label>{editing ? <input style={IS} value={f("full_name") || f("name")} onChange={(e) => setF("full_name", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.full_name || client.name || "—"}</div>}</div>
          <div><label style={LBL}>CPF</label>{editing ? <input style={IS} value={maskCPF(f("cpf"))} onChange={(e) => setF("cpf", e.target.value.replace(/\D/g, "").slice(0, 11))} maxLength={14} /> : <SensitiveField label="CPF" maskedValue={secureMaskCPF(client.cpf)} fullValue={client.cpf ? maskCPF(client.cpf) : ""} entityType="client" entityId={client.id} field="cpf" />}</div>
          <div><label style={LBL}>RG</label>{editing ? <input style={IS} value={maskRG(f("rg"))} onChange={(e) => setF("rg", maskRG(e.target.value))} maxLength={12} /> : <SensitiveField label="RG" maskedValue={secureMaskRG(client.rg)} fullValue={client.rg || ""} entityType="client" entityId={client.id} field="rg" />}</div>
          <div><label style={LBL}>Órgão emissor</label>{editing ? <input style={IS} value={f("rg_orgao")} onChange={(e) => setF("rg_orgao", e.target.value)} placeholder="SSP/PR" /> : <div style={{ fontSize: 14, color: T.bone }}>{client.rg_orgao || "—"}</div>}</div>
          <div><label style={LBL}>Data nascimento</label>{editing ? <input type="date" style={IS} value={f("data_nascimento")} onChange={(e) => setF("data_nascimento", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.data_nascimento ? formatDateBRT(client.data_nascimento + "T12:00:00") : "—"}</div>}</div>
          <div><label style={LBL}>Estado civil</label>{editing ? <NexaSelect value={f("marital_status")} onChange={(v) => setF("marital_status", v)} placeholder="Selecione" ariaLabel="Estado civil" options={ESTADO_CIVIL_OPTS.map((o) => ({ value: o.v, label: o.l }))} /> : <div style={{ fontSize: 14, color: T.bone }}>{ESTADO_CIVIL_OPTS.find((o) => o.v === client.marital_status)?.l || client.marital_status || "—"}</div>}</div>
          <div><label style={LBL}>Profissão</label>{editing ? <input style={IS} value={f("profession")} onChange={(e) => setF("profession", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.profession || "—"}</div>}</div>
          <div><label style={LBL}>Renda mensal</label>{editing ? <input style={IS} value={f("renda_mensal") ? maskCurrency(String(Math.round(Number(f("renda_mensal")) * 100))) : ""} onChange={(e) => setF("renda_mensal", String(currencyToNumber(e.target.value)))} placeholder="R$ 0,00" /> : <SensitiveField label="Renda" maskedValue={secureMaskRenda(client.renda_mensal)} fullValue={client.renda_mensal ? fmtBRL(client.renda_mensal) : ""} entityType="client" entityId={client.id} field="renda_mensal" />}</div>
          <div><label style={LBL}>Telefone</label>{editing ? <input style={IS} value={maskPhone(f("phone"))} onChange={(e) => setF("phone", e.target.value.replace(/\D/g, "").slice(0, 11))} maxLength={15} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.phone ? maskPhone(client.phone) : "—"}</div>}</div>
          <div><label style={LBL}>Email</label>{editing ? <input type="email" style={IS} value={f("email")} onChange={(e) => setF("email", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.email || "—"}</div>}</div>
          <div style={{ gridColumn: "1 / -1" }}><label style={LBL}>Observações</label>{editing ? <textarea rows={2} style={{ ...IS, resize: "vertical" }} value={f("observations")} onChange={(e) => setF("observations", e.target.value)} /> : <div style={{ fontSize: 13, color: T.fog }}>{client.observations || "—"}</div>}</div>
          <div><label style={LBL}>Origem</label>{editing ? <NexaSelect value={(form.origin as string) ?? client.origin ?? ""} onChange={(v) => setForm((p) => ({ ...p, origin: v }))} placeholder="Selecione" ariaLabel="Origem" options={Object.entries(SOURCE_LABELS).map(([k, l]) => ({ value: k, label: l }))} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.origin ? (SOURCE_LABELS[client.origin] ?? client.origin) : "—"}</div>}</div>
          <div><label style={LBL}>Detalhe da origem</label>{editing ? <input style={IS} value={(form.origin_detail as string) ?? client.origin_detail ?? ""} onChange={(e) => setForm((p) => ({ ...p, origin_detail: e.target.value }))} placeholder="Campanha, corretor, etc." /> : <div style={{ fontSize: 14, color: T.bone }}>{client.origin_detail || "—"}</div>}</div>
        </div>
      )}

      {/* Tab: Interesse */}
      {tab === "interesse" && (
        <div style={{ display: "grid", gridTemplateColumns: fluidGrid(230), gap: 14 }}>
          <div><label style={LBL}>Perfil de comprador</label>{editing ? <NexaSelect value={(form.buyer_profile as string) ?? client.buyer_profile ?? ""} onChange={(v) => setForm((p) => ({ ...p, buyer_profile: v }))} placeholder="Selecione" ariaLabel="Perfil de comprador" options={[{ value: "investor", label: "Investidor" }, { value: "resident", label: "Morador" }, { value: "both", label: "Ambos" }]} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.buyer_profile === "investor" ? "Investidor" : client.buyer_profile === "resident" ? "Morador" : client.buyer_profile === "both" ? "Ambos" : "—"}</div>}</div>
          <div><label style={LBL}>Tipo de imóvel</label>{editing ? <NexaSelect value={(form.interested_unit_type as string) ?? client.interested_unit_type ?? ""} onChange={(v) => setForm((p) => ({ ...p, interested_unit_type: v }))} placeholder="Selecione" ariaLabel="Tipo de imóvel" options={[{ value: "lote", label: "Lote" }, { value: "casa", label: "Casa" }, { value: "apartamento", label: "Apartamento" }, { value: "comercial", label: "Comercial" }]} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.interested_unit_type || "—"}</div>}</div>
          <div><label style={LBL}>Prazo de compra</label>{editing ? <NexaSelect value={(form.purchase_timeline as string) ?? client.purchase_timeline ?? ""} onChange={(v) => setForm((p) => ({ ...p, purchase_timeline: v }))} placeholder="Selecione" ariaLabel="Prazo de compra" options={[{ value: "immediate", label: "Imediato" }, { value: "1_to_3_months", label: "1-3 meses" }, { value: "3_to_6_months", label: "3-6 meses" }, { value: "6_to_12_months", label: "6-12 meses" }, { value: "over_12_months", label: "+12 meses" }]} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.purchase_timeline || "—"}</div>}</div>
          <div><label style={LBL}>Budget mínimo</label>{editing ? <input type="number" style={IS} value={String((form as Record<string, unknown>).budget_min ?? client.budget_min ?? "")} onChange={(e) => setForm((p) => ({ ...p, budget_min: Number(e.target.value) || null } as Partial<ClientData>))} placeholder="0" /> : <div style={{ fontSize: 14, color: T.bone }}>{client.budget_min ? fmtBRL(client.budget_min) : "—"}</div>}</div>
          <div><label style={LBL}>Budget máximo</label>{editing ? <input type="number" style={IS} value={String((form as Record<string, unknown>).budget_max ?? client.budget_max ?? "")} onChange={(e) => setForm((p) => ({ ...p, budget_max: Number(e.target.value) || null } as Partial<ClientData>))} placeholder="0" /> : <div style={{ fontSize: 14, color: T.bone }}>{client.budget_max ? fmtBRL(client.budget_max) : "—"}</div>}</div>
          <div><label style={LBL}>Preferência pagamento</label>{editing ? <NexaSelect value={(form.payment_preference as string) ?? client.payment_preference ?? ""} onChange={(v) => setForm((p) => ({ ...p, payment_preference: v }))} placeholder="Selecione" ariaLabel="Preferência de pagamento" options={[{ value: "cash", label: "À vista" }, { value: "installment", label: "Parcelado" }, { value: "financing", label: "Financiamento" }, { value: "fgts", label: "FGTS" }]} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.payment_preference || "—"}</div>}</div>
        </div>
      )}

      {/* Tab: Endereço */}
      {tab === "endereco" && (
        <div style={{ display: "grid", gridTemplateColumns: fluidGrid(230), gap: 14 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><label style={LBL}>CEP</label>{editing ? <input style={IS} value={maskCEP(f("cep"))} onChange={(e) => { const masked = maskCEP(e.target.value); setF("cep", masked.replace(/\D/g, "")); if (masked.replace(/\D/g, "").length === 8) buscarCep(); }} maxLength={9} placeholder="00000-000" /> : <div style={{ fontSize: 14, color: T.bone }}>{client.cep ? maskCEP(client.cep) : "—"}</div>}</div>
            {editing && <button type="button" onClick={buscarCep} style={{ alignSelf: "flex-end", padding: "10px 14px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 12, cursor: "pointer", marginBottom: 0 }}>🔍</button>}
          </div>
          <div style={{ gridColumn: "span 2" }}><label style={LBL}>Endereço</label>{editing ? <input style={IS} value={f("endereco")} onChange={(e) => setF("endereco", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.endereco || "—"}</div>}</div>
          <div><label style={LBL}>Número</label>{editing ? <input style={IS} value={f("numero")} onChange={(e) => setF("numero", e.target.value.slice(0, 10))} maxLength={10} placeholder="123 ou S/N" /> : <div style={{ fontSize: 14, color: T.bone }}>{client.numero || "—"}</div>}</div>
          <div><label style={LBL}>Complemento</label>{editing ? <input style={IS} value={f("complemento")} onChange={(e) => setF("complemento", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.complemento || "—"}</div>}</div>
          <div><label style={LBL}>Bairro</label>{editing ? <input style={IS} value={f("bairro")} onChange={(e) => setF("bairro", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.bairro || "—"}</div>}</div>
          <div><label style={LBL}>Cidade</label>{editing ? <input style={IS} value={f("city")} onChange={(e) => setF("city", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.city || "—"}</div>}</div>
          <div><label style={LBL}>UF</label>{editing ? <NexaSelect value={f("uf")} onChange={(v) => setF("uf", v)} placeholder="—" ariaLabel="UF" options={UF_OPTS.map((u) => ({ value: u, label: u }))} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.uf || "—"}</div>}</div>
        </div>
      )}

      {/* Tab: Documentos */}
      {tab === "documentos" && (
        <div>
          {/* Progress bar + approve all */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: T.fog }}>Progresso da documentação</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: docApproved === effectiveDocTypes.length ? T.sprout : T.bone, fontWeight: 600 }}>{docApproved}/{effectiveDocTypes.length} aprovados</span>
                {hasUploadedToApprove && <button type="button" onClick={approveAllDocs} disabled={approvingAll} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid rgba(74,222,128,0.3)", background: "rgba(74,222,128,0.08)", color: T.sprout, fontSize: 11, fontWeight: 600, cursor: approvingAll ? "wait" : "pointer", opacity: approvingAll ? 0.7 : 1 }}>{approvingAll ? "Aprovando..." : `Aprovar todos (${docUploaded})`}</button>}
                {docApproved > 0 && !["broker", "concierge"].includes((account?.role as string) ?? "") && (
                  <button type="button" onClick={downloadClientPackage} disabled={downloadingZip} title={allRequiredApproved ? "Baixar todos os documentos aprovados em ZIP" : "Aprove todos os documentos obrigatórios primeiro"} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 6, border: `1px solid ${allRequiredApproved ? "rgba(74,222,128,0.3)" : T.stone}`, background: "transparent", color: allRequiredApproved ? T.sprout : T.fog, fontSize: 11, fontWeight: 500, cursor: downloadingZip ? "wait" : "pointer", opacity: allRequiredApproved ? 1 : 0.5 }}>
                    {downloadingZip ? <><span style={{ width: 12, height: 12, border: "2px solid rgba(74,222,128,0.3)", borderTopColor: "#4ADE80", borderRadius: "50%", animation: "nxSpin 0.8s linear infinite", display: "inline-block" }} /> Gerando...</> : <><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v8m0 0l-3-3m3 3l3-3M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1"/></svg> Baixar pacote</>}
                  </button>
                )}
              </div>
            </div>
            {/* Multi-segment progress bar */}
            <div style={{ height: 6, borderRadius: 100, background: T.stone, overflow: "hidden", display: "flex" }}>
              {docApproved > 0 && <div style={{ height: "100%", width: `${Math.round((docApproved / effectiveDocTypes.length) * 100)}%`, background: T.sprout, transition: "width 0.4s ease" }} />}
              {docUploaded > 0 && <div style={{ height: "100%", width: `${Math.round((docUploaded / effectiveDocTypes.length) * 100)}%`, background: T.blue, transition: "width 0.4s ease" }} />}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              {[
                docPending > 0 && <span key="p" style={{ fontSize: 11, color: T.slate }}>○ {docPending} pendente{docPending > 1 ? "s" : ""}</span>,
                docUploaded > 0 && <span key="s" style={{ fontSize: 11, color: T.blue }}>↑ {docUploaded} enviado{docUploaded > 1 ? "s" : ""}</span>,
                docApproved > 0 && <span key="a" style={{ fontSize: 11, color: T.sprout }}>✓ {docApproved} aprovado{docApproved > 1 ? "s" : ""}</span>,
                docRejected > 0 && <span key="r" style={{ fontSize: 11, color: "#D97706" }}>✕ {docRejected} rejeitado{docRejected > 1 ? "s" : ""}</span>,
              ].filter(Boolean)}
            </div>
          </div>

          {/* Document cards — v7 gradient */}
          <div style={{ display: "grid", gap: 10 }}>
            {effectiveDocTypes.map((dt) => {
              const doc = docsByType[dt.key];
              const statusCfg: Record<string, { bg: string; color: string; text: string }> = {
                approved: { bg: "rgba(74,222,128,0.15)", color: "#4ADE80", text: "Aprovado" },
                rejected: { bg: "rgba(217,119,6,0.15)", color: "#D97706", text: "Rejeitado" },
                uploaded: { bg: "rgba(96,165,250,0.15)", color: "#60A5FA", text: "Enviado" },
                sent: { bg: "rgba(96,165,250,0.15)", color: "#60A5FA", text: "Enviado" },
              };
              const st = doc ? (statusCfg[doc.status] || { bg: "rgba(156,150,134,0.15)", color: "#9C9686", text: "Pendente" }) : { bg: "rgba(156,150,134,0.15)", color: "#9C9686", text: "Pendente" };
              const fileSize = doc?.file_size_bytes || doc?.file_size;
              const isUploading = uploadingDocType === dt.key;
              return (
                <div key={dt.key} style={{ position: "relative", background: "linear-gradient(145deg, var(--surface-raised), var(--surface-base))", border: `1px solid ${doc?.status === "approved" ? "rgba(74,222,128,0.2)" : doc?.status === "rejected" ? "rgba(217,119,6,0.2)" : T.stone}`, borderRadius: 12, padding: isMobile ? "14px 12px" : "16px 18px", transition: "border-color 0.2s, opacity 0.2s", overflow: "hidden" }}>
                  {isUploading && <div style={{ position: "absolute", inset: 0, borderRadius: 12, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}><div style={{ width: 24, height: 24, border: "2px solid rgba(74,222,128,0.3)", borderTopColor: "#4ADE80", borderRadius: "50%", animation: "nxSpin 0.8s linear infinite" }} /></div>}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: doc ? 10 : 0 }}>
                    {/* Status badge */}
                    <span style={{ padding: "3px 10px", borderRadius: 100, background: st.bg, color: st.color, fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" }}>{st.text}</span>
                    {/* Doc name */}
                    <span style={{ fontSize: 13, color: T.bone, fontWeight: 500, flex: 1 }}>{dt.label}</span>
                    {/* Required pill */}
                    {dt.required && <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: "rgba(156,150,134,0.1)", color: T.fog, fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>Obrigatório</span>}
                  </div>

                  {/* Status: pending — upload button */}
                  {(!doc || doc.status === "pending") && (
                    <button type="button" onClick={() => { setUploadingDocType(dt.key); setTimeout(() => fileRef.current?.click(), 50); }} style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: `1px dashed ${T.stone}`, background: "transparent", color: T.fog, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44 }}>{isUploading ? "Enviando..." : "⊕ Enviar arquivo"}</button>
                  )}

                  {/* Status: uploaded/sent — file info + actions */}
                  {doc && (doc.status === "uploaded" || doc.status === "sent") && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 16 }}>{doc.mime_type?.startsWith("image/") ? "🖼" : "📄"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: T.bone, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.file_name}</div>
                        {fileSize ? <div style={{ fontSize: 10, color: T.slate }}>{fmtFileSize(fileSize)}</div> : null}
                      </div>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        {canRemoveDoc(doc) && <button type="button" onClick={() => setConfirmDialog({ title: "Remover arquivo", message: "Você poderá enviar outro documento após a remoção.", variant: "default", onConfirm: () => { removeDocument(doc.id, doc.storage_path); setConfirmDialog(null); } })} title="Remover arquivo" style={{ minWidth: 36, height: 36, borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.slate, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>}
                        <button type="button" onClick={() => window.open(doc.file_url, "_blank")} title="Visualizar" style={{ minWidth: 36, height: 36, borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>↗</button>
                        {canReview && (
                          <>
                            <button type="button" onClick={() => reviewDoc(doc.id, "approved")} title="Aprovar" style={{ minWidth: 36, height: 36, borderRadius: 8, border: "1px solid rgba(74,222,128,0.3)", background: "rgba(74,222,128,0.08)", color: T.sprout, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✓</button>
                            <button type="button" onClick={() => { setRejectTarget(doc); setRejectReason(""); }} title="Reprovar" style={{ minWidth: 36, height: 36, borderRadius: 8, border: "1px solid rgba(217,119,6,0.3)", background: "rgba(217,119,6,0.08)", color: "#D97706", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Status: approved — file info */}
                  {doc && doc.status === "approved" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{doc.mime_type?.startsWith("image/") ? "🖼" : "📄"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: T.bone, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.file_name}</div>
                        {fileSize ? <div style={{ fontSize: 10, color: T.slate }}>{fmtFileSize(fileSize)}</div> : null}
                      </div>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {["owner", "director"].includes((account?.role as string) ?? "") && <button type="button" onClick={() => setConfirmDialog({ title: "Remover documento aprovado", message: "Este documento já foi aprovado. Tem certeza que deseja remover? O documento voltará ao estado pendente.", variant: "danger", onConfirm: () => { removeDocument(doc.id, doc.storage_path); setConfirmDialog(null); } })} title="Remover (admin)" style={{ minWidth: 36, height: 36, borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.slate, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.5 }}><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>}
                        <button type="button" onClick={() => window.open(doc.file_url, "_blank")} title="Visualizar" style={{ minWidth: 36, height: 36, borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>↗</button>
                        <span style={{ fontSize: 11, color: T.sprout, fontWeight: 600, padding: "4px 8px" }}>✓ Aprovado</span>
                      </div>
                    </div>
                  )}

                  {/* Status: rejected — file info + reason + re-upload */}
                  {doc && doc.status === "rejected" && (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 16 }}>📄</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: T.bone, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.file_name}</div>
                        </div>
                        <button type="button" onClick={() => window.open(doc.file_url, "_blank")} title="Visualizar" style={{ minWidth: 36, height: 36, borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>↗</button>
                      </div>
                      {doc.rejection_reason && <div style={{ fontSize: 11, color: "#D97706", padding: "6px 10px", background: "rgba(217,119,6,0.06)", borderRadius: 6, marginBottom: 8 }}>Motivo: {doc.rejection_reason}</div>}
                      <button type="button" onClick={() => { setUploadingDocType(dt.key); setTimeout(() => fileRef.current?.click(), 50); }} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.bone, fontSize: 12, cursor: "pointer", minHeight: 44 }}>{isUploading ? "Enviando..." : "↻ Reenviar"}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file && uploadingDocType) { uploadDocument(file, uploadingDocType); } else { setUploadingDocType(null); } e.target.value = ""; }} onBlur={() => setTimeout(() => setUploadingDocType(null), 300)} />

          {/* Rejection modal */}
          {rejectTarget && createPortal(
            <div style={{ position: "fixed", inset: 0, zIndex: 9000 }}>
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} onClick={() => setRejectTarget(null)} />
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "linear-gradient(145deg, var(--surface-raised), var(--surface-base))", border: `1px solid ${T.stone}`, borderRadius: 14, padding: 24, width: 420, maxWidth: "90vw", zIndex: 1 }}>
                <p style={{ fontSize: 15, color: T.bone, fontWeight: 600, marginBottom: 4 }}>Reprovar documento</p>
                <p style={{ fontSize: 13, color: T.fog, marginBottom: 16 }}>{effectiveDocTypes.find((d) => d.key === rejectTarget.document_type)?.label || rejectTarget.document_type}</p>
                <label style={{ fontSize: 10, color: T.fog, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Motivo da reprovação *</label>
                <textarea autoFocus value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Ex: Documento ilegível, data vencida..." rows={3} style={{ width: "100%", marginTop: 6, background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 8, padding: "10px 12px", color: T.chalk, fontSize: 14, resize: "none", outline: "none", boxSizing: "border-box" }} />
                <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setRejectTarget(null)} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
                  <button type="button" disabled={!rejectReason.trim()} onClick={() => { reviewDoc(rejectTarget.id, "rejected", rejectReason.trim()); setRejectTarget(null); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#D97706", color: "#fff", fontSize: 13, fontWeight: 600, cursor: rejectReason.trim() ? "pointer" : "not-allowed", opacity: rejectReason.trim() ? 1 : 0.5 }}>Confirmar reprovação</button>
                </div>
              </div>
            </div>, document.body
          )}
        </div>
      )}

      {/* Tab: Histórico — unified timeline */}
      {tab === "historico" && (() => {
        // Build unified timeline
        type TItem = { id: string; type: string; date: string; title: string; desc: string; badge: string; badgeColor: string; linkTo?: string };
        const timeline: TItem[] = [];
        for (const a of activities) {
          const typeColor: Record<string, string> = { phone_call: "#4ADE80", follow_up: "#60A5FA", visit_client: "#FBBF24", visit_broker: "#4ADE80", visit_development: "#FBBF24", meeting_internal: "#A78BFA", meeting_external: "#A78BFA", training: "#10B981", other: "#8A8985" };
          timeline.push({ id: a.id, type: "activity", date: a.activity_date, title: a.title, desc: a.outcome || "", badge: TYPE_LABELS[a.type] || a.type, badgeColor: typeColor[a.type] || T.fog });
        }
        for (const n of negotiations) {
          timeline.push({ id: n.id, type: "negotiation", date: n.updated_at, title: `Negociação — Q${n.unit_quadra}/L${n.unit_lote}`, desc: `${fmtBRL(n.unit_valor)} · ${n.broker_name || "—"}`, badge: getNegotiationStatusLabel(n.status.toUpperCase() as never), badgeColor: "#60A5FA", linkTo: `/negociacoes/${n.id}` });
        }
        // Registration event
        timeline.push({ id: "reg", type: "registration", date: client.created_at, title: "Cliente cadastrado", desc: "", badge: "CADASTRO", badgeColor: "#A78BFA" });
        timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Group by date label
        const groups: [string, TItem[]][] = [];
        let lastLabel = "";
        for (const item of timeline) {
          const d = new Date(item.date.length === 10 ? item.date + "T12:00:00" : item.date);
          const label = formatDateLongBRT(d);
          if (label !== lastLabel) { groups.push([label, []]); lastLabel = label; }
          groups[groups.length - 1][1].push(item);
        }

        return (
          <div>
            {timeline.length <= 1 && <div style={{ fontSize: 13, color: T.fog, marginBottom: 16 }}>Nenhuma interação registrada ainda.</div>}
            {groups.map(([dateLabel, items]) => (
              <div key={dateLabel} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: T.slate, fontFamily: "var(--font-mono)", letterSpacing: "0.05em", marginBottom: 10 }}>{dateLabel.toUpperCase()}</div>
                {items.map((item, i) => (
                  <div key={item.id} style={{ display: "flex", gap: 12, marginBottom: i < items.length - 1 ? 0 : 8 }}>
                    {/* Dot + connector line */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: item.badgeColor + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.badgeColor }} />
                      </div>
                      {i < items.length - 1 && <div style={{ width: 1, flex: 1, minHeight: 16, background: T.stone, marginTop: 4 }} />}
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1, paddingBottom: 16, cursor: item.linkTo ? "pointer" : "default" }} onClick={() => item.linkTo && navigate(item.linkTo)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: item.badgeColor + "18", color: item.badgeColor }}>{item.badge}</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: T.bone }}>{item.title}</span>
                      </div>
                      {item.desc && <div style={{ fontSize: 12, color: T.fog, marginTop: 4 }}>{item.desc}</div>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Actions section */}
      <div style={{ display: "flex", gap: 8, marginTop: 24, flexWrap: "wrap" }}>
        {client.status !== "lost" && client.status !== "inactive" && client.status !== "converted" && (
          <button type="button" disabled={saving} onClick={async () => {
            if (!supabase || !id || !accountId || saving) return;
            const hasActive = negotiations.some((n) => isNegotiationActive(n.status));
            if (hasActive) { setShowLostModal(true); return; }
            setConfirmDialog({ title: "Arquivar contato", message: "O contato permanecerá na base para futuras abordagens.", variant: "default", onConfirm: async () => {
              setConfirmDialog(null); setSaving(true);
              try {
                await supabase!.from("clients").update({ status: "inactive", updated_at: new Date().toISOString() }).eq("id", id!);
                setClient((p) => p ? { ...p, status: "inactive" } : null);
                setToast("Contato arquivado"); load(true);
              } finally { setSaving(false); }
            } });
          }} style={{ padding: "10px 18px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 13, cursor: "pointer" }}>Arquivar contato</button>
        )}
        {(client.status === "lost" || client.status === "inactive") && (
          <button type="button" onClick={async () => { if (!supabase || !id || saving) return; setSaving(true); try { await supabase.from("clients").update({ status: "contacted", lost_at: null, lost_reason: null, lost_reason_detail: null, reactivated_at: new Date().toISOString(), reactivation_count: (client.reactivation_count ?? 0) + 1 }).eq("id", id); setClient((p) => p ? { ...p, status: "contacted", lost_at: null, lost_reason: null, reactivation_count: (p.reactivation_count ?? 0) + 1 } : null); setToast("Contato reativado"); load(true); } finally { setSaving(false); } }} disabled={saving} style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid rgba(74,222,128,0.3)", background: "rgba(74,222,128,0.06)", color: T.sprout, fontSize: 13, cursor: "pointer" }}>Reativar contato</button>
        )}
        {(() => {
          const activeNeg = negotiations.find((n) => isNegotiationActive(n.status));
          if (activeNeg) {
            return <button type="button" onClick={() => navigate(`/negociacoes/${activeNeg.id}`)} style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid rgba(74,222,128,0.3)", background: "rgba(74,222,128,0.06)", color: T.sprout, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Ver negociação ativa →</button>;
          }
          if (negotiations.length > 0) {
            return <button type="button" onClick={() => navigate(`/negociacoes/${negotiations[0].id}`)} style={{ padding: "10px 18px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 13, cursor: "pointer" }}>Ver última negociação</button>;
          }
          if (["contacted", "qualifying", "qualified", "nurturing"].includes(client.status || "")) {
            return <button type="button" onClick={() => { setConvDevId(devList.length === 1 ? devList[0].id : ""); setConvNote(""); setShowConvertModal(true); }} style={{ padding: "10px 18px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.bone, fontSize: 13, cursor: "pointer" }}>Converter em negociação</button>;
          }
          return null;
        })()}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${T.stone}`, fontSize: 11, color: T.slate }}>
        Contato cadastrado em {formatDateBRT(client.created_at)}
        {client.last_interaction_at && ` · Último contato: ${timeAgo(client.last_interaction_at)}`}
      </div>

      {/* Activity modal */}
      {activityModalOpen && accountId && development?.developmentId && userId && client && (
        <QuickActivityModal clientId={client.id} clientName={client.full_name || client.name} accountId={accountId} developmentId={development.developmentId} profileId={userId} onClose={() => setActivityModalOpen(false)} onSaved={() => { setToast("Atendimento registrado"); load(true); }} />
      )}

      {/* Engrenagem de Partes v1 — modal para vincular/cadastrar cônjuge */}
      {client ? (
        <SpouseLinkModal
          open={showSpouseModal}
          clientId={client.id}
          clientName={client.full_name || client.name}
          clientRegimeCasamento={(client.regime_casamento as LegalRegime | null) ?? null}
          onClose={() => setShowSpouseModal(false)}
          onLinked={async () => {
            setShowSpouseModal(false);
            setToast("Cônjuge vinculado");
            await load(true);
          }}
        />
      ) : null}

      {/* Engrenagem de Cônjuge v2 — confirmação de desvínculo */}
      {spouse && (
        <ConfirmacaoDestructiva
          open={showUnlinkConfirm}
          titulo="Remover vínculo de cônjuge?"
          descricao={`Os cadastros de ${client.full_name || client.name} e ${spouse.fullName || spouse.name} permanecerão. Apenas o vínculo de cônjuge será removido.`}
          labelConfirmar="Remover vínculo"
          onConfirmar={async () => {
            try {
              await unlinkSpouses(client.id);
              setShowUnlinkConfirm(false);
              setToast("Vínculo de cônjuge removido");
              await load(true);
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Erro ao desvincular";
              setToast(msg);
            }
          }}
          onCancelar={() => setShowUnlinkConfirm(false)}
        />
      )}

      {/* Engrenagem de Cônjuge v2 (Sprint A.1) — drawer peek */}
      {spouse && client && (
        <SpousePeek
          open={showSpousePeek}
          principalClient={client}
          spouseId={spouse.id}
          onClose={() => setShowSpousePeek(false)}
        />
      )}

      {/* Lost modal */}
      <LostReasonModal
        isOpen={showLostModal}
        onClose={() => setShowLostModal(false)}
        showCascadeOption
        entityLabel="contato"
        onConfirm={async ({ reason, detail, cascadeToNegotiations }) => {
          if (!supabase || !id) return;
          const nowIso = new Date().toISOString();
          await supabase.from("clients").update({
            status: "inactive",
            lost_at: nowIso,
            lost_reason: reason,
            lost_reason_detail: detail || null,
          }).eq("id", id);
          setClient((p) => p ? { ...p, status: "inactive", lost_at: nowIso, lost_reason: reason } : null);
          // Cascade: mark active negotiations as LOST (regra + escrita no repositório;
          // Etapa 5c). Erro na cascata não aborta o arquivamento — só loga, como antes.
          if (cascadeToNegotiations && accountId) {
            try {
              await markClientActiveNegotiationsLost(id, accountId, reason);
            } catch (e) {
              console.error("Erro ao cascatear negociações:", e);
            }
          }
          setToast("Contato arquivado" + (cascadeToNegotiations ? " e negociações marcadas como perdidas" : ""));
          load(true);
        }}
      />

      {/* Convert modal */}
      {showConvertModal && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 9000 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} onClick={() => setShowConvertModal(false)} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 14, padding: 28, width: 440, maxWidth: "90vw", zIndex: 1 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.chalk, margin: "0 0 16px" }}>Converter em negociação</h3>
            <div style={{ fontSize: 13, color: T.fog, marginBottom: 16, padding: "8px 12px", background: T.ink, borderRadius: 8, border: `1px solid ${T.stone}` }}>Contato: <strong style={{ color: T.bone }}>{client.full_name || client.name}</strong></div>
            <label style={LBL}>Empreendimento *</label>
            <div style={{ marginBottom: 14 }}>
              <NexaSelect value={convDevId} onChange={(v) => setConvDevId(v)} placeholder="Selecione..." ariaLabel="Empreendimento" options={devList.map((d) => ({ value: d.id, label: d.name }))} />
            </div>
            <label style={LBL}>Observações</label>
            <textarea rows={2} style={{ ...IS, resize: "vertical", marginBottom: 16 }} value={convNote} onChange={(e) => setConvNote(e.target.value)} placeholder="Observações sobre a negociação..." />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setShowConvertModal(false)} style={{ padding: "10px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button type="button" disabled={!convDevId || saving} onClick={async () => {
                if (!supabase || !id || !accountId || !userId || !convDevId) return;
                setSaving(true);
                try {
                  // Check for existing active negotiation
                  const { data: existing } = await supabase.from("negotiations").select("id").eq("client_id", id).not("status", "in", '("LOST","CANCELLED","WON")').limit(1).maybeSingle();
                  if (existing) {
                    setShowConvertModal(false);
                    setToast("Este contato já possui uma negociação ativa");
                    navigate(`/negociacoes/${existing.id}`);
                    return;
                  }
                  const assignedTo = client.assigned_to as string | null;
                  // Escrita da negociação via repositório (Etapa 5c). clients e
                  // contact_interactions ficam inline (tabelas fora do fluxo comercial).
                  const negId = await createNegotiationFromClient({
                    accountId, developmentId: convDevId, clientId: id,
                    brokerId: assignedTo || null, ownerProfileId: userId,
                    origem: client.origin || "manual", notes: convNote.trim() || null,
                  });
                  if (negId) {
                    await supabase.from("clients").update({ status: "negotiating", converted_at: new Date().toISOString(), converted_to: "negotiation", converted_negotiation_id: negId }).eq("id", id);
                    await supabase.from("contact_interactions").insert({ account_id: accountId, client_id: id, type: "status_change", title: "Convertido em negociação", metadata: { from: client.status, to: "negotiating", negotiation_id: negId }, performed_by: userId });
                    setShowConvertModal(false);
                    navigate(`/negociacoes/${negId}`);
                  }
                } catch (err) { setToast(err instanceof Error ? err.message : "Erro ao criar negociação"); }
                finally { setSaving(false); }
              }} style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: T.sprout, color: "var(--interactive-on-primary)", fontSize: 13, fontWeight: 600, cursor: !convDevId || saving ? "not-allowed" : "pointer", opacity: !convDevId || saving ? 0.5 : 1 }}>{saving ? "Criando..." : "Criar negociação"}</button>
            </div>
          </div>
        </div>, document.body
      )}

      {/* Confirm dialog v7 */}
      {confirmDialog && createPortal(
        <div onClick={() => setConfirmDialog(null)} onKeyDown={(e) => { if (e.key === "Escape") setConfirmDialog(null); }} tabIndex={-1} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "cdFadeIn 150ms ease" }}>
          <style>{`@keyframes cdFadeIn{from{opacity:0}to{opacity:1}}`}</style>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "linear-gradient(145deg, var(--surface-raised), var(--surface-base))", border: "1px solid rgba(42,40,34,0.8)", borderRadius: 12, padding: 24, maxWidth: 400, width: "90%" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: T.bone, margin: "0 0 8px" }}>{confirmDialog.title}</h3>
            <p style={{ fontSize: 14, color: T.fog, margin: "0 0 24px", lineHeight: 1.5 }}>{confirmDialog.message}</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setConfirmDialog(null)} style={{ padding: "8px 16px", borderRadius: 8, cursor: "pointer", background: "transparent", border: `1px solid ${T.stone}`, color: T.fog, fontSize: 13 }}>Cancelar</button>
              <button type="button" onClick={confirmDialog.onConfirm} style={{ padding: "8px 16px", borderRadius: 8, cursor: "pointer", border: "none", fontSize: 13, fontWeight: 600, ...(confirmDialog.variant === "danger" ? { background: "rgba(248,113,113,0.15)", color: "#F87171" } : { background: T.sprout, color: T.ink }) }}>{confirmDialog.variant === "danger" ? "Remover mesmo assim" : "Confirmar"}</button>
            </div>
          </div>
        </div>, document.body
      )}

      {/* Toast */}
      {toast && (() => { setTimeout(() => setToast(null), 3000); return <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", background: T.sprout, color: "var(--interactive-on-primary)", padding: "10px 24px", borderRadius: 8, fontSize: 13, fontWeight: 700, zIndex: 10000, boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>{toast}</div>; })()}
    </div>
  );
}
