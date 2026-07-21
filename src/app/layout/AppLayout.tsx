import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAccount } from "../contexts/AccountContext";
import { useDevelopment } from "../contexts/DevelopmentContext";
import { useAuth } from "../contexts/AuthContext";
import AppSidebar from "../../ui/navigation/AppSidebar";
import { useScreen } from "../../shared/hooks/useIsMobile";
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
import { useNotifications } from "../../shared/hooks/useNotifications";
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
  const isMobile = !screen.isDesktop; // sidebar as drawer below 1024px
  const isCompact = screen.isMobile; // < 768: bottom nav replaces sidebar entirely
  const isHome = HOME_PATHS.has(location.pathname);
  const mobilePageTitle = getMobilePageTitle(location.pathname);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { show: showOnboarding, dismiss: dismissOnboarding } = useOnboarding();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(authenticatedProfile?.id ?? null, account?.accountId ?? null);
  useCadenceAlerts(account?.accountId ?? null, authenticatedProfile?.id ?? null, account?.role ?? null);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
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
  const closeBell = useCallback(() => setBellOpen(false), []);
  useEffect(() => {
    if (!bellOpen) return;
    const h = (e: MouseEvent) => { if (bellRef.current && !bellRef.current.contains(e.target as Node)) closeBell(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [bellOpen, closeBell]);

  // Snapshot de "agora" para formatação de tempo relativo em notificações.
  // useState lazy + interval 60s: evita Date.now() impuro no render body
  // (react-hooks/purity) e mantém tempos relativos atualizando.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: "var(--color-ink)",
        overflow: "hidden",
      }}
    >
      {/* Sidebar — desktop fixed, tablet as drawer, phone replaced by bottom nav */}
      {isCompact ? null : isMobile ? (
        <>
          {sidebarOpen ? <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 90, transition: "opacity 0.25s" }} onClick={() => setSidebarOpen(false)} /> : null}
          <div style={{ position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 100, transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.25s ease", width: 280 }}>
            <AppSidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
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
            {isMobile && !isCompact ? (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--color-bone)",
                  padding: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  width: 44,
                  height: 44,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
            ) : null}
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
            {/* Bell with dropdown */}
            <div ref={bellRef} style={{ position: "relative" }}>
              <button type="button" onClick={() => setBellOpen((v) => !v)} style={{ position: "relative", cursor: "pointer", padding: 6, borderRadius: 8, background: "transparent", border: "none", transition: "background 0.15s" }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(156,150,134,0.08)"; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
                {unreadCount > 0 && <div style={{ position: "absolute", top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 99, background: "#E24B4A", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", border: "2px solid var(--surface-base)" }}>{unreadCount > 9 ? "9+" : unreadCount}</div>}
              </button>
              {bellOpen && (isMobile ? (
                /* Mobile: fullscreen overlay */
                <>
                  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 998 }} onClick={closeBell} />
                  <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "var(--surface-base, #12110F)", display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--border-default)" }}>
                      <span style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>Notificações{unreadCount > 0 ? ` (${unreadCount})` : ""}</span>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        {unreadCount > 0 && <button type="button" onClick={() => markAllAsRead()} style={{ fontSize: 12, color: "#4ADE80", background: "transparent", border: "none", cursor: "pointer" }}>Marcar lidas</button>}
                        <button type="button" onClick={closeBell} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>x</button>
                      </div>
                    </div>
                    <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
                      {notifications.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-disabled)", fontSize: 13 }}>Nenhuma notificação</div> : notifications.slice(0, 20).map((n) => {
                        const tc: Record<string, string> = { new_proposal: "#4ADE80", counter_proposal: "#F59E0B", docs_ready_for_review: "#A78BFA", proposal_approved: "#4ADE80", proposal_rejected: "#E24B4A", doc_approved: "#4ADE80", doc_rejected: "#E24B4A", client_ready_for_contract: "#4ADE80", update_request: "#F59E0B", reservation_requested: "#F59E0B", reservation_approved: "#4ADE80", reservation_rejected: "#E24B4A", sale_registered: "#4ADE80", feed_comment: "#60A5FA", feed_reaction: "#60A5FA", followup_overdue: "#E24B4A", negotiation_stale: "#F59E0B", reservation_expiring: "#F59E0B", weekly_report: "#4ADE80", activity_reminder: "#F59E0B", property_pending_approval: "#F59E0B", property_approved: "#4ADE80", property_rejected: "#E24B4A", property_revision_requested: "#60A5FA", brokerage_manager_assigned: "#4ADE80", brokerage_manager_removed: "#F59E0B" };
                        const c = tc[n.type] || "#8A8985";
                        const diff = now - new Date(n.created_at).getTime(); const mins = Math.floor(diff / 60000); const t = mins < 60 ? `${mins}min` : mins < 1440 ? `${Math.floor(mins / 60)}h` : `${Math.floor(mins / 1440)}d`;
                        return <div key={n.id} onClick={() => { markAsRead(n.id); closeBell(); if (n.action_url) navigate(n.action_url); }} style={{ display: "flex", gap: 10, padding: "14px 20px", cursor: "pointer", background: n.read ? "transparent" : "rgba(74,222,128,0.03)", borderBottom: "1px solid var(--border-default)" }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: c + "15", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: c }} /></div>
                          <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</span><span style={{ fontSize: 11, color: "var(--text-disabled)", flexShrink: 0 }}>{t}</span></div>{n.message && <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.4 }}>{n.message}</p>}</div>
                          {!n.read && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", flexShrink: 0, marginTop: 6 }} />}
                        </div>;
                      })}
                    </div>
                    <div onClick={() => { closeBell(); navigate("/notificacoes"); }} style={{ padding: "14px 20px", textAlign: "center", borderTop: "1px solid var(--border-default)", cursor: "pointer", fontSize: 13, color: "#4ADE80", fontWeight: 500 }}>Ver todas as notificações</div>
                  </div>
                </>
              ) : (
                /* Desktop: dropdown */
                <div className="nexa-dropdown-enter" style={{ position: "absolute", top: 40, right: 0, width: 380, background: "var(--surface-raised, #1C1B18)", border: "1px solid var(--border-default, #2A2926)", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", zIndex: 999, overflow: "hidden" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid var(--border-default, #2A2926)" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Notificações{unreadCount > 0 ? ` (${unreadCount})` : ""}</span>
                    {unreadCount > 0 && <button type="button" onClick={() => markAllAsRead()} style={{ fontSize: 12, color: "#4ADE80", background: "transparent", border: "none", cursor: "pointer" }}>Marcar todas como lidas</button>}
                  </div>
                  <div style={{ maxHeight: 400, overflowY: "auto" }}>
                    {notifications.length === 0 ? <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--text-disabled)", fontSize: 13 }}>Nenhuma notificação</div> : notifications.slice(0, 8).map((n, ni) => {
                      const tc: Record<string, string> = { new_proposal: "#4ADE80", counter_proposal: "#F59E0B", docs_ready_for_review: "#A78BFA", proposal_approved: "#4ADE80", proposal_rejected: "#E24B4A", doc_approved: "#4ADE80", doc_rejected: "#E24B4A", client_ready_for_contract: "#4ADE80", update_request: "#F59E0B", reservation_requested: "#F59E0B", reservation_approved: "#4ADE80", reservation_rejected: "#E24B4A", sale_registered: "#4ADE80", feed_comment: "#60A5FA", feed_reaction: "#60A5FA", followup_overdue: "#E24B4A", negotiation_stale: "#F59E0B", reservation_expiring: "#F59E0B", weekly_report: "#4ADE80", activity_reminder: "#F59E0B", property_pending_approval: "#F59E0B", property_approved: "#4ADE80", property_rejected: "#E24B4A", property_revision_requested: "#60A5FA", brokerage_manager_assigned: "#4ADE80", brokerage_manager_removed: "#F59E0B" };
                      const c = tc[n.type] || "#8A8985";
                      const diff = now - new Date(n.created_at).getTime(); const mins = Math.floor(diff / 60000); const t = mins < 60 ? `${mins}min` : mins < 1440 ? `${Math.floor(mins / 60)}h` : `${Math.floor(mins / 1440)}d`;
                      return <div key={n.id} onClick={() => { markAsRead(n.id); closeBell(); if (n.action_url) navigate(n.action_url); }} style={{ display: "flex", gap: 10, padding: "12px 16px", cursor: "pointer", background: n.read ? "transparent" : "rgba(74,222,128,0.04)", borderBottom: "1px solid var(--border-default, #2A2926)", transition: "background 0.15s", animation: `slideInRight 250ms cubic-bezier(0.16,1,0.3,1) both`, animationDelay: `${ni * 40}ms` }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: c + "15", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: c }} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</span><span style={{ fontSize: 11, color: "var(--text-disabled)", flexShrink: 0 }}>{t}</span></div>{n.message && <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.4 }}>{n.message}</p>}</div>
                        {!n.read && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", flexShrink: 0, marginTop: 6 }} />}
                      </div>;
                    })}
                  </div>
                  {notifications.length > 0 && <div onClick={() => { closeBell(); navigate("/notificacoes"); }} style={{ padding: "12px 16px", textAlign: "center", borderTop: "1px solid var(--border-default, #2A2926)", cursor: "pointer", fontSize: 13, color: "#4ADE80", fontWeight: 500 }}>Ver todas as notificações</div>}
                </div>
              ))}
            </div>
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
