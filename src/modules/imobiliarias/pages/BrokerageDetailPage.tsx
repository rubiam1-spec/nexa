import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useAuth } from "../../../app/contexts/AuthContext";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import { maskCNPJ, maskPhone, UF_OPTIONS } from "../../../shared/utils/masks";
import { formatDateBRT } from "../../../shared/utils/dateUtils";
import { NexaSelect } from "../../../shared/ui/NexaSelect";

const T = { ink: "var(--surface-base)", carbon: "var(--surface-raised)", stone: "var(--border-default)", chalk: "var(--text-primary)", bone: "var(--text-secondary)", fog: "var(--text-muted)", slate: "var(--text-disabled)", sprout: "var(--interactive-primary)", red: "#F87171" };
const IS: React.CSSProperties = { width: "100%", background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 8, padding: "10px 14px", color: T.chalk, fontSize: 14, outline: "none", boxSizing: "border-box" };
const LBL: React.CSSProperties = { fontSize: 10, color: T.fog, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 4 };

interface BrokerageData { id: string; name: string; cnpj: string | null; creci: string | null; razao_social: string | null; nome_fantasia: string | null; responsavel: string | null; telefone: string | null; email: string | null; cidade: string | null; uf: string | null; endereco: string | null; bairro: string | null; cep: string | null; observacoes: string | null; created_at: string; status: string }
interface LinkedBroker { id: string; name: string; creci: string | null; phone: string | null; status: string; has_system_access: boolean; is_manager: boolean; profile_id: string | null }

