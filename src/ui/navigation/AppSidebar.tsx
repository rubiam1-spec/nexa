import { NavLink } from "react-router-dom";
import { useAuth } from "../../app/contexts/AuthContext";
import { useAccount } from "../../app/contexts/AccountContext";
import { getUserRoleLabel } from "../../shared/types/role";
import { podeVerItem } from "../../shared/utils/permissoes";
import NexaIcon from "../../shared/components/NexaIcon";
import Avatar from "../../shared/components/Avatar";
import { useTheme } from "../../shared/theme";
import { useNotifications } from "../../shared/hooks/useNotifications";

// ── SVG Icons (18x18, stroke-based, Lucide style) ──

const I = {
  meudia: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  dashboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  simulador: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
  pipeline: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="8" width="5" height="13" rx="1"/><rect x="17" y="5" width="5" height="16" rx="1"/></svg>,
  unidades: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  negociacoes: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  clientes: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  corretores: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
  imobiliarias: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>,
  atividades: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  feed: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  relatorios: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  materiais: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
  empreendimentos: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>,
  usuarios: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  configuracoes: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83"/></svg>,
} as Record<string, React.ReactNode>;

// ── Navigation groups ──

const GROUPS: { label: string; items: { key: string; label: string; path: string }[] }[] = [
  { label: "Operação", items: [
    { key: "meudia", label: "Meu Dia", path: "/" },
    { key: "dashboard", label: "Dashboard", path: "/dashboard" },
    { key: "simulador", label: "Simulador", path: "/simulador" },
    { key: "pipeline", label: "Pipeline", path: "/pipeline" },
    { key: "unidades", label: "Unidades", path: "/unidades" },
  ]},
  { label: "Comercial", items: [
    { key: "negociacoes", label: "Negociações", path: "/negociacoes" },
    { key: "clientes", label: "Clientes", path: "/clientes" },
    { key: "corretores", label: "Corretores", path: "/corretores" },
    { key: "imobiliarias", label: "Imobiliárias", path: "/imobiliarias" },
  ]},
  { label: "Gestão", items: [
    { key: "atividades", label: "Atividades", path: "/atividades" },
    { key: "feed", label: "Feed", path: "/feed" },
    { key: "relatorios", label: "Relatórios", path: "/relatorios" },
    { key: "materiais", label: "Materiais", path: "/materiais" },
  ]},
  { label: "Sistema", items: [
    { key: "empreendimentos", label: "Empreendimentos", path: "/empreendimentos" },
    { key: "usuarios", label: "Usuários", path: "/usuarios" },
    { key: "configuracoes", label: "Configurações", path: "/configuracoes" },
  ]},
];

export default function AppSidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const { user, authenticatedProfile } = useAuth();
  const { account } = useAccount();
  const { resolvedTheme, setTheme } = useTheme();
  const role = account?.role ?? null;
  const name = authenticatedProfile?.fullName || user?.name || user?.email || "Usuário";
  const avatarUrl = authenticatedProfile?.avatarUrl ?? null;
  const { unreadCount } = useNotifications(authenticatedProfile?.id ?? null, account?.accountId ?? null);

  return (
    <aside style={{ width: 240, height: "100%", background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)", display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>

      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 16px 12px" }}>
        <NexaIcon size={22} />
        <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: "0.08em", color: "var(--text-primary)" }}>NEXA</span>
      </div>

      {/* Separator */}
      <div style={{ height: 1, background: "var(--border-subtle)", margin: "0 14px 4px" }} />

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "0 8px" }}>
        {GROUPS.map((group) => {
          const visible = group.items.filter((item) => podeVerItem(item.key, role));
          if (visible.length === 0) return null;
          return (
            <div key={group.label}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.12em", textTransform: "uppercase", padding: "16px 8px 6px", userSelect: "none" }}>
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
                    gap: 12,
                    padding: onNavigate ? "12px 12px" : "9px 12px",
                    borderRadius: 8,
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? "var(--sidebar-text-active)" : "var(--sidebar-text)",
                    background: isActive ? "var(--sidebar-active-bg)" : "transparent",
                    transition: "all 150ms ease",
                  })}
                >
                  <span style={{ display: "flex", alignItems: "center", opacity: 0.85, flexShrink: 0 }}>
                    {I[item.key] || null}
                  </span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.key === "meudia" && unreadCount > 0 && <span style={{ background: "#E24B4A", color: "#fff", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, flexShrink: 0 }}>{unreadCount > 9 ? "9+" : unreadCount}</span>}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      {/* Footer — user + theme toggle */}
      <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "14px 14px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <Avatar name={name} avatarUrl={avatarUrl} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {name}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-disabled)" }}>
            {getUserRoleLabel(role)}
          </div>
        </div>
        <button onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} title={resolvedTheme === "dark" ? "Modo claro" : "Modo escuro"} style={{ background: "transparent", border: "none", cursor: "pointer", padding: onNavigate ? 10 : 6, borderRadius: 6, color: "var(--sidebar-text)", display: "flex", alignItems: "center", minWidth: 44, minHeight: 44, justifyContent: "center" }}>
          {resolvedTheme === "dark" ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          )}
        </button>
      </div>
    </aside>
  );
}
