import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useAuth } from "../../../app/contexts/AuthContext";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import { useContatos, type ContatoFilters } from "../hooks/useContatos";
import { useClientFilter } from "../../../shared/hooks/useClientFilter";
import { podeVerTodasNegociacoes } from "../../../shared/utils/permissoes";
import { supabase } from "../../../infra/supabase/supabaseClient";
import {
  CLIENT_STATUS_LABELS, CLIENT_STATUS_COLORS,
  CLIENT_SOURCE_LABELS,
  type ClientStatus, type ClientTemperature,
} from "../../../shared/types/client";
import { secureMaskCPF } from "../../../lib/security";
import { formatDateBRT } from "../../../shared/utils/dateUtils";

function Badge({ label, color }: { label: string; color: string }) {
  return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: color + "18", color, border: `1px solid ${color}30`, whiteSpace: "nowrap" }}>{label}</span>;
}

function TempBadge({ temp }: { temp: ClientTemperature }) {
  const cfg: Record<ClientTemperature, { label: string; bg: string; color: string; glow: string }> = {
    hot: { label: "Quente", bg: "rgba(248,113,113,0.12)", color: "#F87171", glow: "0 0 8px rgba(248,113,113,0.4)" },
    warm: { label: "Morno", bg: "rgba(251,191,36,0.12)", color: "#FBBF24", glow: "0 0 8px rgba(251,191,36,0.3)" },
    cold: { label: "Frio", bg: "rgba(96,165,250,0.12)", color: "#60A5FA", glow: "none" },
  };
  const c = cfg[temp];
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: c.bg, fontSize: 12, fontWeight: 600, color: c.color, whiteSpace: "nowrap", flexShrink: 0 }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: c.color, boxShadow: c.glow, flexShrink: 0 }} />
      {c.label}
    </div>
  );
}

const FSEL: React.CSSProperties = {
  width: "100%", padding: "10px 36px 10px 12px", borderRadius: 10,
  border: "1px solid var(--border-default)", background: "var(--surface-base)",
  color: "var(--text-primary)", fontSize: 13, outline: "none", cursor: "pointer",
  boxSizing: "border-box",
  appearance: "none", WebkitAppearance: "none" as never, MozAppearance: "none" as never,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath d='M2 3l3 4 3-4' fill='none' stroke='%239C9686' stroke-width='1.5'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
};

