import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useAuth } from "../../../app/contexts/AuthContext";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import NexaBadge from "../../../shared/components/NexaBadge";
import { getNegotiationStatusLabel } from "../../../domain/negociacao/NegotiationStatusLabel";
import { timeAgo } from "../../../shared/utils/timeAgo";

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
}

interface ClientDoc {
  id: string; document_type: string; file_url: string; file_name: string;
  status: string; rejection_reason: string | null; created_at: string;
}

interface ClientNeg { id: string; status: string; score: number | null; updated_at: string; unit_quadra: string | null; unit_lote: string | null; unit_valor: number | null; broker_name: string | null }
interface ClientAct { id: string; type: string; title: string; status: string; activity_date: string; outcome: string | null; duration_minutes: number }

const T = { ink: "var(--surface-base)", carbon: "var(--surface-raised)", stone: "var(--border-default)", chalk: "var(--text-primary)", bone: "var(--text-secondary)", fog: "var(--text-muted)", slate: "var(--text-disabled)", sprout: "var(--interactive-primary)", blue: "#60A5FA", red: "#F87171", amber: "#FBBF24", purple: "#A78BFA" };
const TEMP_COLORS: Record<string, string> = { hot: "#F87171", warm: "#FBBF24", cold: "#60A5FA" };
const TEMP_LABELS: Record<string, string> = { hot: "Quente", warm: "Morna", cold: "Fria" };
const TYPE_LABELS: Record<string, string> = { visit_broker: "Visita corretor", visit_client: "Visita cliente", visit_development: "Visita empreend.", training: "Treinamento", phone_call: "Ligação", follow_up: "Follow-up", meeting_internal: "Reunião interna", meeting_external: "Reunião externa", other: "Outro" };
const DOC_TYPES = [
  { key: "rg_frente", label: "RG (frente)" }, { key: "rg_verso", label: "RG (verso)" },
  { key: "cpf", label: "CPF" }, { key: "comprovante_renda", label: "Comprovante de renda" },
  { key: "comprovante_endereco", label: "Comprovante de endereço" },
  { key: "certidao_casamento", label: "Certidão de casamento" }, { key: "irpf", label: "IRPF" },
];
const ESTADO_CIVIL_OPTS = [{ v: "solteiro", l: "Solteiro(a)" }, { v: "casado", l: "Casado(a)" }, { v: "divorciado", l: "Divorciado(a)" }, { v: "viuvo", l: "Viúvo(a)" }, { v: "uniao_estavel", l: "União estável" }];
const UF_OPTS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

