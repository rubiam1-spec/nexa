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
import { visibleModulesBySection } from "../../shared/navigation/navRegistry";
import { NAV_ICONS } from "../../shared/navigation/navIcons";

// Ícone da navegação — cor via CSS var (ativo/inativo). Fonte única: NAV_ICONS.
function Ic({ icone, active }: { icone: string; active: boolean }) {
  const render = NAV_ICONS[icone];
  return <span style={{ display: "flex", alignItems: "center", color: active ? "var(--interactive-primary)" : "var(--text-disabled)", flexShrink: 0 }}>{render ? render(16) : null}</span>;
}

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

  // Navegação vem SÓ do registry (fonte única desktop+mobile).
  const groups = visibleModulesBySection(can);

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
        {groups.map((group, gi) => (
            <div key={group.secao}>
              {gi > 0 && <div style={{ height: 1, background: "var(--border-subtle)", margin: "12px 6px" }} />}
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 500, color: "var(--text-disabled)", textTransform: "uppercase", letterSpacing: "0.22em", padding: "8px 8px 4px", userSelect: "none" }}>
                {group.label}
              </div>
              {group.modules.map((mod) => (
                <NavLink
                  key={mod.id}
                  to={mod.rota}
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
                      <Ic icone={mod.icone} active={isActive} />
                      <span>{mod.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
        ))}
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
