import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAccount } from "../../../app/contexts/AccountContext";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import { timeAgo } from "../../../shared/utils/timeAgo";
import NexaBadge from "../../../shared/components/NexaBadge";
import { getNegotiationStatusLabel } from "../../../domain/negociacao/NegotiationStatusLabel";

const T = { ink: "var(--surface-base)", carbon: "var(--surface-raised)", stone: "var(--border-default)", chalk: "var(--text-primary)", bone: "var(--text-secondary)", fog: "var(--text-muted)", slate: "var(--text-disabled)", sprout: "var(--interactive-primary)", blue: "#60A5FA", red: "#F87171" };
const IS: React.CSSProperties = { width: "100%", background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 8, padding: "10px 14px", color: T.chalk, fontSize: 14, outline: "none", boxSizing: "border-box" };
const LBL: React.CSSProperties = { fontSize: 10, color: T.fog, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 4 };
const UF_OPTS = UF_OPTIONS;

import { maskCPF, maskPhone, formatCurrency, UF_OPTIONS } from "../../../shared/utils/masks";
function fmtBRL(v: number | null) { return formatCurrency(v); }

interface BrokerData { id: string; name: string; email: string | null; phone: string | null; cpf: string | null; creci: string | null; city: string | null; uf: string | null; brokerage_id: string | null; brokerage_name: string | null; status: string; has_system_access: boolean; consultant_id: string | null; created_at: string }
interface BrokerNeg { id: string; status: string; score: number | null; updated_at: string; unit_quadra: string | null; unit_lote: string | null; unit_valor: number | null; client_name: string | null }