function fmtBRL(v: number | null) { return v ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "—"; }
function maskCPF(v: string) { return v.replace(/\D/g, "").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2").slice(0, 14); }
function maskPhone(v: string) { return v.replace(/\D/g, "").replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2").slice(0, 15); }
function maskCurrency(v: string) { const n = Number(v.replace(/\D/g, "")) / 100; return n > 0 ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : ""; }
function unmaskCurrency(v: string) { return String(Number(v.replace(/\D/g, "")) / 100); }

const IS: React.CSSProperties = { width: "100%", background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 8, padding: "10px 14px", color: T.chalk, fontSize: 14, outline: "none", boxSizing: "border-box" };
const LBL: React.CSSProperties = { fontSize: 10, color: T.fog, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 4 };

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { account } = useAccount();
  const { authenticatedProfile } = useAuth();
  const screen = useScreen();
  const isMobile = screen.isMobile;
  const accountId = account?.accountId ?? null;
  const userId = authenticatedProfile?.id ?? null;
  const canReview = ["owner", "director", "manager", "concierge"].includes((account?.role as string) ?? "");

  const [client, setClient] = useState<ClientData | null>(null);
  const [negotiations, setNegotiations] = useState<ClientNeg[]>([]);
  const [activities, setActivities] = useState<ClientAct[]>([]);
  const [documents, setDocuments] = useState<ClientDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<"dados" | "endereco" | "conjuge" | "documentos" | "historico">("dados");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<ClientData>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);

  const f = (key: keyof ClientData) => (form[key] as string) ?? (client?.[key] as string) ?? "";
  const setF = (key: keyof ClientData, val: string) => setForm((p) => ({ ...p, [key]: val }));

  const load = useCallback(async () => {
    if (!supabase || !id || !accountId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: cl } = await supabase.from("clients").select("*").eq("id", id).single();
      setClient(cl as ClientData | null);
      const { data: negs } = await supabase.from("negotiations").select("id, status, score, updated_at, units(quadra, lote, valor), brokers(name)").eq("client_id", id).eq("account_id", accountId).order("created_at", { ascending: false });
      setNegotiations((negs ?? []).map((n: Record<string, unknown>) => { const u = (Array.isArray(n.units) ? n.units[0] : n.units) as Record<string, unknown> | null; const b = (Array.isArray(n.brokers) ? n.brokers[0] : n.brokers) as Record<string, unknown> | null; return { id: n.id as string, status: n.status as string, score: n.score as number | null, updated_at: n.updated_at as string, unit_quadra: u?.quadra as string | null, unit_lote: u?.lote as string | null, unit_valor: u?.valor as number | null, broker_name: b?.name as string | null }; }));
      const { data: acts } = await supabase.from("activities").select("id, type, title, status, activity_date, outcome, duration_minutes").eq("client_id", id).eq("account_id", accountId).order("activity_date", { ascending: false }).limit(10);
      setActivities((acts ?? []) as ClientAct[]);
      const { data: docs } = await supabase.from("client_documents").select("id, document_type, file_url, file_name, status, rejection_reason, created_at").eq("client_id", id).order("created_at", { ascending: false });
      setDocuments((docs ?? []) as ClientDoc[]);
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
        await supabase.from("clients").update(payload).eq("id", id);
        setClient({ ...client, ...payload } as ClientData);
      }
      setEditing(false); setForm({}); setToast("Cliente atualizado");
    } catch { setToast("Erro ao salvar"); }
    finally { setSaving(false); }
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

  async function uploadDocument(file: File, docType: string) {
    if (!supabase || !id || !accountId || !userId) return;
    setUploadingDocType(docType);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const path = `${accountId}/${id}/${docType}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("client-documents").upload(path, file);
      if (upErr) throw upErr;
      const { data: signedUrl } = await supabase.storage.from("client-documents").createSignedUrl(path, 60 * 60 * 24 * 365);
      await supabase.from("client_documents").insert({ client_id: id, document_type: docType, file_url: signedUrl?.signedUrl || path, storage_path: path, file_name: file.name, file_size: file.size, status: "uploaded", uploaded_by: userId });
      setToast("Documento enviado"); load();
    } catch (e) { console.error(e); setToast("Erro no upload"); }
    finally { setUploadingDocType(null); }
  }

  async function reviewDoc(docId: string, action: "approved" | "rejected", reason?: string) {
    if (!supabase || !userId) return;
    await supabase.from("client_documents").update({ status: action, rejection_reason: reason || null, reviewed_by: userId, reviewed_at: new Date().toISOString() }).eq("id", docId);
    setToast(action === "approved" ? "Documento aprovado" : "Documento rejeitado"); load();
  }

  if (loading) return <div style={{ padding: 32 }}><div style={{ fontSize: 13, color: T.fog, fontFamily: "var(--font-mono)" }}>Carregando...</div></div>;
  if (!client) return <div style={{ padding: 32 }}><div style={{ fontSize: 14, color: T.red }}>Cliente não encontrado.</div><button type="button" onClick={() => navigate("/clientes")} style={{ marginTop: 16, background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8, padding: "8px 16px", color: T.bone, fontSize: 13, cursor: "pointer" }}>← Voltar</button></div>;

  const tempColor = TEMP_COLORS[client.temperature ?? "warm"] ?? T.amber;
  const tempLabel = TEMP_LABELS[client.temperature ?? "warm"] ?? "—";
  const needsSpouse = f("marital_status") === "casado" || f("marital_status") === "uniao_estavel";
  const docsByType: Record<string, ClientDoc> = {}; documents.forEach((d) => { if (!docsByType[d.document_type] || d.created_at > docsByType[d.document_type].created_at) docsByType[d.document_type] = d; });
  const docCount = DOC_TYPES.filter((dt) => docsByType[dt.key]?.status === "uploaded" || docsByType[dt.key]?.status === "approved").length;

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: isMobile ? "16px 12px" : "24px 0" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <button type="button" onClick={() => navigate("/clientes")} style={{ background: "none", border: "none", color: T.fog, fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 6 }}>← Clientes</button>
          <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: T.chalk, margin: 0 }}>{client.full_name || client.name}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 10px", borderRadius: 6, background: tempColor + "15", color: tempColor }}>{tempLabel}</span>
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: T.blue + "15", color: T.blue }}>{docCount}/{DOC_TYPES.length} docs</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!editing && <button type="button" onClick={() => { setEditing(true); setForm({}); }} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.bone, fontSize: 13, cursor: "pointer" }}>✎ Editar</button>}
          {editing && <button type="button" onClick={() => { setEditing(false); setForm({}); }} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 13, cursor: "pointer" }}>Cancelar</button>}
          {editing && <button type="button" onClick={handleSave} disabled={saving} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: T.sprout, color: "var(--interactive-on-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{saving ? "Salvando..." : "Salvar"}</button>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${T.stone}`, marginBottom: 20, overflowX: "auto" }}>
        {([["dados", "Dados Pessoais"], ["endereco", "Endereço"], ...(needsSpouse ? [["conjuge", "Cônjuge"]] : []), ["documentos", `Documentos (${docCount})`], ["historico", "Histórico"]] as [string, string][]).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k as typeof tab)} style={{ padding: "10px 16px", background: "none", border: "none", borderBottom: tab === k ? `2px solid ${T.sprout}` : "2px solid transparent", color: tab === k ? T.sprout : T.fog, fontSize: 13, fontWeight: tab === k ? 600 : 400, cursor: "pointer", whiteSpace: "nowrap" }}>{l}</button>
        ))}
      </div>

      {/* Tab: Dados Pessoais */}
      {tab === "dados" && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 14 }}>
          <div style={{ gridColumn: isMobile ? "1" : "1 / 3" }}><label style={LBL}>Nome completo</label>{editing ? <input style={IS} value={f("full_name") || f("name")} onChange={(e) => setF("full_name", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.full_name || client.name || "—"}</div>}</div>
          <div><label style={LBL}>CPF</label>{editing ? <input style={IS} value={maskCPF(f("cpf"))} onChange={(e) => setF("cpf", e.target.value.replace(/\D/g, "").slice(0, 11))} maxLength={14} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.cpf ? maskCPF(client.cpf) : "—"}</div>}</div>
          <div><label style={LBL}>RG</label>{editing ? <input style={IS} value={f("rg")} onChange={(e) => setF("rg", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.rg || "—"}</div>}</div>
          <div><label style={LBL}>Órgão emissor</label>{editing ? <input style={IS} value={f("rg_orgao")} onChange={(e) => setF("rg_orgao", e.target.value)} placeholder="SSP/PR" /> : <div style={{ fontSize: 14, color: T.bone }}>{client.rg_orgao || "—"}</div>}</div>
          <div><label style={LBL}>Data nascimento</label>{editing ? <input type="date" style={IS} value={f("data_nascimento")} onChange={(e) => setF("data_nascimento", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.data_nascimento ? new Date(client.data_nascimento + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</div>}</div>
          <div><label style={LBL}>Estado civil</label>{editing ? <select style={IS} value={f("marital_status")} onChange={(e) => setF("marital_status", e.target.value)}><option value="">Selecione</option>{ESTADO_CIVIL_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select> : <div style={{ fontSize: 14, color: T.bone }}>{ESTADO_CIVIL_OPTS.find((o) => o.v === client.marital_status)?.l || client.marital_status || "—"}</div>}</div>
          <div><label style={LBL}>Profissão</label>{editing ? <input style={IS} value={f("profession")} onChange={(e) => setF("profession", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.profession || "—"}</div>}</div>
          <div><label style={LBL}>Renda mensal</label>{editing ? <input style={IS} value={f("renda_mensal") ? maskCurrency(String(Math.round(Number(f("renda_mensal")) * 100))) : ""} onChange={(e) => setF("renda_mensal", unmaskCurrency(e.target.value))} placeholder="R$ 0,00" /> : <div style={{ fontSize: 14, color: T.bone }}>{client.renda_mensal ? fmtBRL(client.renda_mensal) : "—"}</div>}</div>
          <div><label style={LBL}>Telefone</label>{editing ? <input style={IS} value={maskPhone(f("phone"))} onChange={(e) => setF("phone", e.target.value.replace(/\D/g, "").slice(0, 11))} maxLength={15} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.phone ? maskPhone(client.phone) : "—"}</div>}</div>
          <div><label style={LBL}>Email</label>{editing ? <input type="email" style={IS} value={f("email")} onChange={(e) => setF("email", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.email || "—"}</div>}</div>
          <div style={{ gridColumn: "1 / -1" }}><label style={LBL}>Observações</label>{editing ? <textarea rows={2} style={{ ...IS, resize: "vertical" }} value={f("observations")} onChange={(e) => setF("observations", e.target.value)} /> : <div style={{ fontSize: 13, color: T.fog }}>{client.observations || "—"}</div>}</div>
        </div>
      )}

      {/* Tab: Endereço */}
      {tab === "endereco" && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 14 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><label style={LBL}>CEP</label>{editing ? <input style={IS} value={f("cep")} onChange={(e) => setF("cep", e.target.value)} onBlur={buscarCep} placeholder="00000-000" /> : <div style={{ fontSize: 14, color: T.bone }}>{client.cep || "—"}</div>}</div>
            {editing && <button type="button" onClick={buscarCep} style={{ alignSelf: "flex-end", padding: "10px 14px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 12, cursor: "pointer", marginBottom: 0 }}>🔍</button>}
          </div>
          <div style={{ gridColumn: isMobile ? "1" : "1 / 3" }}><label style={LBL}>Endereço</label>{editing ? <input style={IS} value={f("endereco")} onChange={(e) => setF("endereco", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.endereco || "—"}</div>}</div>
          <div><label style={LBL}>Número</label>{editing ? <input style={IS} value={f("numero")} onChange={(e) => setF("numero", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.numero || "—"}</div>}</div>
          <div><label style={LBL}>Complemento</label>{editing ? <input style={IS} value={f("complemento")} onChange={(e) => setF("complemento", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.complemento || "—"}</div>}</div>
          <div><label style={LBL}>Bairro</label>{editing ? <input style={IS} value={f("bairro")} onChange={(e) => setF("bairro", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.bairro || "—"}</div>}</div>
          <div><label style={LBL}>Cidade</label>{editing ? <input style={IS} value={f("city")} onChange={(e) => setF("city", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.city || "—"}</div>}</div>
          <div><label style={LBL}>UF</label>{editing ? <select style={IS} value={f("uf")} onChange={(e) => setF("uf", e.target.value)}><option value="">—</option>{UF_OPTS.map((u) => <option key={u} value={u}>{u}</option>)}</select> : <div style={{ fontSize: 14, color: T.bone }}>{client.uf || "—"}</div>}</div>
        </div>
      )}

      {/* Tab: Cônjuge */}
      {tab === "conjuge" && needsSpouse && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 14 }}>
          <div><label style={LBL}>Regime de casamento</label>{editing ? <select style={IS} value={f("regime_casamento")} onChange={(e) => setF("regime_casamento", e.target.value)}><option value="">Selecione</option><option value="comunhao_parcial">Comunhão parcial</option><option value="comunhao_universal">Comunhão universal</option><option value="separacao_total">Separação total</option></select> : <div style={{ fontSize: 14, color: T.bone }}>{client.regime_casamento || "—"}</div>}</div>
          <div style={{ gridColumn: isMobile ? "1" : "1 / 3" }}><label style={LBL}>Nome do cônjuge</label>{editing ? <input style={IS} value={f("conjuge_nome")} onChange={(e) => setF("conjuge_nome", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.conjuge_nome || "—"}</div>}</div>
          <div><label style={LBL}>CPF cônjuge</label>{editing ? <input style={IS} value={f("conjuge_cpf")} onChange={(e) => setF("conjuge_cpf", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.conjuge_cpf || "—"}</div>}</div>
          <div><label style={LBL}>RG cônjuge</label>{editing ? <input style={IS} value={f("conjuge_rg")} onChange={(e) => setF("conjuge_rg", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.conjuge_rg || "—"}</div>}</div>
          <div><label style={LBL}>Data nasc. cônjuge</label>{editing ? <input type="date" style={IS} value={f("conjuge_data_nascimento")} onChange={(e) => setF("conjuge_data_nascimento", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.conjuge_data_nascimento || "—"}</div>}</div>
          <div><label style={LBL}>Profissão cônjuge</label>{editing ? <input style={IS} value={f("conjuge_profissao")} onChange={(e) => setF("conjuge_profissao", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.conjuge_profissao || "—"}</div>}</div>
          <div><label style={LBL}>Email cônjuge</label>{editing ? <input style={IS} value={f("conjuge_email")} onChange={(e) => setF("conjuge_email", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.conjuge_email || "—"}</div>}</div>
          <div><label style={LBL}>Telefone cônjuge</label>{editing ? <input style={IS} value={f("conjuge_telefone")} onChange={(e) => setF("conjuge_telefone", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{client.conjuge_telefone || "—"}</div>}</div>
        </div>
      )}

      {/* Tab: Documentos */}
      {tab === "documentos" && (
        <div>
          <div style={{ fontSize: 12, color: T.fog, marginBottom: 16 }}>Progresso: {docCount}/{DOC_TYPES.length} documentos enviados</div>
          <div style={{ display: "grid", gap: 8 }}>
            {DOC_TYPES.map((dt) => {
              const doc = docsByType[dt.key];
              const statusIcon = !doc ? "⚠" : doc.status === "approved" ? "✅" : doc.status === "rejected" ? "❌" : "⏳";
              const statusColor = !doc ? T.slate : doc.status === "approved" ? "#4ADE80" : doc.status === "rejected" ? T.red : T.blue;
              const statusLabel = !doc ? "Pendente" : doc.status === "approved" ? "Aprovado" : doc.status === "rejected" ? "Rejeitado" : "Enviado";
              return (
                <div key={dt.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: T.bone, fontWeight: 500 }}>{dt.label}</div>
                    {doc && <div style={{ fontSize: 11, color: T.slate, marginTop: 2 }}>{doc.file_name}</div>}
                    {doc?.rejection_reason && <div style={{ fontSize: 11, color: T.red, marginTop: 2 }}>Motivo: {doc.rejection_reason}</div>}
                  </div>
                  <span style={{ fontSize: 12, color: statusColor, fontWeight: 600, whiteSpace: "nowrap" }}>{statusIcon} {statusLabel}</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    {doc && <button type="button" onClick={() => window.open(doc.file_url, "_blank")} style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 11, cursor: "pointer" }}>👁</button>}
                    {doc && doc.status === "uploaded" && canReview && (
                      <>
                        <button type="button" onClick={() => reviewDoc(doc.id, "approved")} style={{ padding: "4px 8px", borderRadius: 6, border: "none", background: "#4ADE8020", color: "#4ADE80", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>✓</button>
                        <button type="button" onClick={() => { const reason = prompt("Motivo da rejeição:"); if (reason) reviewDoc(doc.id, "rejected", reason); }} style={{ padding: "4px 8px", borderRadius: 6, border: "none", background: T.red + "20", color: T.red, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>✕</button>
                      </>
                    )}
                    {!doc && (
                      <button type="button" onClick={() => { setUploadingDocType(dt.key); fileRef.current?.click(); }} disabled={uploadingDocType === dt.key} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 11, cursor: "pointer" }}>{uploadingDocType === dt.key ? "..." : "📎"}</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file && uploadingDocType) { uploadDocument(file, uploadingDocType); } else { setUploadingDocType(null); } e.target.value = ""; }} />
        </div>
      )}

      {/* Tab: Histórico (negociações + atividades) */}
      {tab === "historico" && (
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: T.slate, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>NEGOCIAÇÕES ({negotiations.length})</div>
          {negotiations.length === 0 ? <div style={{ fontSize: 13, color: T.fog, marginBottom: 20 }}>Nenhuma negociação.</div> : (
            <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
              {negotiations.map((n) => (
                <Link key={n.id} to={`/negociacoes/${n.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, textDecoration: "none" }}>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 500, color: T.bone }}>Q{n.unit_quadra} · L{n.unit_lote} — {fmtBRL(n.unit_valor)}</div><div style={{ fontSize: 11, color: T.fog }}>{n.broker_name || "—"} · {timeAgo(n.updated_at)}</div></div>
                  {n.score != null && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, fontFamily: "var(--font-mono)", background: (n.score > 70 ? "#4ADE80" : n.score >= 40 ? "#FBBF24" : "#F87171") + "15", color: n.score > 70 ? "#4ADE80" : n.score >= 40 ? "#FBBF24" : "#F87171" }}>{n.score}</span>}
                  <NexaBadge entity="negotiation" status={n.status.toUpperCase() as never} label={getNegotiationStatusLabel(n.status.toUpperCase() as never)} />
                </Link>
              ))}
            </div>
          )}
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: T.slate, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>ATIVIDADES ({activities.length})</div>
          {activities.length === 0 ? <div style={{ fontSize: 13, color: T.fog }}>Nenhuma atividade.</div> : (
            <div style={{ display: "grid", gap: 6 }}>
              {activities.map((a) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8 }}>
                  <span style={{ fontSize: 11, color: T.fog, fontFamily: "var(--font-mono)", minWidth: 55 }}>{new Date(a.activity_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: T.sprout + "15", color: T.sprout, whiteSpace: "nowrap" }}>{TYPE_LABELS[a.type] || a.type}</span>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, color: T.bone, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>{a.outcome && <div style={{ fontSize: 11, color: T.fog }}>{a.outcome}</div>}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${T.stone}`, fontSize: 11, color: T.slate }}>
        Cliente cadastrado em {new Date(client.created_at).toLocaleDateString("pt-BR")}
        {client.last_interaction_at && ` · Último contato: ${timeAgo(client.last_interaction_at)}`}
      </div>

      {/* Toast */}
      {toast && (() => { setTimeout(() => setToast(null), 3000); return <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", background: T.sprout, color: "var(--interactive-on-primary)", padding: "10px 24px", borderRadius: 8, fontSize: 13, fontWeight: 700, zIndex: 10000, boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>{toast}</div>; })()}
    </div>
  );
}
