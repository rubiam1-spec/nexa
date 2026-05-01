import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useBrokerages } from "../hooks/useBrokerages";
import { createBrokerage } from "../../../infra/repositories/brokeragesSupabaseRepository";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import { usePermissions } from "../../../shared/hooks/usePermissions";
const btnP: React.CSSProperties = { background: "var(--color-sprout)", color: "var(--color-ink)", border: "none", borderRadius: 8, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 700, cursor: "pointer" };
const btnS: React.CSSProperties = { background: "transparent", color: "var(--color-bone)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 700, cursor: "pointer" };

function maskCNPJ(v: string) { return v.replace(/\D/g, "").replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d)/, "$1-$2").slice(0, 18); }
function maskPhone(v: string) { return v.replace(/\D/g, "").replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4,5})(\d{4})$/, "$1-$2").slice(0, 15); }

const SMALL_WORDS = new Set(["de", "do", "da", "dos", "das", "e", "em", "a", "o"]);
const ACRONYMS = new Set(["ltda", "me", "epp", "sa", "s.a", "eireli"]);
function capitalizeCompanyName(str: string): string {
  if (!str) return "";
  return str.toLowerCase().split(/\s+/).filter(Boolean).map((w, i) => {
    if (ACRONYMS.has(w.replace(/[.,]/g, ""))) return w.toUpperCase();
    if (i > 0 && SMALL_WORDS.has(w)) return w;
    if (w.length <= 2 && /^[a-z]+$/.test(w)) return w.toUpperCase();
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(" ");
}
function getBrokerageInitials(name: string): string {
  const clean = (name ?? "").trim();
  if (!clean) return "??";
  return clean.substring(0, 2).toUpperCase();
}

export default function BrokeragesPage() {
  const navigate = useNavigate();
  const { account, errorMessage: accountError, isUsingMock, status: accountStatus } = useAccount();
  const { brokerages: brokeragesFromHook, errorMessage, isLoading, status } = useBrokerages(account?.accountId ?? null, isUsingMock);
  const [brokerages_local, setBrokerages_local] = useState<typeof brokeragesFromHook>([]);
  const [localInit, setLocalInit] = useState(false);
  useEffect(() => { if (brokeragesFromHook.length > 0 && !localInit) { setBrokerages_local(brokeragesFromHook); setLocalInit(true); } }, [brokeragesFromHook, localInit]);
  const brokerages = localInit ? brokerages_local : brokeragesFromHook;
  const accountId = account?.accountId ?? null;
  const isMobile = useScreen().isMobile;
  const { can } = usePermissions();
  const canManageBrokerages = can("can_manage_brokerages");

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState(""); const [cnpj, setCnpj] = useState(""); const [creci, setCreci] = useState("");
  const [responsavel, setResponsavel] = useState(""); const [phone, setPhone] = useState(""); const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; brokerCount: number } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [brokerCounts, setBrokerCounts] = useState<Record<string, number>>({});

  // Fetch broker counts per brokerage
  useEffect(() => {
    if (!supabase || !accountId || brokerages.length === 0) return;
    const ids = brokerages.map((b) => b.id);
    supabase.from("brokers").select("brokerage_id").eq("account_id", accountId).in("brokerage_id", ids).then(({ data }) => {
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r: Record<string, unknown>) => { const bid = r.brokerage_id as string; counts[bid] = (counts[bid] || 0) + 1; });
      setBrokerCounts(counts);
    });
  }, [accountId, brokerages]);

  async function buscarCNPJ(raw: string) {
    if (raw.length !== 14) return;
    setCnpjLoading(true);
    try {
      // Tentar BrasilAPI primeiro, ReceitaWS como fallback
      let d: Record<string, unknown> | null = null;
      try {
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${raw}`);
        if (res.ok) d = await res.json();
      } catch { /* fallback */ }
      if (!d) {
        try {
          const res2 = await fetch(`https://receitaws.com.br/v1/cnpj/${raw}`);
          if (res2.ok) { const r = await res2.json(); if (r.status !== "ERROR") d = r; }
        } catch { /* silencioso */ }
      }
      if (d) {
        const fantasia = (d.nome_fantasia as string) || (d.fantasia as string) || "";
        const razao = (d.razao_social as string) || (d.nome as string) || "";
        const tel = (d.ddd_telefone_1 as string) || (d.telefone as string) || "";
        const mun = (d.municipio as string) || "";
        if (fantasia) setName(fantasia);
        else if (razao) setName(razao);
        if (tel) setPhone(tel.replace(/\D/g, ""));
        if (mun) setCity(mun);
        if (razao) setResponsavel(razao);
      }
    } catch { /* silencioso */ }
    finally { setCnpjLoading(false); }
  }

  const [toast, setToast] = useState<string | null>(null);

  async function handleDelete() {
    if (!deleteTarget || !supabase) return;
    setDeleting(true);
    try {
      if (deleteTarget.brokerCount > 0) {
        const { error: upErr } = await supabase.from("brokers").update({ brokerage_id: null, brokerage_name: null }).eq("brokerage_id", deleteTarget.id);
        if (upErr) throw upErr;
      }
      const { error } = await supabase.from("brokerages").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      // Optimistic: remove from local list without reload
      setBrokerages_local((prev) => prev.filter((b) => b.id !== deleteTarget.id));
      setDeleteTarget(null);
      setToast("Imobiliária excluída ✓");
      setTimeout(() => setToast(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir";
      setToast("Erro: " + msg);
      setTimeout(() => setToast(null), 4000);
      setDeleteTarget(null);
    }
    finally { setDeleting(false); }
  }

  async function handleSave() {
    if (!accountId || !name.trim()) return;
    setSaving(true); setErr(null);
    try {
      const b = await createBrokerage({ accountId, name: name.trim(), email: "", phone: phone.replace(/\D/g, ""), city: city.trim(), cnpj: cnpj.replace(/\D/g, "") || undefined });
      // Update creci + responsavel directly if provided
      if (supabase && (creci.trim() || responsavel.trim())) {
        await supabase.from("brokerages").update({ creci: creci.trim() || null, responsavel: responsavel.trim() || null }).eq("id", b.id);
      }
      navigate(`/imobiliarias/${b.id}`);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Falha ao criar."); }
    finally { setSaving(false); }
  }

  if (isLoading) return <p style={{ color: "var(--color-fog)" }}>Carregando imobiliárias...</p>;
  if (accountStatus === "no_access" || accountStatus === "error") return <p style={{ color: "var(--color-fog)" }}>{accountError ?? "Conta indisponível."}</p>;
  if (status === "error") return <p style={{ color: "var(--color-red)" }}>{errorMessage}</p>;
  if (status === "idle") return <p style={{ color: "var(--color-fog)" }}>Selecione uma conta para continuar.</p>;

  const filtered = busca ? brokerages.filter((b) => {
    const t = busca.toLowerCase();
    return b.name.toLowerCase().includes(t) || (b.cnpj || "").includes(t) || (b.city || "").toLowerCase().includes(t);
  }) : brokerages;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontSize: 28, fontWeight: 400, color: "var(--color-bone)", margin: 0, lineHeight: 1.1 }}>Imobiliárias</h1>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-fog)", marginTop: 6, letterSpacing: "0.03em" }}>
            {brokerages.length} registros · {brokerages.filter((b) => b.status === "active").length} ativas · {brokerages.filter((b) => (brokerCounts[b.id] || 0) > 0).length} com corretores vinculados
          </div>
        </div>
        {canManageBrokerages ? (
          <button type="button" onClick={() => setShowForm((p) => !p)} style={showForm ? btnS : btnP}>{showForm ? "Cancelar" : "Nova imobiliária"}</button>
        ) : null}
      </div>

      {/* Quick create form */}
      {showForm && (
        <div className="nexa-card" style={{ marginBottom: 24 }}>
          <div className="nexa-label" style={{ marginBottom: 12 }}>Cadastro rápido</div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <label style={{ flex: 2, minWidth: 140 }}><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Nome *</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da imobiliária" /></label>
            <label style={{ flex: 1.5, minWidth: 130 }}><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>CNPJ {cnpjLoading && <span style={{ fontSize: 9, color: "var(--color-fog)" }}>buscando...</span>}</span><input type="text" value={maskCNPJ(cnpj)} onChange={(e) => { const raw = e.target.value.replace(/\D/g, "").slice(0, 14); setCnpj(raw); if (raw.length === 14) buscarCNPJ(raw); }} maxLength={18} placeholder="00.000.000/0000-00" /></label>
            <label style={{ flex: 1, minWidth: 100 }}><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>CRECI-J</span><input type="text" value={creci} onChange={(e) => setCreci(e.target.value)} placeholder="00000/UF" /></label>
            <label style={{ flex: 1.5, minWidth: 120 }}><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Responsável</span><input type="text" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Nome" /></label>
            <label style={{ flex: 1, minWidth: 110 }}><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Telefone</span><input type="tel" value={maskPhone(phone)} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))} maxLength={15} placeholder="(00) 00000-0000" /></label>
            <label style={{ flex: 1, minWidth: 100 }}><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Cidade</span><input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" /></label>
            <button type="button" disabled={!name.trim() || saving} onClick={() => void handleSave()} style={{ ...btnP, whiteSpace: "nowrap", flexShrink: 0 }}>{saving ? "..." : "Salvar ✓"}</button>
          </div>
          {err && <p style={{ color: "var(--color-red)", fontSize: 12, marginTop: 8 }}>{err}</p>}
          <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 8 }}>Dados completos ficam na ficha da imobiliária.</div>
        </div>
      )}

      {/* Search */}
      {brokerages.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, CNPJ ou cidade..." style={{ background: "var(--surface-raised)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "8px 14px", color: "var(--color-bone)", fontSize: 13, outline: "none", width: "100%", maxWidth: 360 }} />
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="nexa-card" style={{ textAlign: "center", padding: 24 }}><p style={{ color: "var(--color-fog)", fontSize: 13 }}>Nenhuma imobiliária encontrada.</p></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map((b) => {
            const isInactive = b.status !== "active";
            const brokerCount = brokerCounts[b.id] || 0;
            const displayName = capitalizeCompanyName(b.name);
            return (
              <div
                key={b.id}
                onClick={() => navigate(`/imobiliarias/${b.id}`)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px", cursor: "pointer",
                  background: "linear-gradient(145deg, var(--surface-raised), var(--surface-base))",
                  border: "1px solid var(--border-default)",
                  borderRadius: 10, position: "relative",
                  opacity: isInactive ? 0.55 : 1,
                  transition: "border-color 0.15s, transform 0.1s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(74,222,128,0.25)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.transform = "none"; }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: "rgba(74,222,128,0.08)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "#4ADE80",
                }}>
                  {getBrokerageInitials(b.name)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {displayName}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {b.city || "—"}
                    {(b as Record<string, unknown>).creci ? ` · CRECI ${(b as Record<string, unknown>).creci as string}` : ""}
                    {b.cnpj ? ` · ${maskCNPJ(b.cnpj)}` : ""}
                  </div>
                </div>

                {!isMobile && (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", minWidth: 110, textAlign: "right" }}>
                    {b.phone ? maskPhone(b.phone) : "—"}
                  </div>
                )}

                <div style={{ textAlign: "center", minWidth: 60, flexShrink: 0 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: brokerCount > 0 ? "var(--text-primary)" : "var(--text-muted)", lineHeight: 1 }}>
                    {brokerCount}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--text-muted)", marginTop: 2, letterSpacing: "0.05em" }}>
                    corretor{brokerCount !== 1 ? "es" : ""}
                  </div>
                </div>

                {isInactive && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, color: "#F87171", background: "rgba(248,113,113,0.12)", padding: "2px 8px", borderRadius: 4, letterSpacing: "0.08em", flexShrink: 0 }}>
                    INATIVA
                  </span>
                )}

                {canManageBrokerages ? (
                  <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", flexShrink: 0 }}>
                    <button type="button" onClick={() => setMenuOpen(menuOpen === b.id ? null : b.id)} style={{ background: "none", border: "none", color: "var(--color-fog)", fontSize: 18, cursor: "pointer", padding: "4px 8px", lineHeight: 1, borderRadius: 6 }}>⋮</button>
                    {menuOpen === b.id && (
                      <>
                        <div style={{ position: "fixed", inset: 0, zIndex: 9998 }} onClick={() => setMenuOpen(null)} />
                        <div style={{ position: "absolute", right: 0, top: 32, background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 8, zIndex: 9999, minWidth: 140, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
                          <button type="button" onClick={() => { setMenuOpen(null); navigate(`/imobiliarias/${b.id}`); }} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", color: "var(--color-bone)", fontSize: 13, padding: "8px 16px", cursor: "pointer", borderRadius: "8px 8px 0 0" }}>Editar</button>
                          <button type="button" onClick={() => { setMenuOpen(null); setDeleteTarget({ id: b.id, name: b.name, brokerCount }); }} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", color: "#F87171", fontSize: 13, padding: "8px 16px", cursor: "pointer", borderRadius: "0 0 8px 8px" }}>Excluir</button>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {/* Delete modal */}
      {deleteTarget && createPortal(
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9000 }} onClick={() => setDeleteTarget(null)} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "var(--surface-base)", border: "1px solid var(--color-stone)", borderRadius: 14, padding: 24, width: 400, maxWidth: "90vw", zIndex: 9001 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-bone)", marginBottom: 8 }}>Excluir imobiliária</div>
            <div style={{ fontSize: 13, color: "var(--color-fog)", marginBottom: 20, lineHeight: 1.6 }}>
              Excluir <strong style={{ color: "var(--color-bone)" }}>{deleteTarget.name}</strong>?
              {deleteTarget.brokerCount > 0 && <><br /><span style={{ color: "#FBBF24" }}>⚠ {deleteTarget.brokerCount} corretor{deleteTarget.brokerCount > 1 ? "es" : ""} vinculado{deleteTarget.brokerCount > 1 ? "s" : ""} ficará{deleteTarget.brokerCount > 1 ? "ão" : ""} sem imobiliária.</span></>}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setDeleteTarget(null)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--color-stone)", background: "transparent", color: "var(--color-bone)", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button type="button" onClick={handleDelete} disabled={deleting} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#F87171", color: "var(--interactive-on-primary)", fontSize: 13, fontWeight: 600, cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.6 : 1 }}>{deleting ? "Excluindo..." : "Excluir"}</button>
            </div>
          </div>
        </>,
        document.body,
      )}
      {toast && <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", background: toast.startsWith("Erro") ? "#F87171" : "var(--color-sprout)", color: toast.startsWith("Erro") ? "#fff" : "var(--color-ink)", padding: "10px 24px", borderRadius: 8, fontSize: 13, fontWeight: 700, zIndex: 10000, boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>{toast}</div>}
    </div>
  );
}
