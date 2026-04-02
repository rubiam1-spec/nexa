import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAccount } from "../../../app/contexts/AccountContext";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { useScreen } from "../../../shared/hooks/useIsMobile";

const T = { ink: "var(--surface-base)", carbon: "var(--surface-raised)", stone: "var(--border-default)", chalk: "var(--text-primary)", bone: "var(--text-secondary)", fog: "var(--text-muted)", slate: "var(--text-disabled)", sprout: "var(--interactive-primary)", red: "#F87171" };
const IS: React.CSSProperties = { width: "100%", background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 8, padding: "10px 14px", color: T.chalk, fontSize: 14, outline: "none", boxSizing: "border-box" };
const LBL: React.CSSProperties = { fontSize: 10, color: T.fog, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 4 };
const UF_OPTS = UF_OPTIONS;

import { maskCNPJ, maskPhone, UF_OPTIONS } from "../../../shared/utils/masks";

interface BrokerageData { id: string; name: string; cnpj: string | null; creci: string | null; razao_social: string | null; nome_fantasia: string | null; responsavel: string | null; telefone: string | null; email: string | null; cidade: string | null; uf: string | null; endereco: string | null; created_at: string }
interface LinkedBroker { id: string; name: string; creci: string | null; phone: string | null; status: string; has_system_access: boolean }

