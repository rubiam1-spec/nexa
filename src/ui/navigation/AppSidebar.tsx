import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../app/contexts/AuthContext";
import { useAccount } from "../../app/contexts/AccountContext";
import { useDevelopment } from "../../app/contexts/DevelopmentContext";
import { getUserRoleLabel } from "../../shared/types/role";
import { usePermissions } from "../../shared/hooks/usePermissions";
import Avatar from "../../shared/components/Avatar";
import { useTheme } from "../../shared/theme";
import { supabase } from "../../infra/supabase/supabaseClient";
import type { PermissionFlag } from "../../shared/constants/permissionPresets";

// ── SVG Icons (16x16, stroke 1.5px) — color set via CSS var ──

function Ic({ d, active }: { d: React.ReactNode; active: boolean }) {
  return <span style={{ display: "flex", alignItems: "center", color: active ? "var(--interactive-primary)" : "var(--text-disabled)", flexShrink: 0 }}>{d}</span>;
}

const sw = "1.5";
const I: Record<string, React.ReactNode> = {
  meudia: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  simulador: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
  pipeline: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="8" width="5" height="13" rx="1"/><rect x="17" y="5" width="5" height="16" rx="1"/></svg>,
  unidades: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  imoveis: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><rect x="9" y="10" width="2" height="2"/><rect x="9" y="14" width="2" height="2"/></svg>,
  negociacoes: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  contatos: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  corretores: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
  imobiliarias: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>,
  atividades: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  feed: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  relatorios: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  materiais: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
  empreendimentos: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>,
  usuarios: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  configuracoes: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83"/></svg>,
  relacionamento: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
};

// ── Navigation groups ──

const GROUPS: { label: string; items: { key: string; label: string; path: string }[] }[] = [
  // Fase B: "Pipeline" saiu do menu — unificado em Negociações (grupo Comercial).
  { label: "Operação", items: [
    { key: "meudia", label: "Central", path: "/" },
    { key: "simulador", label: "Simulador", path: "/simulador" },
    { key: "unidades", label: "Unidades", path: "/unidades" },
    { key: "imoveis", label: "Imóveis", path: "/imoveis" },
  ]},
  { label: "Comercial", items: [
    { key: "negociacoes", label: "Negociações", path: "/negociacoes" },
    { key: "contatos", label: "Contatos", path: "/contatos" },
    { key: "corretores", label: "Corretores", path: "/corretores" },
    { key: "imobiliarias", label: "Imobiliárias", path: "/imobiliarias" },
  ]},
  { label: "Gestão", items: [
    { key: "atividades", label: "Atividades", path: "/atividades" },
    { key: "feed", label: "Feed", path: "/feed" },
    { key: "relatorios", label: "Relatórios", path: "/relatorios" },
    { key: "materiais", label: "Materiais", path: "/materiais" },
    { key: "relacionamento", label: "Relacionamento", path: "/relacionamento" },
  ]},
  { label: "Sistema", items: [
    { key: "empreendimentos", label: "Empreendimentos", path: "/empreendimentos" },
    { key: "usuarios", label: "Usuários", path: "/usuarios" },
    { key: "configuracoes", label: "Configurações", path: "/configuracoes" },
  ]},
];

// Mapeamento de cada item da sidebar para as flags que liberam visibilidade.
// - Array vazio = sempre visivel (dados filtrados pelo RLS do banco).
// - Varias flags = OR (qualquer uma libera).
// Itens nao listados defaultam para sempre visiveis.
const ITEM_VISIBILITY: Record<string, PermissionFlag[]> = {
  meudia: [],
  simulador: ["can_simulate"],
  pipeline: ["can_view_all_negotiations", "can_view_own_negotiations"],
  unidades: [],
  imoveis: ["can_manage_properties", "can_view_dashboard"],

  negociacoes: ["can_view_all_negotiations", "can_view_own_negotiations"],
  contatos: [],
  corretores: ["can_manage_brokers"],
  imobiliarias: ["can_manage_brokerages"],

  atividades: ["can_register_activity", "can_edit_any_activity"],
  feed: [],
  relatorios: ["can_view_reports", "can_view_dashboard"],
  materiais: [],
  relacionamento: [],

  empreendimentos: ["can_manage_settings"],
  usuarios: ["can_invite_users", "can_manage_settings"],
  configuracoes: ["can_manage_settings"],
};

// Shape do select usado para puxar a identidade visual da conta ativa
// (logo + cor primária). O cliente Supabase não infere tipos quando o
// schema não está gerado; este alias evita o `any` no consumidor.
type AccountIdentityRow = {
  logo_url: string | null;
  cor_primaria: string | null;
};

