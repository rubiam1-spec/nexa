import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useAuth } from "../../../app/contexts/AuthContext";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import { useThirdPartyProperties, type ThirdPartyProperty } from "../hooks/useThirdPartyProperties";
import { SearchableSelect } from "../../../shared/components/SearchableSelect";

const T = { ink: "var(--surface-base)", carbon: "var(--surface-raised)", stone: "var(--border-default)", chalk: "var(--text-primary)", bone: "var(--text-secondary)", fog: "var(--text-muted)", slate: "var(--text-disabled)", sprout: "var(--interactive-primary)" };
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  cadastrado: { label: "Cadastrado", color: "#706B5F" }, disponivel: { label: "Disponível", color: "#4ADE80" },
  em_negociacao: { label: "Em negociação", color: "#60A5FA" }, reservado: { label: "Reservado", color: "#FBBF24" },
  vendido: { label: "Vendido", color: "#A78BFA" }, inativo: { label: "Inativo", color: "#F87171" },
};
const TIPO_LABELS: Record<string, string> = { terreno: "Terreno", casa: "Casa", apartamento: "Apartamento", chacara: "Chácara", fazenda: "Fazenda", comercial: "Comercial", sala: "Sala", galpao: "Galpão", outro: "Outro" };
const APPROVAL_BADGES: Record<string, { label: string; bg: string; color: string; border: string }> = {
  pending: { label: "Aguardando aprovação", bg: "rgba(251,191,36,0.08)", color: "#FBBF24", border: "#FBBF24" },
  rejected: { label: "Rejeitado", bg: "rgba(248,113,113,0.08)", color: "#F87171", border: "#F87171" },
  revision: { label: "Em revisão", bg: "rgba(96,165,250,0.08)", color: "#60A5FA", border: "#60A5FA" },
};
const MANAGER_ROLES = new Set(["owner", "director", "manager", "concierge"]);

function KPI({ label, value, color = "#4ADE80", icon, highlight }: { label: string; value: string | number; color?: string; icon?: string; highlight?: boolean }) {
  const accent = highlight ? "#D97706" : color;
  const glyph = icon || label[0].toUpperCase();
  return (
    <div style={{
      position: "relative", overflow: "hidden",
      background: "linear-gradient(145deg, #1F1E1A, #16150F)",
      border: "1px solid rgba(42,40,34,0.5)",
      borderRadius: 10, padding: "14px 16px",
    }}>
      <div aria-hidden style={{
        position: "absolute", top: -15, right: -15, width: 60, height: 60,
        borderRadius: "50%", background: accent + "15", filter: "blur(15px)", pointerEvents: "none",
      }} />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#706B5F", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</span>
          <span style={{
            width: 22, height: 22, borderRadius: 5, background: accent + "18",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: accent,
          }}>{glyph}</span>
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 700, color: "#FAF9F6", marginTop: 6, lineHeight: 1.1 }}>{value}</div>
      </div>
    </div>
  );
}

function PropertyCard({ p, onClick, isManagerRole }: { p: ThirdPartyProperty; onClick: () => void; isManagerRole: boolean }) {
  const st = STATUS_CFG[p.status] || STATUS_CFG.cadastrado;
  const ab = p.approvalStatus !== "approved" ? APPROVAL_BADGES[p.approvalStatus] : null;
  return (
    <div onClick={onClick} style={{
      background: "linear-gradient(145deg, #1F1E1A, #16150F)",
      border: "1px solid rgba(42,40,34,0.5)",
      borderLeft: ab ? `3px solid ${ab.border}` : undefined,
      borderRadius: 12, overflow: "hidden", cursor: "pointer",
      transition: "transform 0.15s, border-color 0.15s, box-shadow 0.15s",
    }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "rgba(74,222,128,0.3)"; e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.3)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = ab ? "rgba(42,40,34,0.5)" : "rgba(42,40,34,0.5)"; e.currentTarget.style.boxShadow = "none"; }}>
      <div style={{ height: 180, background: "var(--surface-overlay)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {p.fotoPrincipalUrl ? <img src={p.fotoPrincipalUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-disabled)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>}
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          {ab && isManagerRole && <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "var(--font-mono)", padding: "3px 8px", borderRadius: 4, background: ab.bg, border: `1px solid ${ab.border}33`, color: ab.color }}>{ab.label}</span>}
          <span style={{ fontSize: 8, fontWeight: 600, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "3px 8px", borderRadius: 4, background: st.color + "1A", border: `1px solid ${st.color}33`, color: st.color }}>{st.label}</span>
          <span style={{ fontSize: 8, fontWeight: 600, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "3px 8px", borderRadius: 4, background: "rgba(112,107,95,0.12)", border: "1px solid rgba(112,107,95,0.25)", color: "#706B5F" }}>{TIPO_LABELS[p.tipo] || p.tipo}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#FAF9F6", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "'DM Sans', sans-serif" }}>{p.titulo}</div>
        {(p.bairro || p.cidade) && <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#9C9686", marginBottom: 8 }}>{[p.bairro, p.cidade ? `${p.cidade}/${p.estado}` : null].filter(Boolean).join(" · ")}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          {p.valorVenda != null && p.valorVenda > 0 ? <span style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: "#4ADE80" }}>{fmt(p.valorVenda)}</span> : <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: T.slate }}>Valor a definir</span>}
          {p.areaM2 != null && p.areaM2 > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#9C9686" }}>{p.areaM2.toLocaleString("pt-BR")} m²</span>}
        </div>
      </div>
    </div>
  );
}