export default function BrokerageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { account } = useAccount();
  const screen = useScreen();
  const isMobile = screen.isMobile;
  const accountId = account?.accountId ?? null;

  const [brokerage, setBrokerage] = useState<BrokerageData | null>(null);
  const [brokers, setBrokers] = useState<LinkedBroker[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<BrokerageData>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<"dados" | "corretores">("dados");

  const f = (key: keyof BrokerageData) => (form[key] as string) ?? (brokerage?.[key] as string) ?? "";
  const setF = (key: keyof BrokerageData, val: string) => setForm((p) => ({ ...p, [key]: val }));

  const load = useCallback(async () => {
    if (!supabase || !id || !accountId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: b } = await supabase.from("brokerages").select("*").eq("id", id).single();
      setBrokerage(b as BrokerageData | null);
      const { data: brs } = await supabase.from("brokers").select("id, name, creci, phone, status, has_system_access").eq("brokerage_id", id).eq("account_id", accountId).order("name");
      setBrokers((brs ?? []) as LinkedBroker[]);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [id, accountId]);

  useEffect(() => { void load(); }, [load]);

  const [cnpjLoading, setCnpjLoading] = useState(false);

  async function buscarCNPJ(cnpj: string) {
    const cleaned = cnpj.replace(/\D/g, "");
    if (cleaned.length !== 14) return;
    setCnpjLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleaned}`);
      if (!res.ok) { setToast("CNPJ não encontrado"); return; }
      const d = await res.json();
      if (d.razao_social) setF("razao_social", d.razao_social);
      if (d.nome_fantasia) setF("nome_fantasia", d.nome_fantasia);
      if (d.ddd_telefone_1) setF("telefone", d.ddd_telefone_1.replace(/\D/g, ""));
      if (d.municipio) setF("cidade", d.municipio);
      if (d.uf) setF("uf", d.uf);
      if (d.logradouro) setF("endereco", [d.logradouro, d.numero, d.bairro].filter(Boolean).join(", "));
      setToast("Dados do CNPJ carregados");
    } catch { /* silencioso */ }
    finally { setCnpjLoading(false); }
  }

  async function handleSave() {
    if (!supabase || !id || !brokerage) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(form)) { if (v !== undefined && v !== (brokerage as unknown as Record<string, unknown>)[k]) payload[k] = v || null; }
      if (Object.keys(payload).length > 0) {
        await supabase.from("brokerages").update(payload).eq("id", id);
        setBrokerage({ ...brokerage, ...payload } as BrokerageData);
      }
      setEditing(false); setForm({}); setToast("Imobiliária atualizada");
    } catch { setToast("Erro ao salvar"); }
    finally { setSaving(false); }
  }

  if (loading) return <div style={{ padding: 32, fontSize: 13, color: T.fog, fontFamily: "var(--font-mono)" }}>Carregando...</div>;
  if (!brokerage) return <div style={{ padding: 32 }}><div style={{ fontSize: 14, color: T.red }}>Imobiliária não encontrada.</div><button type="button" onClick={() => navigate("/imobiliarias")} style={{ marginTop: 16, background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8, padding: "8px 16px", color: T.bone, fontSize: 13, cursor: "pointer" }}>← Voltar</button></div>;

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: isMobile ? "16px 12px" : "24px 0" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <button type="button" onClick={() => navigate("/imobiliarias")} style={{ background: "none", border: "none", color: T.fog, fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 6 }}>← Imobiliárias</button>
          <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: T.chalk, margin: 0 }}>{brokerage.nome_fantasia || brokerage.name}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            {brokerage.cnpj && <span style={{ fontSize: 11, color: T.fog, fontFamily: "var(--font-mono)" }}>CNPJ {maskCNPJ(brokerage.cnpj)}</span>}
            <span style={{ fontSize: 11, color: T.fog }}>{brokers.length} corretor{brokers.length !== 1 ? "es" : ""}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!editing && <button type="button" onClick={() => { setEditing(true); setForm({}); }} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.bone, fontSize: 13, cursor: "pointer" }}>✎ Editar</button>}
          {editing && <button type="button" onClick={() => { setEditing(false); setForm({}); }} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 13, cursor: "pointer" }}>Cancelar</button>}
          {editing && <button type="button" onClick={handleSave} disabled={saving} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: T.sprout, color: "var(--interactive-on-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{saving ? "Salvando..." : "Salvar"}</button>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${T.stone}`, marginBottom: 20 }}>
        {([["dados", "Dados"], ["corretores", `Corretores (${brokers.length})`]] as [string, string][]).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k as typeof tab)} style={{ padding: "10px 16px", background: "none", border: "none", borderBottom: tab === k ? `2px solid ${T.sprout}` : "2px solid transparent", color: tab === k ? T.sprout : T.fog, fontSize: 13, fontWeight: tab === k ? 600 : 400, cursor: "pointer" }}>{l}</button>
        ))}
      </div>

      {/* Tab: Dados */}
      {tab === "dados" && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 14 }}>
          <div style={{ gridColumn: isMobile ? "1" : "1 / 3" }}><label style={LBL}>Nome fantasia</label>{editing ? <input style={IS} value={f("nome_fantasia") || f("name")} onChange={(e) => setF("nome_fantasia", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{brokerage.nome_fantasia || brokerage.name || "—"}</div>}</div>
          <div><label style={LBL}>CNPJ {cnpjLoading && <span style={{ fontSize: 10, color: T.fog }}>buscando...</span>}</label>{editing ? <input style={IS} value={maskCNPJ(f("cnpj"))} onChange={(e) => { const raw = e.target.value.replace(/\D/g, "").slice(0, 14); setF("cnpj", raw); if (raw.length === 14) buscarCNPJ(raw); }} maxLength={18} /> : <div style={{ fontSize: 14, color: T.bone }}>{brokerage.cnpj ? maskCNPJ(brokerage.cnpj) : "—"}</div>}</div>
          <div><label style={LBL}>CRECI-J</label>{editing ? <input style={IS} value={f("creci")} onChange={(e) => setF("creci", e.target.value)} placeholder="00000/UF" /> : <div style={{ fontSize: 14, color: T.bone }}>{brokerage.creci || "—"}</div>}</div>
          <div style={{ gridColumn: isMobile ? "1" : "1 / -1" }}><label style={LBL}>Razão social</label>{editing ? <input style={IS} value={f("razao_social")} onChange={(e) => setF("razao_social", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{brokerage.razao_social || "—"}</div>}</div>
          <div><label style={LBL}>Responsável</label>{editing ? <input style={IS} value={f("responsavel")} onChange={(e) => setF("responsavel", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{brokerage.responsavel || "—"}</div>}</div>
          <div><label style={LBL}>Telefone</label>{editing ? <input style={IS} value={maskPhone(f("telefone"))} onChange={(e) => setF("telefone", e.target.value.replace(/\D/g, "").slice(0, 11))} maxLength={15} /> : <div style={{ fontSize: 14, color: T.bone }}>{brokerage.telefone ? maskPhone(brokerage.telefone) : (brokerage as unknown as Record<string, string>).phone ? maskPhone((brokerage as unknown as Record<string, string>).phone) : "—"}</div>}</div>
          <div><label style={LBL}>Email</label>{editing ? <input type="email" style={IS} value={f("email")} onChange={(e) => setF("email", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{brokerage.email || "—"}</div>}</div>
          <div style={{ gridColumn: isMobile ? "1" : "1 / 3" }}><label style={LBL}>Endereço</label>{editing ? <input style={IS} value={f("endereco")} onChange={(e) => setF("endereco", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{brokerage.endereco || "—"}</div>}</div>
          <div><label style={LBL}>Cidade</label>{editing ? <input style={IS} value={f("cidade")} onChange={(e) => setF("cidade", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{brokerage.cidade || (brokerage as unknown as Record<string, string>).city || "—"}</div>}</div>
          <div><label style={LBL}>UF</label>{editing ? <select style={IS} value={f("uf")} onChange={(e) => setF("uf", e.target.value)}><option value="">—</option>{UF_OPTS.map((u) => <option key={u} value={u}>{u}</option>)}</select> : <div style={{ fontSize: 14, color: T.bone }}>{brokerage.uf || "—"}</div>}</div>
        </div>
      )}

      {/* Tab: Corretores */}
      {tab === "corretores" && (
        <div>
          {brokers.length === 0 ? <div style={{ fontSize: 13, color: T.fog }}>Nenhum corretor vinculado.</div> : (
            <div style={{ display: "grid", gap: 8 }}>
              {brokers.map((b) => (
                <Link key={b.id} to={`/corretores/${b.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, textDecoration: "none" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: T.bone }}>{b.name}</div>
                    <div style={{ fontSize: 11, color: T.fog }}>{b.creci ? `CRECI ${b.creci}` : "Sem CRECI"}{b.phone ? ` · ${maskPhone(b.phone)}` : ""}</div>
                  </div>
                  <span style={{ fontSize: 11, color: b.has_system_access ? "#4ADE80" : T.slate }}>{b.has_system_access ? "🟢 Ativo" : "⚪ Sem acesso"}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${T.stone}`, fontSize: 11, color: T.slate }}>Cadastrada em {new Date(brokerage.created_at).toLocaleDateString("pt-BR")}</div>
      {toast && (() => { setTimeout(() => setToast(null), 3000); return <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", background: T.sprout, color: "var(--interactive-on-primary)", padding: "10px 24px", borderRadius: 8, fontSize: 13, fontWeight: 700, zIndex: 10000 }}>{toast}</div>; })()}
    </div>
  );
}