export default function BrokerageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { account } = useAccount();
  const { authenticatedProfile } = useAuth();
  const { development } = useDevelopment();
  const screen = useScreen();
  const isMobile = screen.isMobile;
  const accountId = account?.accountId ?? null;
  const developmentId = development?.developmentId ?? null;
  const canManage = ["owner", "director", "manager", "administrative", "concierge"].includes((account?.role as string) ?? "");

  const [brokerage, setBrokerage] = useState<BrokerageData | null>(null);
  const [brokers, setBrokers] = useState<LinkedBroker[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<BrokerageData>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<"dados" | "corretores">("dados");

  // KPIs
  const [kpis, setKpis] = useState({ negsAtivas: 0, propostasMes: 0, vendasMes: 0, vgvMes: 0 });

  // Vincular modal
  const [vinculaModal, setVinculaModal] = useState(false);
  const [availableBrokers, setAvailableBrokers] = useState<{ id: string; name: string }[]>([]);
  const [selectedBrokerId, setSelectedBrokerId] = useState<string>("");

  // Menu
  const [menuBrokerId, setMenuBrokerId] = useState<string | null>(null);

  const f = (key: keyof BrokerageData) => (form[key] as string) ?? (brokerage?.[key] as string) ?? "";
  const setF = (key: keyof BrokerageData, val: string) => setForm((p) => ({ ...p, [key]: val }));

  const load = useCallback(async () => {
    if (!supabase || !id || !accountId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: b } = await supabase.from("brokerages").select("*").eq("id", id).single();
      setBrokerage(b as BrokerageData | null);
      const { data: brs } = await supabase.from("brokers").select("id, name, creci, phone, status, has_system_access, is_manager, profile_id").eq("brokerage_id", id).eq("account_id", accountId).order("name");
      setBrokers((brs ?? []) as LinkedBroker[]);

      // KPIs: negotiations, proposals, sales for this brokerage's brokers
      const brokerIds = (brs ?? []).map((br: Record<string, unknown>) => br.profile_id || br.id).filter(Boolean) as string[];
      if (brokerIds.length > 0 && developmentId) {
        const { count: negsCount } = await supabase.from("negotiations").select("id", { count: "exact", head: true }).in("broker_id", brokerIds).eq("account_id", accountId).not("status", "in", '("LOST","CANCELLED","WON")');
        const now = new Date(); const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const { count: proposalsCount } = await supabase.from("proposals").select("id", { count: "exact", head: true }).in("broker_id", brokerIds).eq("account_id", accountId).gte("created_at", monthStart);
        // Sales via negotiations of these brokers
        const { data: brokerNegs } = await supabase.from("negotiations").select("id").in("broker_id", brokerIds).eq("account_id", accountId).eq("status", "WON");
        const wonNegIds = (brokerNegs ?? []).map((n: Record<string, unknown>) => n.id as string);
        let vendasMes = 0; let vgvMes = 0;
        if (wonNegIds.length > 0) {
          const { data: salesThisMonth } = await supabase.from("sales").select("amount").in("negotiation_id", wonNegIds).gte("created_at", monthStart);
          vendasMes = (salesThisMonth ?? []).length;
          vgvMes = (salesThisMonth ?? []).reduce((s, r: Record<string, unknown>) => s + Number(r.amount || 0), 0);
        }
        setKpis({ negsAtivas: negsCount ?? 0, propostasMes: proposalsCount ?? 0, vendasMes, vgvMes });
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [id, accountId, developmentId]);

  useEffect(() => { void load(); }, [load]);

  // CNPJ auto-fill
  const [cnpjLoading, setCnpjLoading] = useState(false);
  async function buscarCNPJ(cnpj: string) {
    const cleaned = cnpj.replace(/\D/g, "");
    if (cleaned.length !== 14) return;
    setCnpjLoading(true);
    try {
      let d: Record<string, unknown> | null = null;
      try { const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleaned}`); if (res.ok) d = await res.json(); } catch { /* fallback */ }
      if (!d) { try { const res2 = await fetch(`https://receitaws.com.br/v1/cnpj/${cleaned}`); if (res2.ok) { const r = await res2.json(); if (r.status !== "ERROR") d = r; } } catch { /* silent */ } }
      if (!d) { setToast("CNPJ não encontrado"); return; }
      if (d.razao_social || d.nome) setF("razao_social", (d.razao_social as string) || (d.nome as string) || "");
      if (d.nome_fantasia || d.fantasia) setF("nome_fantasia", (d.nome_fantasia as string) || (d.fantasia as string) || "");
      const tel = (d.ddd_telefone_1 as string) || (d.telefone as string) || "";
      if (tel) setF("telefone", tel.replace(/\D/g, ""));
      if (d.municipio) setF("cidade", d.municipio as string);
      if (d.uf) setF("uf", d.uf as string);
      if (d.logradouro) setF("endereco", [d.logradouro, d.numero, d.bairro].filter(Boolean).join(", "));
      if (d.bairro) setF("bairro", d.bairro as string);
      if (d.cep) setF("cep", (d.cep as string).replace(/\D/g, ""));
      setToast("Dados do CNPJ carregados");
    } catch { /* silent */ }
    finally { setCnpjLoading(false); }
  }

  async function handleSave() {
    if (!supabase || !id || !brokerage) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const [k, v] of Object.entries(form)) { if (v !== undefined && v !== (brokerage as unknown as Record<string, unknown>)[k]) payload[k] = v || null; }
      if (Object.keys(payload).length > 1) {
        await supabase.from("brokerages").update(payload).eq("id", id);
        setBrokerage({ ...brokerage, ...payload } as BrokerageData);
      }
      setEditing(false); setForm({}); setToast("Imobiliária atualizada ✓");
    } catch { setToast("Erro ao salvar"); }
    finally { setSaving(false); }
  }

  async function handleToggleManager(brokerId: string, currentVal: boolean, brokerProfileId: string | null) {
    if (!supabase || !accountId || !id || !brokerage) return;
    const userId = authenticatedProfile?.id ?? null;
    await supabase.from("brokers").update({ is_manager: !currentVal }).eq("id", brokerId);
    // Send notification to the broker
    if (brokerProfileId) {
      const brokerageName = brokerage.nome_fantasia || brokerage.name;
      if (!currentVal) {
        // Assigned as manager
        supabase.from("notifications").insert({ account_id: accountId, recipient_id: brokerProfileId, sender_id: userId, type: "brokerage_manager_assigned", title: "Você foi definido como gestor", message: `Você agora é gestor da imobiliária ${brokerageName}. Acesse o sistema para ver as métricas da sua equipe.`, action_url: `/imobiliarias/${id}`, read: false }).then(() => {}, () => {});
        // Send email via Edge Function
        supabase.functions.invoke("send-notification-email", { body: { recipient_id: brokerProfileId, type: "brokerage_manager_assigned", title: "Você foi definido como gestor", message: `Você agora é gestor da imobiliária ${brokerageName}.`, action_url: `/imobiliarias/${id}`, metadata: { brokerage_name: brokerageName, account_name: account?.accountName } } }).catch(() => {});
      } else {
        // Removed as manager
        supabase.from("notifications").insert({ account_id: accountId, recipient_id: brokerProfileId, sender_id: userId, type: "brokerage_manager_removed", title: "Função de gestor removida", message: `Sua função de gestor da imobiliária ${brokerageName} foi removida.`, action_url: `/imobiliarias/${id}`, read: false }).then(() => {}, () => {});
      }
    }
    setToast(!currentVal ? "Gestor definido ✓" : "Função de gestor removida ✓");
    setMenuBrokerId(null);
    load();
  }

  async function handleUnlinkBroker(brokerId: string) {
    if (!supabase) return;
    const { error } = await supabase.from("brokers").update({ brokerage_id: null, brokerage_name: null, is_manager: false }).eq("id", brokerId).select();
    if (error) { setToast("Erro ao desvincular: " + error.message); setMenuBrokerId(null); return; }
    setToast("Corretor desvinculado");
    setMenuBrokerId(null);
    load();
  }

  async function openVinculaModal() {
    if (!supabase || !accountId) return;
    const { data } = await supabase.from("brokers").select("id, name").eq("account_id", accountId).is("brokerage_id", null).eq("status", "active").order("name");
    setAvailableBrokers((data ?? []) as { id: string; name: string }[]);
    setSelectedBrokerId("");
    setVinculaModal(true);
  }

  async function handleVincular() {
    if (!supabase || !selectedBrokerId || !id || !brokerage) return;
    const { data, error } = await supabase.from("brokers").update({ brokerage_id: id, brokerage_name: brokerage.nome_fantasia || brokerage.name }).eq("id", selectedBrokerId).select();
    if (error) { setToast("Erro ao vincular: " + error.message); return; }
    if (!data || data.length === 0) { setToast("Erro: vínculo não persistiu. Verifique permissões."); return; }
    setToast("Corretor vinculado ✓");
    setVinculaModal(false);
    load();
  }

  const fmtR = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  if (loading) return <div style={{ padding: 32, fontSize: 13, color: T.fog, fontFamily: "var(--font-mono)" }}>Carregando...</div>;
  if (!brokerage) return <div style={{ padding: 32 }}><div style={{ fontSize: 14, color: T.red }}>Imobiliária não encontrada.</div><button type="button" onClick={() => navigate("/imobiliarias")} style={{ marginTop: 16, background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8, padding: "8px 16px", color: T.bone, fontSize: 13, cursor: "pointer" }}>← Voltar</button></div>;

  const gestores = brokers.filter((b) => b.is_manager);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Breadcrumb */}
      <nav style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 20, fontSize: 12 }}>
        <a href="/imobiliarias" style={{ color: T.fog, textDecoration: "none" }}>Imobiliárias</a>
        <span style={{ color: T.slate }}>›</span>
        <span style={{ color: T.bone }}>{brokerage.nome_fantasia || brokerage.name}</span>
      </nav>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontSize: isMobile ? 22 : 26, fontWeight: 400, color: T.bone, margin: "0 0 6px" }}>{brokerage.nome_fantasia || brokerage.name}</h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {brokerage.cnpj && <span style={{ fontSize: 11, color: T.fog, fontFamily: "var(--font-mono)" }}>CNPJ {maskCNPJ(brokerage.cnpj)}</span>}
            {brokerage.creci && <span style={{ fontSize: 11, color: T.fog, fontFamily: "var(--font-mono)" }}>CRECI {brokerage.creci}</span>}
            <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: brokerage.status === "active" ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)", color: brokerage.status === "active" ? "#4ADE80" : "#F87171" }}>{brokerage.status === "active" ? "Ativa" : "Inativa"}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!editing && canManage && <button type="button" onClick={() => { setEditing(true); setForm({}); }} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.bone, fontSize: 13, cursor: "pointer", minHeight: 44 }}>Editar</button>}
          {editing && <button type="button" onClick={() => { setEditing(false); setForm({}); }} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 13, cursor: "pointer" }}>Cancelar</button>}
          {editing && <button type="button" onClick={handleSave} disabled={saving} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: T.sprout, color: "var(--interactive-on-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{saving ? "Salvando..." : "Salvar"}</button>}
        </div>
      </div>

      {/* 2 columns */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr", gap: 24, marginBottom: 32 }}>
        {/* LEFT */}
        <div>
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
              <div><label style={LBL}>Telefone</label>{editing ? <input style={IS} value={maskPhone(f("telefone"))} onChange={(e) => setF("telefone", e.target.value.replace(/\D/g, "").slice(0, 11))} maxLength={15} /> : <div style={{ fontSize: 14, color: T.bone }}>{brokerage.telefone ? maskPhone(brokerage.telefone) : "—"}</div>}</div>
              <div><label style={LBL}>Email</label>{editing ? <input type="email" style={IS} value={f("email")} onChange={(e) => setF("email", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{brokerage.email || "—"}</div>}</div>
              <div style={{ gridColumn: isMobile ? "1" : "1 / -1" }}><label style={LBL}>Endereço</label>{editing ? <input style={IS} value={f("endereco")} onChange={(e) => setF("endereco", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{brokerage.endereco || "—"}</div>}</div>
              <div><label style={LBL}>Bairro</label>{editing ? <input style={IS} value={f("bairro")} onChange={(e) => setF("bairro", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{brokerage.bairro || "—"}</div>}</div>
              <div><label style={LBL}>Cidade</label>{editing ? <input style={IS} value={f("cidade")} onChange={(e) => setF("cidade", e.target.value)} /> : <div style={{ fontSize: 14, color: T.bone }}>{brokerage.cidade || "—"}</div>}</div>
              <div><label style={LBL}>UF</label>{editing ? <NexaSelect value={f("uf")} onChange={(v) => setF("uf", v)} options={[{ value: "", label: "—" }, ...UF_OPTIONS.map((u) => ({ value: u, label: u }))]} ariaLabel="UF" /> : <div style={{ fontSize: 14, color: T.bone }}>{brokerage.uf || "—"}</div>}</div>
              {editing && <div style={{ gridColumn: isMobile ? "1" : "1 / -1" }}><label style={LBL}>Observações</label><textarea rows={3} style={{ ...IS, resize: "vertical" }} value={f("observacoes")} onChange={(e) => setF("observacoes", e.target.value)} /></div>}
              {!editing && brokerage.observacoes && <div style={{ gridColumn: isMobile ? "1" : "1 / -1" }}><label style={LBL}>Observações</label><div style={{ fontSize: 14, color: T.bone, whiteSpace: "pre-wrap" }}>{brokerage.observacoes}</div></div>}
            </div>
          )}

          {/* Tab: Corretores */}
          {tab === "corretores" && (
            <div>
              <div style={{ display: "grid", gap: 8 }}>
                {brokers.map((b) => (
                  <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: T.carbon, border: `1px solid ${T.stone}`, borderLeft: b.is_manager ? "3px solid var(--interactive-primary)" : undefined, borderRadius: b.is_manager ? "0 10px 10px 0" : 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface-overlay)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: T.fog, flexShrink: 0 }}>{b.name.charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Link to={`/corretores/${b.id}`} style={{ fontSize: 14, fontWeight: 500, color: T.bone, textDecoration: "none" }}>{b.name}</Link>
                        {b.is_manager && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", color: T.sprout, background: "rgba(74,222,128,0.08)", padding: "2px 6px", borderRadius: 4, fontFamily: "var(--font-mono)" }}>GESTOR</span>}
                      </div>
                      <div style={{ fontSize: 11, color: T.fog }}>{b.creci ? `CRECI ${b.creci}` : "Sem CRECI"}{b.phone ? ` · ${maskPhone(b.phone)}` : ""}</div>
                    </div>
                    <span style={{ fontSize: 11, color: b.status === "active" ? "#4ADE80" : T.slate, flexShrink: 0 }}>{b.status === "active" ? "Ativo" : "Inativo"}</span>
                    {canManage && (
                      <div style={{ position: "relative" }}>
                        <button type="button" onClick={() => setMenuBrokerId(menuBrokerId === b.id ? null : b.id)} style={{ background: "none", border: "none", color: T.fog, fontSize: 18, cursor: "pointer", padding: "2px 8px" }}>⋮</button>
                        {menuBrokerId === b.id && <>
                          <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={() => setMenuBrokerId(null)} />
                          <div style={{ position: "absolute", right: 0, top: 28, background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8, zIndex: 50, minWidth: 180, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", padding: 4 }}>
                            <button type="button" onClick={() => handleToggleManager(b.id, b.is_manager, b.profile_id)} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", color: b.is_manager ? T.fog : T.sprout, fontSize: 13, padding: "8px 14px", cursor: "pointer", borderRadius: 6 }}>{b.is_manager ? "Remover gestor" : "Definir como gestor"}</button>
                            <button type="button" onClick={() => handleUnlinkBroker(b.id)} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", color: T.red, fontSize: 13, padding: "8px 14px", cursor: "pointer", borderRadius: 6 }}>Desvincular</button>
                          </div>
                        </>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {canManage && (
                <button type="button" onClick={openVinculaModal} style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", border: `1px dashed ${T.stone}`, borderRadius: 8, background: "transparent", color: T.fog, fontSize: 13, cursor: "pointer", width: "100%", minHeight: 44 }}>
                  <span style={{ fontSize: 16 }}>+</span> Vincular corretor
                </button>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — KPIs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: T.slate, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>Métricas da imobiliária</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { l: "Corretores", v: brokers.filter((b) => b.status === "active").length.toString() },
                { l: "Neg. ativas", v: kpis.negsAtivas.toString() },
                { l: "Propostas/mês", v: kpis.propostasMes.toString() },
                { l: "Vendas/mês", v: kpis.vendasMes.toString() },
              ].map((k) => (
                <div key={k.l}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: T.slate, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 3 }}>{k.l}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: T.chalk, fontFamily: "var(--font-mono)" }}>{k.v}</div>
                </div>
              ))}
            </div>
            {kpis.vgvMes > 0 && <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.stone}`, fontSize: 12, color: T.fog }}>VGV no mês: <strong style={{ color: T.sprout }}>{fmtR(kpis.vgvMes)}</strong></div>}
          </div>

          {/* Gestor(es) */}
          <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: T.slate, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Gestor(es)</div>
            {gestores.length === 0 ? (
              <div style={{ fontSize: 13, color: T.slate }}>Nenhum gestor definido</div>
            ) : gestores.map((g) => (
              <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(74,222,128,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: T.sprout }}>{g.name.charAt(0)}</div>
                <span style={{ fontSize: 13, color: T.bone }}>{g.name}</span>
              </div>
            ))}
          </div>

          {/* Created info */}
          <div style={{ fontSize: 11, color: T.slate, textAlign: "center" }}>
            Cadastrada em {formatDateBRT(brokerage.created_at)}
          </div>
        </div>
      </div>

      {/* Vincular modal */}
      {vinculaModal && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 9000 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} onClick={() => setVinculaModal(false)} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 14, padding: 24, width: 440, maxWidth: "90vw", zIndex: 1 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.chalk, margin: "0 0 16px" }}>Vincular corretor</h3>
            {availableBrokers.length === 0 ? (
              <div style={{ fontSize: 13, color: T.slate, marginBottom: 16 }}>Nenhum corretor disponível sem imobiliária.</div>
            ) : (
              <>
                <label style={LBL}>Corretor</label>
                <div style={{ marginBottom: 16 }}><NexaSelect value={selectedBrokerId} onChange={(v) => setSelectedBrokerId(v)} options={availableBrokers.map((b) => ({ value: b.id, label: b.name }))} placeholder="Selecionar corretor..." ariaLabel="Corretor" /></div>
              </>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              {availableBrokers.length > 0 && <button type="button" onClick={handleVincular} disabled={!selectedBrokerId} style={{ flex: 1, padding: "10px", borderRadius: 8, background: T.sprout, color: "var(--interactive-on-primary)", border: "none", fontSize: 13, fontWeight: 600, cursor: selectedBrokerId ? "pointer" : "not-allowed", opacity: selectedBrokerId ? 1 : 0.5 }}>Vincular</button>}
              <button type="button" onClick={() => setVinculaModal(false)} style={{ padding: "10px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.fog, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
            </div>
          </div>
        </div>, document.body
      )}

      {/* Toast */}
      {toast && (() => { setTimeout(() => setToast(null), 3000); return <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", background: T.sprout, color: "var(--interactive-on-primary)", padding: "10px 24px", borderRadius: 8, fontSize: 13, fontWeight: 700, zIndex: 10000, animation: "fadeInUp 200ms ease both" }}>{toast}</div>; })()}
    </div>
  );
}
