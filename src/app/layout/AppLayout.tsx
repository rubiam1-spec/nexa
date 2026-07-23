import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAccount } from "../contexts/AccountContext";
import { useDevelopment } from "../contexts/DevelopmentContext";
import { useAuth } from "../contexts/AuthContext";
import AppSidebar from "../../ui/navigation/AppSidebar";
import { useScreen } from "../../shared/hooks/useIsMobile";
import { SIDEBAR_RAIL_BP, SIDEBAR_FULL_BP } from "../../shared/mobile";
import { useOnboarding, OnboardingWelcome } from "../../shared/components/OnboardingWelcome";
import MobileBottomNav from "../../shared/components/MobileBottomNav";

const HOME_PATHS = new Set(["/", "/central", "/meu-dia", "/dashboard"]);

function getMobilePageTitle(pathname: string): string {
  if (HOME_PATHS.has(pathname)) return "";
  if (pathname === "/simulador") return "Simulador";
  if (pathname === "/contatos") return "Contatos";
  if (pathname === "/contatos/novo") return "Novo contato";
  if (pathname === "/contatos/importar") return "Importar contatos";
  if (pathname.startsWith("/contatos/")) return "Contato";
  if (pathname === "/atividades") return "Atividades";
  if (pathname === "/corretores") return "Corretores";
  if (pathname.startsWith("/corretores/")) return "Corretor";
  if (pathname === "/imobiliarias") return "Imobiliárias";
  if (pathname.startsWith("/imobiliarias/")) return "Imobiliária";
  if (pathname === "/unidades") return "Unidades";
  if (pathname === "/configuracoes") return "Configurações";
  if (pathname === "/notificacoes") return "Notificações";
  if (pathname === "/imoveis") return "Imóveis";
  if (pathname === "/imoveis/novo") return "Novo imóvel";
  if (pathname.endsWith("/editar")) return "Editar";
  if (pathname.startsWith("/imoveis/")) return "Imóvel";
  if (pathname === "/empreendimentos") return "Empreendimentos";
  if (pathname.startsWith("/empreendimentos/")) return "Empreendimento";
  if (pathname === "/relatorios") return "Relatórios";
  if (pathname === "/materiais") return "Materiais";
  if (pathname === "/usuarios") return "Usuários";
  if (pathname === "/perfil") return "Perfil";
  if (pathname === "/feed") return "Feed";
  if (pathname === "/negociacoes") return "Negociações";
  if (pathname.startsWith("/negociacoes/")) return "Negociação";
  if (pathname === "/relacionamento") return "Relacionamento";
  return "";
}
import { NotificationBell } from "../../shared/components/NotificationBell";
import { useCadenceAlerts } from "../../shared/hooks/useCadenceAlerts";
import { supabase } from "../../infra/supabase/supabaseClient";
import UserMenu from "../../shared/components/UserMenu";
import { ConfirmacaoDestructiva } from "../../shared/components/ConfirmacaoDestructiva";
import { getUserRoleLabel } from "../../shared/types/role";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { account } = useAccount();
  const { development } = useDevelopment();
  const { signOut, authenticatedProfile } = useAuth();
  const location = useLocation();
  const screen = useScreen();
  // R1 · 3 faixas de navegação (largura só decide o chrome, nunca o conteúdo):
  //   < 768        → tab bar (M1)
  //   768–1179     → rail de ícones (64px, empurra) + overlay 240px expansível
  //   >= 1180      → sidebar completa 240px
  const isCompact = screen.width < SIDEBAR_RAIL_BP; // < 768: bottom nav
  const isRail = screen.width >= SIDEBAR_RAIL_BP && screen.width < SIDEBAR_FULL_BP;
  const isHome = HOME_PATHS.has(location.pathname);
  const mobilePageTitle = getMobilePageTitle(location.pathname);
  // Preferência do rail expandido (overlay) — persistida por usuário.
  const [railExpanded, setRailExpanded] = useState(() => {
    try { return localStorage.getItem("nexa:rail_expanded") === "1"; } catch { return false; }
  });
  const persistRail = (v: boolean) => { try { localStorage.setItem("nexa:rail_expanded", v ? "1" : "0"); } catch { /* ignore */ } };
  const toggleRail = useCallback(() => setRailExpanded((v) => { persistRail(!v); return !v; }), []);
  const closeRail = useCallback(() => setRailExpanded(() => { persistRail(false); return false; }), []);
  const { show: showOnboarding, dismiss: dismissOnboarding } = useOnboarding();
  useCadenceAlerts(account?.accountId ?? null, authenticatedProfile?.id ?? null, account?.role ?? null);
  const [confirmSignOutOpen, setConfirmSignOutOpen] = useState(false);

  const handleSwitchAccount = async () => {
    if (authenticatedProfile?.email) {
      localStorage.setItem("nexa:last_email", authenticatedProfile.email);
    }
    await signOut();
    navigate("/entrar?prefill=1");
  };

  const requestSignOut = () => setConfirmSignOutOpen(true);
  const confirmSignOut = async () => {
    setConfirmSignOutOpen(false);
    await signOut();
    navigate("/entrar");
  };

  const accountId = account?.accountId ?? null;
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [corPrimaria, setCorPrimaria] = useState<string>("#4ADE80");
  useEffect(() => {
    if (!supabase || !accountId) { setLogoUrl(null); return; }
    let mounted = true;
    supabase.from("account_settings").select("logo_url, cor_primaria").eq("account_id", accountId).maybeSingle().then(({ data }) => {
      if (!mounted || !data) return;
      setLogoUrl((data as any).logo_url ?? null);
      if ((data as any).cor_primaria) setCorPrimaria((data as any).cor_primaria);
    });
    return () => { mounted = false; };
  }, [accountId]);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: "var(--color-ink)",
        overflow: "hidden",
      }}
    >
      {/* Sidebar — >=1180 completa fixa · 768–1179 rail de ícones (empurra) +
          overlay 240px expansível (não empurra) · <768 substituída por tab bar */}
      {isCompact ? null : isRail ? (
        <>
          <AppSidebar collapsed onExpand={toggleRail} />
          {railExpanded ? (
            <>
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 90, transition: "opacity 0.25s" }} onClick={closeRail} />
              <div style={{ position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 100, width: 240 }}>
                <AppSidebar onNavigate={closeRail} />
              </div>
            </>
          ) : null}
        </>
      ) : (
        <AppSidebar />
      )}

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Topbar */}
        <header
          style={{
            height: 56,
            padding: screen.isMobile ? "0 12px" : "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--color-stone)",
            background: "var(--color-carbon)",
            flexShrink: 0,
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
            {/* Rail (768–1179) tem seu próprio botão de expandir — sem hambúrguer no topo */}
            {isCompact && !isHome ? (
              <>
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  aria-label="Voltar"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--color-bone)",
                    padding: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    width: 44,
                    height: 44,
                    cursor: "pointer",
                    marginLeft: -8,
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                </button>
                <span
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontWeight: 700,
                    fontSize: 15,
                    color: "var(--text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                  }}
                >
                  {mobilePageTitle}
                </span>
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", height: 24, flexShrink: 0 }}>
                  {logoUrl ? (
                    <img src={logoUrl} alt={account?.accountName || ""} style={{ maxHeight: 22, maxWidth: isCompact ? 96 : 120, objectFit: "contain", display: "block" }} />
                  ) : (
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: 11, color: corPrimaria, letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
                      {account?.accountName?.toUpperCase() || ""}
                    </span>
                  )}
                </div>
                {!isCompact ? <span style={{ color: "var(--color-slate)", fontSize: 10 }}>/</span> : null}
                {!isCompact ? (
                  <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {development?.developmentName || ""}
                  </span>
                ) : null}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            {/* N4 · sino unificado (honesto) — fonte única + badge só acionáveis */}
            <NotificationBell userId={authenticatedProfile?.id ?? null} accountId={account?.accountId ?? null} isMobile={isCompact} />
            {/* User menu (substitui avatar solto + "Trocar empreendimento" + "Sair") */}
            <UserMenu
              profile={{
                fullName: authenticatedProfile?.fullName ?? authenticatedProfile?.email ?? "Usuário",
                email: authenticatedProfile?.email ?? "",
                avatarUrl: authenticatedProfile?.avatarUrl ?? null,
              }}
              account={{
                role: getUserRoleLabel(account?.role ?? null),
                accountName: account?.accountName ?? "",
              }}
              onProfile={() => navigate("/perfil")}
              onSettings={() => navigate("/configuracoes")}
              onSwitchDevelopment={() => navigate("/selecionar-empreendimento")}
              onSwitchAccount={() => void handleSwitchAccount()}
              onSignOut={requestSignOut}
            />
          </div>
        </header>

        {/* Main content */}
        <main
          key={location.pathname}
          className="nexa-page-enter"
          style={{
            flex: 1,
            overflowY: "auto",
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
            padding: screen.contentPadding,
            paddingBottom: isCompact
              ? "calc(56px + env(safe-area-inset-bottom) + 16px)"
              : screen.contentPadding,
            background: "var(--color-ink)",
          }}
        >
          {children}
        </main>
      </div>
      {isCompact ? <MobileBottomNav /> : null}
      <OnboardingWelcome open={showOnboarding} onDismiss={dismissOnboarding} />
      <ConfirmacaoDestructiva
        open={confirmSignOutOpen}
        titulo="Sair da conta"
        descricao="Você precisará fazer login novamente para acessar o NEXA."
        labelConfirmar="Sair"
        countdown={0}
        onConfirmar={() => void confirmSignOut()}
        onCancelar={() => setConfirmSignOutOpen(false)}
      />
    </div>
  );
}