export default function AppSidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const { user, authenticatedProfile } = useAuth();
  const { account } = useAccount();
  const { development } = useDevelopment();
  const { resolvedTheme, setTheme } = useTheme();
  const { can } = usePermissions();
  const role = account?.role ?? null;
  const name = authenticatedProfile?.fullName || user?.name || user?.email || "Usuário";
  const avatarUrl = authenticatedProfile?.avatarUrl ?? null;

  const isItemVisible = (key: string): boolean => {
    const flags = ITEM_VISIBILITY[key];
    if (!flags) return true; // itens sem mapeamento: visiveis por padrao
    if (flags.length === 0) return true; // visiveis para todos (RLS filtra dados)
    return flags.some((f) => can(f));
  };

  const accountId = account?.accountId ?? null;
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [corPrimaria, setCorPrimaria] = useState<string>("#4ADE80");
  useEffect(() => {
    let cancelled = false;
    // Setters movidos para dentro de async function — evita setState
    // síncrono dentro do effect (react-hooks/set-state-in-effect).
    const loadIdentity = async () => {
      if (!supabase || !accountId) {
        if (!cancelled) {
          setLogoUrl(null);
          setCorPrimaria("#4ADE80");
        }
        return;
      }
      const { data } = await supabase
        .from("account_settings")
        .select("logo_url, cor_primaria")
        .eq("account_id", accountId)
        .maybeSingle();
      if (cancelled || !data) return;
      const row = data as AccountIdentityRow;
      setLogoUrl(row.logo_url ?? null);
      if (row.cor_primaria) setCorPrimaria(row.cor_primaria);
    };
    void loadIdentity();
    return () => { cancelled = true; };
  }, [accountId]);

  return (
    <aside style={{ width: 240, height: "100%", background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)", display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>

      {/* Logo NEXA */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 14px 12px" }}>
        <svg width="30" height="30" viewBox="0 0 512 512" style={{ flexShrink: 0 }}>
          <path d="M40 0 H370 L512 142 V472 Q512 512 472 512 H40 Q0 512 0 472 V40 Q0 0 40 0 Z" fill="var(--surface-overlay)" />
          <polygon points="148,380 148,132 200,132 316,308 316,132 364,132 364,380 316,380 200,204 200,380" fill="#4ADE80" />
        </svg>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>NEXA</span>
      </div>

      {/* Client logo zone */}
      <div style={{ margin: "0 10px 8px", padding: 12, background: "linear-gradient(160deg, rgba(42,40,34,0.4), rgba(22,21,18,0.15))", borderRadius: 10, border: "1px solid rgba(61,58,48,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 32 }}>
          {logoUrl ? (
            <img src={logoUrl} alt={account?.accountName || ""} style={{ maxHeight: 28, maxWidth: "100%", objectFit: "contain", display: "block" }} />
          ) : (
            <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 12, color: corPrimaria, letterSpacing: "0.05em" }}>
              {account?.accountName?.toUpperCase() || "EMPRESA"}
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 6, textAlign: "center", fontWeight: 500 }}>
          {development?.developmentName || "Empreendimento"}
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "0 8px" }}>
        {GROUPS.map((group, gi) => {
          const visible = group.items.filter((item) => isItemVisible(item.key));
          if (visible.length === 0) return null;
          return (
            <div key={group.label}>
              {gi > 0 && <div style={{ height: 1, background: "var(--border-subtle)", margin: "12px 6px" }} />}
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 500, color: "var(--text-disabled)", textTransform: "uppercase", letterSpacing: "0.22em", padding: "8px 8px 4px", userSelect: "none" }}>
                {group.label}
              </div>
              {visible.map((item) => (
                <NavLink
                  key={item.key}
                  to={item.path}
                  onClick={onNavigate}
                  style={({ isActive }) => ({
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 8,
                    textDecoration: "none",
                    fontFamily: "var(--font-sans)",
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 500,
                    letterSpacing: "-0.025em",
                    color: isActive ? "var(--text-primary)" : "var(--sidebar-text)",
                    background: isActive ? "rgba(250,249,246,0.03)" : "transparent",
                    marginBottom: 2,
                    transition: "all 120ms ease",
                    position: "relative",
                  })}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 2.5, height: 16, background: "var(--interactive-primary)", borderRadius: 2 }} />}
                      <Ic d={I[item.key]} active={isActive} />
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: "1px solid var(--border-subtle)", padding: 14, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <Avatar name={name} avatarUrl={avatarUrl} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, color: "var(--text-disabled)" }}>{getUserRoleLabel(role)}</div>
        </div>
        <button onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} title={resolvedTheme === "dark" ? "Modo claro" : "Modo escuro"} style={{ background: "transparent", border: "none", cursor: "pointer", padding: onNavigate ? 10 : 6, borderRadius: 6, color: "var(--text-disabled)", display: "flex", alignItems: "center", minWidth: 44, minHeight: 44, justifyContent: "center" }}>
          {resolvedTheme === "dark" ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          )}
        </button>
      </div>
    </aside>
  );
}