export default function ContatosPage() {
  const navigate = useNavigate();
  const [qp] = useSearchParams();
  const { account } = useAccount();
  const { authenticatedProfile } = useAuth();
  const screen = useScreen();
  const isMobile = !screen.isDesktop;
  const accountId = account?.accountId ?? null;
  const userRole = authenticatedProfile?.role ?? null;
  const userId = authenticatedProfile?.id ?? null;
  const canSeeAll = podeVerTodasNegociacoes(userRole);
  const clientFilter = useClientFilter();

  const initialTab = qp.get("tab") ?? "all";
  const [filters, setFilters] = useState<ContatoFilters>({});
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [activeView, setActiveView] = useState<string>(initialTab);
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [teamMembers, setTeamMembers] = useState<{ userId: string; name: string }[]>([]);

  useEffect(() => {
    if (!supabase || !accountId) return;
    supabase.from("user_account_access").select("user_id, profiles!inner(name)").eq("account_id", accountId).then(({ data }) => {
      setTeamMembers((data ?? []).map((d: Record<string, unknown>) => { const p = (Array.isArray(d.profiles) ? d.profiles[0] : d.profiles) as Record<string, unknown>; return { userId: d.user_id as string, name: (p?.name as string) ?? "—" }; }));
    });
  }, [accountId]);

  function handleSearch(v: string) {
    setSearch(v);
    if (searchTimer) clearTimeout(searchTimer);
    const t = setTimeout(() => setSearchDebounced(v), 300);
    setSearchTimer(t);
  }

  const effectiveFilters = useMemo<ContatoFilters>(() => {
    const f: ContatoFilters = { ...filters };
    if (searchDebounced) f.search = searchDebounced;
    return f;
  }, [filters, searchDebounced]);

  const ownerFilter = !canSeeAll && userId ? clientFilter : undefined;
  const { contatos: allContatos, isLoading, status, errorMessage } = useContatos(accountId, effectiveFilters, ownerFilter);

  const contatos = useMemo(() => {
    let result = allContatos;
    if (activeView === "leads") result = result.filter((c) => ["new", "contacted", "qualifying"].includes(c.status));
    if (activeView === "qualified") result = result.filter((c) => c.status === "qualified" || c.status === "nurturing");
    if (activeView === "negotiating") result = result.filter((c) => c.status === "negotiating" || c.status === "active");
    if (activeView === "converted") result = result.filter((c) => c.status === "converted");
    if (activeView === "lost") result = result.filter((c) => c.status === "lost");
    if (activeView === "hot") result = result.filter((c) => c.temperature === "hot");
    if (activeView === "overdue") result = result.filter((c) => c.nextFollowUpAt && new Date(c.nextFollowUpAt) < new Date());
    return result;
  }, [allContatos, activeView]);

  const views = [
    { key: "all", label: "Todos", count: allContatos.length },
    { key: "leads", label: "Leads", count: allContatos.filter((c) => ["new", "contacted", "qualifying"].includes(c.status)).length },
    { key: "qualified", label: "Qualificados", count: allContatos.filter((c) => c.status === "qualified" || c.status === "nurturing").length },
    { key: "negotiating", label: "Em negociação", count: allContatos.filter((c) => c.status === "negotiating" || c.status === "active").length },
    { key: "converted", label: "Convertidos", count: allContatos.filter((c) => c.status === "converted").length },
    { key: "lost", label: "Perdidos", count: allContatos.filter((c) => c.status === "lost").length },
    { key: "hot", label: "Quentes", count: allContatos.filter((c) => c.temperature === "hot").length },
    { key: "overdue", label: "Follow-up", count: allContatos.filter((c) => c.nextFollowUpAt && new Date(c.nextFollowUpAt) < new Date()).length },
  ];

  const hasActiveFilters = !!(filters.status || filters.temperature || filters.origin || filters.assignedTo || filters.period || filters.city);
  const activeFilterCount = [filters.status, filters.temperature, filters.origin, filters.assignedTo, filters.period, filters.city].filter(Boolean).length;
  const PERIOD_LABELS: Record<string, string> = { today: "Hoje", "7d": "Últimos 7 dias", "30d": "Últimos 30 dias", "90d": "Últimos 90 dias", this_month: "Este mês", last_month: "Mês passado" };

  // Export
  async function handleExport() {
    if (!supabase || !accountId) return;
    setExporting(true);
    try {
      let query = supabase.from("clients").select("name, full_name, phone, email, cpf, city, uf, origin, status, temperature, score, created_at, last_interaction_at").eq("account_id", accountId).is("deleted_at", null);
      if (filters.status) query = query.eq("status", filters.status);
      if (filters.temperature) query = query.eq("temperature", filters.temperature);
      if (filters.origin) query = query.eq("origin", filters.origin);
      if (filters.assignedTo) query = query.eq("assigned_to", filters.assignedTo);
      if (filters.city) query = query.ilike("city", `%${filters.city}%`);
      if (filters.period) {
        const now = new Date();
        let from: Date | null = null; let to: Date | null = null;
        switch (filters.period) {
          case "today": from = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
          case "7d": from = new Date(now.getTime() - 7 * 864e5); break;
          case "30d": from = new Date(now.getTime() - 30 * 864e5); break;
          case "90d": from = new Date(now.getTime() - 90 * 864e5); break;
          case "this_month": from = new Date(now.getFullYear(), now.getMonth(), 1); break;
          case "last_month": from = new Date(now.getFullYear(), now.getMonth() - 1, 1); to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59); break;
        }
        if (from) query = query.gte("created_at", from.toISOString());
        if (to) query = query.lte("created_at", to.toISOString());
      }
      if (searchDebounced) query = query.or(`name.ilike.%${searchDebounced}%,phone.ilike.%${searchDebounced}%,email.ilike.%${searchDebounced}%`);
      const { data } = await query.order("created_at", { ascending: false }).limit(10000);
      if (!data || data.length === 0) { alert("Nenhum contato encontrado para exportar."); return; }
      const headers = ["Nome", "Telefone", "Email", "CPF", "Cidade", "UF", "Origem", "Status", "Temperatura", "Score", "Criado em"];
      const rows = data.map((c: Record<string, unknown>) => [
        (c.full_name as string) || (c.name as string) || "", c.phone || "", c.email || "", secureMaskCPF(c.cpf as string | null),
        c.city || "", c.uf || "", c.origin || "", c.status || "", c.temperature || "",
        c.score ?? 0, c.created_at ? formatDateBRT(c.created_at as string) : "",
      ]);
      const csvContent = [headers.join(";"), ...rows.map((r: unknown[]) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";"))].join("\n");
      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `contatos_nexa_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  }

  if (isLoading && allContatos.length === 0) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}><div style={{ color: "#4ADE80", fontFamily: "var(--font-mono)", fontSize: 13 }}>Carregando contatos...</div></div>;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Contatos</h1>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{contatos.length} contato{contatos.length !== 1 ? "s" : ""}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {canSeeAll && <button type="button" onClick={() => navigate("/contatos/importar")} style={{ padding: "9px 16px", borderRadius: 10, border: "1.5px solid var(--border-strong)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Importar</button>}
          {canSeeAll && <button type="button" onClick={() => void handleExport()} disabled={exporting} style={{ padding: "9px 16px", borderRadius: 10, border: "1.5px solid var(--border-strong)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{exporting ? "..." : "Exportar"}</button>}
          <button type="button" onClick={() => navigate("/contatos/novo")} style={{ padding: isMobile ? "9px 14px" : "9px 20px", borderRadius: 10, border: "none", background: "var(--interactive-primary)", color: "var(--interactive-on-primary)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{isMobile ? "+ Novo" : "+ Novo contato"}</button>
        </div>
      </div>

      {/* View tabs */}
      <div style={{ display: "flex", gap: 4, overflowX: "auto", marginBottom: 12, paddingBottom: 4 }}>
        {views.map((v) => (
          <button key={v.key} type="button" onClick={() => setActiveView(v.key)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", background: activeView === v.key ? "var(--text-primary)" : "var(--surface-raised)", color: activeView === v.key ? "var(--surface-base)" : "var(--text-muted)", transition: "all 0.15s" }}>
            {v.label}{v.count > 0 ? ` (${v.count})` : ""}
          </button>
        ))}
      </div>

      {/* Search + Filters button */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: hasActiveFilters && !showFilters ? 8 : 16 }}>
        <input type="text" value={search} onChange={(e) => handleSearch(e.target.value)} placeholder="Buscar por nome, telefone, email..." style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border-default)", background: "var(--surface-raised)", color: "var(--text-primary)", fontSize: 14, outline: "none" }} />
        <button type="button" onClick={() => setShowFilters(!showFilters)} style={{ padding: "10px 16px", borderRadius: 10, border: `1px solid ${hasActiveFilters ? "var(--interactive-primary)" : "var(--border-default)"}`, background: hasActiveFilters ? "rgba(74,222,128,0.06)" : "var(--surface-raised)", color: hasActiveFilters ? "var(--interactive-primary)" : "var(--text-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
          Filtros
          {activeFilterCount > 0 && <span style={{ background: "var(--interactive-primary)", color: "var(--interactive-on-primary)", fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 10, minWidth: 18, textAlign: "center" }}>{activeFilterCount}</span>}
        </button>
      </div>

      {/* Filter tags (when filters active and panel closed) */}
      {hasActiveFilters && !showFilters && (
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {filters.status && (
            <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8, background: "rgba(74,222,128,0.08)", color: "var(--interactive-primary)", display: "flex", alignItems: "center", gap: 4 }}>
              Status: {CLIENT_STATUS_LABELS[filters.status as ClientStatus] ?? filters.status}
              <span onClick={() => setFilters((f) => ({ ...f, status: undefined }))} style={{ cursor: "pointer", fontWeight: 700, marginLeft: 2 }}>x</span>
            </span>
          )}
          {filters.temperature && (
            <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8, background: filters.temperature === "hot" ? "rgba(248,113,113,0.12)" : filters.temperature === "warm" ? "rgba(251,191,36,0.12)" : "rgba(96,165,250,0.12)", color: filters.temperature === "hot" ? "#F87171" : filters.temperature === "warm" ? "#FBBF24" : "#60A5FA", display: "flex", alignItems: "center", gap: 4 }}>
              {filters.temperature === "hot" ? "Quente" : filters.temperature === "warm" ? "Morno" : "Frio"}
              <span onClick={() => setFilters((f) => ({ ...f, temperature: undefined }))} style={{ cursor: "pointer", fontWeight: 700, marginLeft: 2 }}>x</span>
            </span>
          )}
          {filters.origin && (
            <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8, background: "var(--surface-overlay)", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
              Origem: {CLIENT_SOURCE_LABELS[filters.origin] ?? filters.origin}
              <span onClick={() => setFilters((f) => ({ ...f, origin: undefined }))} style={{ cursor: "pointer", fontWeight: 700, marginLeft: 2 }}>x</span>
            </span>
          )}
          {filters.assignedTo && (
            <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8, background: "rgba(167,139,250,0.12)", color: "#A78BFA", display: "flex", alignItems: "center", gap: 4 }}>
              Resp: {teamMembers.find((m) => m.userId === filters.assignedTo)?.name ?? filters.assignedTo}
              <span onClick={() => setFilters((f) => ({ ...f, assignedTo: undefined }))} style={{ cursor: "pointer", fontWeight: 700, marginLeft: 2 }}>x</span>
            </span>
          )}
          {filters.period && (
            <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8, background: "var(--surface-overlay)", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
              {PERIOD_LABELS[filters.period] ?? filters.period}
              <span onClick={() => setFilters((f) => ({ ...f, period: undefined }))} style={{ cursor: "pointer", fontWeight: 700, marginLeft: 2 }}>x</span>
            </span>
          )}
          {filters.city && (
            <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 8, background: "var(--surface-overlay)", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
              Cidade: {filters.city}
              <span onClick={() => setFilters((f) => ({ ...f, city: undefined }))} style={{ cursor: "pointer", fontWeight: 700, marginLeft: 2 }}>x</span>
            </span>
          )}
        </div>
      )}

      {/* Filter panel */}
      {showFilters && (
        <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16 }}>
            {/* Row 1 */}
            <div>
              <label style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Status</label>
              <select value={filters.status ?? ""} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value || undefined }))} style={FSEL}>
                <option value="">Todos</option>
                {(Object.entries(CLIENT_STATUS_LABELS) as [ClientStatus, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Temperatura</label>
              <select value={filters.temperature ?? ""} onChange={(e) => setFilters((f) => ({ ...f, temperature: e.target.value || undefined }))} style={FSEL}>
                <option value="">Todas</option>
                <option value="hot">Quente</option><option value="warm">Morno</option><option value="cold">Frio</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Origem</label>
              <select value={filters.origin ?? ""} onChange={(e) => setFilters((f) => ({ ...f, origin: e.target.value || undefined }))} style={FSEL}>
                <option value="">Todas</option>
                {Object.entries(CLIENT_SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {/* Row 2 */}
            <div>
              <label style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Responsável</label>
              <select value={filters.assignedTo ?? ""} onChange={(e) => setFilters((f) => ({ ...f, assignedTo: e.target.value || undefined }))} style={FSEL}>
                <option value="">Todos</option>
                {teamMembers.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Cadastrado em</label>
              <select value={filters.period ?? ""} onChange={(e) => setFilters((f) => ({ ...f, period: e.target.value || undefined }))} style={FSEL}>
                <option value="">Qualquer período</option>
                <option value="today">Hoje</option><option value="7d">Últimos 7 dias</option><option value="30d">Últimos 30 dias</option><option value="90d">Últimos 90 dias</option><option value="this_month">Este mês</option><option value="last_month">Mês passado</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Cidade</label>
              <input type="text" placeholder="Ex: Cascavel" value={filters.city ?? ""} onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value || undefined }))} style={{ ...FSEL, backgroundImage: "none", padding: "10px 12px" }} />
            </div>
          </div>
          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border-default)" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{contatos.length} contato{contatos.length !== 1 ? "s" : ""} encontrado{contatos.length !== 1 ? "s" : ""}</span>
            {hasActiveFilters && <button type="button" onClick={() => setFilters({})} style={{ fontSize: 12, color: "var(--interactive-primary)", background: "transparent", border: "none", cursor: "pointer", fontWeight: 600 }}>Limpar todos os filtros</button>}
          </div>
        </div>
      )}

      {/* Error / Empty */}
      {status === "error" && <div style={{ padding: 16, background: "rgba(248,113,113,0.08)", borderRadius: 10, color: "#F87171", fontSize: 13 }}>{errorMessage}</div>}
      {status === "empty" && !isLoading && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>👤</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Nenhum contato encontrado</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Crie seu primeiro contato ou ajuste os filtros.</div>
        </div>
      )}

      {/* Contact list */}
      {contatos.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {contatos.map((c) => {
            const isOverdue = c.nextFollowUpAt && new Date(c.nextFollowUpAt) < new Date();
            const displayName = c.fullName || c.name;
            return (
              <div key={c.id} onClick={() => navigate(`/contatos/${c.id}`)} style={{ display: "flex", alignItems: "center", gap: 12, padding: isMobile ? "12px 14px" : "14px 18px", background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 10, cursor: "pointer", transition: "border-color 0.15s" }} onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(74,222,128,0.3)")} onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}>
                <TempBadge temp={c.temperature} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.phone || c.email || "Sem contato"}{c.origin ? ` · ${CLIENT_SOURCE_LABELS[c.origin] ?? c.origin}` : ""}
                  </div>
                </div>
                {!isMobile && <Badge label={CLIENT_STATUS_LABELS[c.status] ?? c.status} color={CLIENT_STATUS_COLORS[c.status] ?? "#6B7280"} />}
                {!isMobile && c.score > 0 && <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: c.score >= 70 ? "#4ADE80" : c.score >= 40 ? "#FBBF24" : "var(--text-muted)", minWidth: 32, textAlign: "center" }}>{c.score}</div>}
                {!isMobile && <div style={{ fontSize: 12, color: c.assignedToName ? "var(--text-muted)" : "var(--text-disabled)", minWidth: 80, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.assignedToName ?? c.brokerName ?? "—"}</div>}
                {isOverdue && <span title="Follow-up atrasado" style={{ fontSize: 14, flexShrink: 0 }}>⚠</span>}
                {isMobile && <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}><Badge label={CLIENT_STATUS_LABELS[c.status] ?? c.status} color={CLIENT_STATUS_COLORS[c.status] ?? "#6B7280"} /></div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