export default function BrokerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { account } = useAccount();
  const screen = useScreen();
  const isMobile = screen.isMobile;
  const accountId = account?.accountId ?? null;

  const [broker, setBroker] = useState<BrokerData | null>(null);
  const [negotiations, setNegotiations] = useState<BrokerNeg[]>([]);
  const [consultants, setConsultants] = useState<{ id: string; name: string }[]>([]);
  const [brokerages, setBrokerages] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<BrokerData>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<"dados" | "imobiliaria" | "negociacoes">("dados");

  const f = (key: keyof BrokerData) => (form[key] as string) ?? (broker?.[key] as string) ?? "";
  const setF = (key: keyof BrokerData, val: string) => setForm((p) => ({ ...p, [key]: val }));

  const load = useCallback(async () => {
    if (!supabase || !id || !accountId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: b } = await supabase.from("brokers").select("*").eq("id", id).single();
      setBroker(b as BrokerData | null);

      const { data: negs } = await supabase.from("negotiations").select("id, status, score, updated_at, units(quadra, lote, valor), clients(name)").eq("broker_id", id).eq("account_id", accountId).order("created_at", { ascending: false }).limit(20);
      setNegotiations((negs ?? []).map((n: Record<string, unknown>) => {
        const u = (Array.isArray(n.units) ? n.units[0] : n.units) as Record<string, unknown> | null;
        const c = (Array.isArray(n.clients) ? n.clients[0] : n.clients) as Record<string, unknown> | null;
        return { id: n.id as string, status: n.status as string, score: n.score as number | null, updated_at: n.updated_at as string, unit_quadra: u?.quadra as string | null, unit_lote: u?.lote as string | null, unit_valor: u?.valor as number | null, client_name: c?.name as string | null };
      }));

      const { data: cons } = await supabase.from("user_account_access").select("user_id, role, profiles!inner(id, name)").eq("account_id", accountId).in("role", ["commercial_consultant", "manager", "owner", "director"]);
      setConsultants((cons ?? []).map((c: Record<string, unknown>) => { const p = (Array.isArray(c.profiles) ? c.profiles[0] : c.profiles) as Record<string, unknown>; return { id: p.id as string, name: p.name as string }; }));

      const { data: brks } = await supabase.from("brokerages").select("id, name").eq("account_id", accountId).order("name");
      setBrokerages((brks ?? []) as { id: string; name: string }[]);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [id, accountId]);

  useEffect(() => { void load(); }, [load]);

  async function handleSave() {
    if (!supabase || !id || !broker) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(form)) { if (v !== undefined && v !== (broker as unknown as Record<string, unknown>)[k]) payload[k] = v || null; }
      if (Object.keys(payload).length > 0) {
        await supabase.from("brokers").update(payload).eq("id", id);
        setBroker({ ...broker, ...payload } as BrokerData);
      }
      setEditing(false); setForm({}); setToast("Corretor atualizado");
    } catch { setToast("Erro ao salvar"); }
    finally { setSaving(false); }
  }

  if (loading) return <div style={{ padding: 32, fontSize: 13, color: T.fog, fontFamily: "var(--font-mono)" }}>Carregando...</div>;
  if (!broker) return <div style={{ padding: 32 }}><div style={{ fontSize: 14, color: T.red }}>Corretor não encontrado.</div><button type="button" onClick={() => navigate("/corretores")} style={{ marginTop: 16, background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8, padding: "8px 16px", color: T.bone, fontSize: 13, cursor: "pointer" }}>← Voltar</button></div>;

  const accessLabel = broker.has_system_access ? "🟢 Acesso ativo" : "⚪ Sem acesso";

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: isMobile ? "16px 12px" : "24px 0" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <button type="button" onClick={() => navigate("/corretores")} style={{ background: "none", border: "none", color: T.fog, fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 6 }}>← Corretores</button>
          <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: T.chalk, margin: 0 }}>{broker.name}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            {broker.creci && <span style={{ fontSize: 11, color: T.fog, fontFamily: "var(--font-mono)" }}>CRECI {broker.creci}</span>}
            {broker.brokerage_name && <span style={{ fontSize: 11, color: T.fog }}>· {broker.brokerage_name}</span>}
            <span style={{ fontSize: 11 }}>{accessLabel}</span>
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
        {([["dados", "Dados Pessoais"], ["imobiliaria", "Imobiliária"], ["negociacoes", `Negociações (${negotiations.length})`]] as [string, string][]).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k as typeof tab)} style={{ padding: "10px 16px", background: "none", border: "none", borderBottom: tab === k ? `2px solid ${T.sprout}` : "2px solid transparent", color: tab === k ? T.sprout : T.fog, fontSize: 13, fontWeight: tab === k ? 600 : 400, cursor: "pointer", whiteSpace: "nowrap" }}>{l}</button>
        ))}
      </div>

      {/* Tab: Dados */}
      {tab === "dados" && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 14 }}>
          <div style={{ gridColumn: isMobile ? "1" : "1 / 3" }}><label style={LBL}>Nome completo</label>{editing ? <input style={IS} value={f("name")} onChange={(e) => setF("name", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{broker.name || "—"}</div>}</div>
          <div><label style={LBL}>CRECI-F</label>{editing ? <input style={IS} value={f("creci")} onChange={(e) => setF("creci", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{broker.creci || "—"}</div>}</div>
          <div><label style={LBL}>CPF</label>{editing ? <input style={IS} value={maskCPF(f("cpf"))} onChange={(e) => setF("cpf", e.target.value.replace(/\D/g, "").slice(0, 11))} maxLength={14} /> : <div style={{ fontSize: 14, color: T.bone }}>{broker.cpf ? maskCPF(broker.cpf) : "—"}</div>}</div>
          <div><label style={LBL}>Telefone</label>{editing ? <input style={IS} value={maskPhone(f("phone"))} onChange={(e) => setF("phone", e.target.value.replace(/\D/g, "").slice(0, 11))} maxLength={15} /> : <div style={{ fontSize: 14, color: T.bone }}>{broker.phone ? maskPhone(broker.phone) : "—"}</div>}</div>
          <div><label style={LBL}>Email</label>{editing ? <input type="email" style={IS} value={f("email")} onChange={(e) => setF("email", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{broker.email || "—"}</div>}</div>
          <div><label style={LBL}>Cidade</label>{editing ? <input style={IS} value={f("city")} onChange={(e) => setF("city", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{broker.city || "—"}</div>}</div>
          <div><label style={LBL}>UF</label>{editing ? <select style={IS} value={f("uf")} onChange={(e) => setF("uf", e.target.value)}>{UF_OPTS.map((u) => <option key={u} value={u}>{u}</option>)}</select> : <div style={{ fontSize: 14, color: T.bone }}>{broker.uf || "—"}</div>}</div>
          <div style={{ gridColumn: "1 / -1" }}><label style={LBL}>Consultor responsável</label>{editing ? <select style={IS} value={f("consultant_id")} onChange={(e) => setF("consultant_id", e.target.value)}><option value="">Nenhum</option>{consultants.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select> : <div style={{ fontSize: 14, color: T.bone }}>{consultants.find((c) => c.id === broker.consultant_id)?.name || "—"}</div>}</div>
        </div>
      )}

      {/* Tab: Imobiliária */}
      {tab === "imobiliaria" && (
        <div>
          <label style={LBL}>Imobiliária vinculada</label>
          {editing ? <select style={{ ...IS, marginBottom: 16 }} value={f("brokerage_id")} onChange={(e) => setF("brokerage_id", e.target.value)}><option value="">Nenhuma</option>{brokerages.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select> : <div style={{ fontSize: 14, color: T.bone, marginBottom: 16 }}>{broker.brokerage_name || brokerages.find((b) => b.id === broker.brokerage_id)?.name || "Nenhuma"}</div>}
          {broker.brokerage_id && <Link to={`/imobiliarias/${broker.brokerage_id}`} style={{ fontSize: 13, color: T.sprout }}>Ver ficha da imobiliária →</Link>}
        </div>
      )}

      {/* Tab: Negociações */}
      {tab === "negociacoes" && (
        <div>
          {negotiations.length === 0 ? <div style={{ fontSize: 13, color: T.fog }}>Nenhuma negociação vinculada.</div> : (
            <div style={{ display: "grid", gap: 8 }}>
              {negotiations.map((n) => (
                <Link key={n.id} to={`/negociacoes/${n.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, textDecoration: "none" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: T.bone }}>Q{n.unit_quadra} · L{n.unit_lote} — {fmtBRL(n.unit_valor)}</div>
                    <div style={{ fontSize: 11, color: T.fog }}>{n.client_name || "—"} · {timeAgo(n.updated_at)}</div>
                  </div>
                  {n.score != null && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, fontFamily: "var(--font-mono)", background: (n.score > 70 ? "#4ADE80" : n.score >= 40 ? "#FBBF24" : "#F87171") + "15", color: n.score > 70 ? "#4ADE80" : n.score >= 40 ? "#FBBF24" : "#F87171" }}>{n.score}</span>}
                  <NexaBadge entity="negotiation" status={n.status.toUpperCase() as never} label={getNegotiationStatusLabel(n.status.toUpperCase() as never)} />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${T.stone}`, fontSize: 11, color: T.slate }}>
        Cadastrado em {new Date(broker.created_at).toLocaleDateString("pt-BR")}
      </div>
      {toast && (() => { setTimeout(() => setToast(null), 3000); return <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", background: T.sprout, color: "var(--interactive-on-primary)", padding: "10px 24px", borderRadius: 8, fontSize: 13, fontWeight: 700, zIndex: 10000 }}>{toast}</div>; })()}
    </div>
  );
}