export default function ThirdPartyPropertiesPage() {
  const navigate = useNavigate();
  const { account } = useAccount();
  const { authenticatedProfile } = useAuth();
  const screen = useScreen();
  const isMobile = screen.isMobile;
  const accountId = account?.accountId ?? null;
  const role = (account?.role as string) ?? "";
  const isManagerRole = MANAGER_ROLES.has(role);
  const canCreate = ["owner", "director", "manager", "commercial_consultant", "broker", "concierge"].includes(role);
  const userId = authenticatedProfile?.id ?? null;
  const { properties, loading } = useThirdPartyProperties(accountId, { userId, isManagerRole });

  const [filterTipo, setFilterTipo] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [approvalFilter, setApprovalFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let f = properties;
    if (approvalFilter !== "all") f = f.filter((p) => p.approvalStatus === approvalFilter);
    if (filterTipo !== "all") f = f.filter((p) => p.tipo === filterTipo);
    if (filterStatus !== "all") f = f.filter((p) => p.status === filterStatus);
    if (search.trim()) { const q = search.toLowerCase(); f = f.filter((p) => p.titulo.toLowerCase().includes(q) || (p.bairro || "").toLowerCase().includes(q) || (p.endereco || "").toLowerCase().includes(q)); }
    return f;
  }, [properties, filterTipo, filterStatus, approvalFilter, search]);

  // KPI counts
  const pendingCount = properties.filter((p) => p.approvalStatus === "pending").length;
  const approved = properties.filter((p) => p.approvalStatus === "approved" && p.status !== "inativo");
  const disponivel = approved.filter((p) => p.status === "disponivel").length;
  const emNeg = approved.filter((p) => p.status === "em_negociacao").length;
  const totalValor = approved.filter((p) => p.status !== "vendido").reduce((s, p) => s + (p.valorVenda || 0), 0);

  if (loading) return <div className="nexa-page-enter" style={{ maxWidth: 960, margin: "0 auto" }}><div className="nexa-skeleton" style={{ height: 24, width: 200, marginBottom: 20, borderRadius: 8 }} /><div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 8, marginBottom: 24 }}>{[1,2,3,4].map(i => <div key={i} className="nexa-skeleton nexa-skeleton-kpi" />)}</div><div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 16 }}>{[1,2,3].map(i => <div key={i} className="nexa-skeleton nexa-skeleton-card" style={{ height: 280 }} />)}</div></div>;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", paddingBottom: isMobile ? "calc(72px + env(safe-area-inset-bottom))" : undefined }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontSize: isMobile ? 22 : 28, fontWeight: 400, color: T.bone, margin: 0 }}>Imóveis de Terceiros</h1>
          <div style={{ fontSize: 13, color: T.fog, marginTop: 4 }}>{approved.length} imóveis aprovados na carteira</div>
        </div>
        {canCreate && <button type="button" onClick={() => navigate("/imoveis/novo")} style={{ background: T.sprout, color: "var(--interactive-on-primary)", border: "none", borderRadius: 8, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Cadastrar imóvel</button>}
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 8, marginBottom: 20 }}>
        {isManagerRole ? (
          <>
            <div style={{ animation: "fadeInUp 300ms cubic-bezier(0.16,1,0.3,1) both" }}><KPI label="Pendentes" value={pendingCount} color="#D97706" icon="P" highlight={pendingCount > 0} /></div>
            <div style={{ animation: "fadeInUp 300ms cubic-bezier(0.16,1,0.3,1) both", animationDelay: "50ms" }}><KPI label="Aprovados" value={approved.length} color="#4ADE80" icon="A" /></div>
            <div style={{ animation: "fadeInUp 300ms cubic-bezier(0.16,1,0.3,1) both", animationDelay: "100ms" }}><KPI label="Disponiveis" value={disponivel} color="#60A5FA" icon="D" /></div>
            <div style={{ animation: "fadeInUp 300ms cubic-bezier(0.16,1,0.3,1) both", animationDelay: "150ms" }}><KPI label="Valor total" value={fmt(totalValor)} color="#A78BFA" icon="$" /></div>
          </>
        ) : (
          <>
            <div style={{ animation: "fadeInUp 300ms cubic-bezier(0.16,1,0.3,1) both" }}><KPI label="Em carteira" value={approved.length} color="#4ADE80" icon="C" /></div>
            <div style={{ animation: "fadeInUp 300ms cubic-bezier(0.16,1,0.3,1) both", animationDelay: "50ms" }}><KPI label="Disponiveis" value={disponivel} color="#60A5FA" icon="D" /></div>
            <div style={{ animation: "fadeInUp 300ms cubic-bezier(0.16,1,0.3,1) both", animationDelay: "100ms" }}><KPI label="Em negociacao" value={emNeg} color="#FBBF24" icon="N" /></div>
            <div style={{ animation: "fadeInUp 300ms cubic-bezier(0.16,1,0.3,1) both", animationDelay: "150ms" }}><KPI label="Valor total" value={fmt(totalValor)} color="#A78BFA" icon="$" /></div>
          </>
        )}
      </div>

      {/* Filters — single row */}
      {(() => {
        const focusIn = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = "rgba(74,222,128,0.25)"; };
        const focusOut = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = "rgba(42,40,34,0.5)"; };
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {isManagerRole && ([["all", "Todos"], ["pending", `Pendentes${pendingCount > 0 ? ` (${pendingCount})` : ""}`], ["approved", "Aprovados"], ["revision", "Em revisão"]] as const).map(([val, label]) => {
              const active = approvalFilter === val;
              const isPending = val === "pending" && pendingCount > 0;
              return <button key={val} type="button" onClick={() => setApprovalFilter(val)} style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, border: active ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(42,40,34,0.5)", background: active ? "rgba(74,222,128,0.08)" : "transparent", color: active ? T.sprout : isPending ? "#FBBF24" : "#9C9686", cursor: "pointer" }}>{label}</button>;
            })}
            {isManagerRole && <div style={{ width: 1, height: 24, background: "rgba(42,40,34,0.4)" }} />}
            <div style={{ minWidth: 160 }}>
              <SearchableSelect
                options={Object.entries(TIPO_LABELS).map(([k, l]) => ({ value: k, label: l }))}
                value={filterTipo === "all" ? "" : filterTipo}
                onChange={(v) => setFilterTipo(v || "all")}
                placeholder="Buscar tipo..."
                emptyOptionLabel="Todos os tipos"
              />
            </div>
            <div style={{ minWidth: 160 }}>
              <SearchableSelect
                options={Object.entries(STATUS_CFG).filter(([k]) => k !== "inativo").map(([k, v]) => ({ value: k, label: v.label }))}
                value={filterStatus === "all" ? "" : filterStatus}
                onChange={(v) => setFilterStatus(v || "all")}
                placeholder="Buscar status..."
                emptyOptionLabel="Todos os status"
              />
            </div>
            <div style={{ flex: 1 }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} onFocus={focusIn} onBlur={focusOut} placeholder="Buscar por título, bairro..." style={{
              padding: "6px 12px", borderRadius: 8, minWidth: 200, maxWidth: 280,
              background: "linear-gradient(145deg, #1F1E1A, #16150F)",
              border: "1px solid rgba(42,40,34,0.5)",
              color: "#FAF9F6", fontFamily: "var(--font-mono)", fontSize: 10,
              outline: "none", transition: "border-color 0.15s",
            }} />
          </div>
        );
      })()}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <svg width="64" height="64" viewBox="0 0 512 512" style={{ opacity: 0.08, marginBottom: 16 }}><path d="M40 0H370L512 142V472Q512 512 472 512H40Q0 512 0 472V40Q0 0 40 0Z" fill="currentColor"/><polygon points="148,380 148,132 200,132 316,308 316,132 364,132 364,380 316,380 200,204 200,380" fill="currentColor"/></svg>
          <div style={{ fontSize: 14, color: T.fog, marginBottom: 8 }}>{properties.length === 0 ? "Nenhum imóvel cadastrado" : "Nenhum imóvel encontrado para esses filtros"}</div>
          {canCreate && properties.length === 0 && <button type="button" onClick={() => navigate("/imoveis/novo")} style={{ background: T.sprout, color: "var(--interactive-on-primary)", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 8 }}>Cadastrar primeiro imóvel</button>}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16 }}>
          {filtered.map((p, i) => <div key={p.id} style={{ animation: "fadeInUp 300ms cubic-bezier(0.16,1,0.3,1) both", animationDelay: `${Math.min(i * 40, 200)}ms` }}><PropertyCard p={p} onClick={() => navigate(`/imoveis/${p.id}`)} isManagerRole={isManagerRole} /></div>)}
        </div>
      )}
    </div>
  );
}
