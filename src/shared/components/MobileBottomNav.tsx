import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePermissions } from "../hooks/usePermissions";
import {
  mobilePrimaryModules,
  visibleModulesBySection,
  type NavModule,
} from "../navigation/navRegistry";
import { NAV_ICONS } from "../navigation/navIcons";

// Navegação mobile — consome SÓ o navRegistry (mesma fonte do AppSidebar) com o
// MESMO gating por permissão. Tab bar = mobilePrimary (Central · Negociações ·
// Leads) + "Mais"; o sheet reflete a arquitetura do desktop (4 seções nomeadas,
// TODOS os módulos permitidos ao papel). O sino do header é a entrada única de
// notificações — não há item "Notif." aqui.

function IcClose({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function isActive(pathname: string, itemPath: string): boolean {
  if (itemPath === "/") return pathname === "/" || pathname === "/central" || pathname === "/meu-dia" || pathname === "/dashboard";
  return pathname === itemPath || pathname.startsWith(itemPath + "/");
}

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { can } = usePermissions();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetClosing, setSheetClosing] = useState(false);

  const primaries = mobilePrimaryModules(can);
  const sheetGroups = visibleModulesBySection(can);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeSheet(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  function closeSheet() {
    setSheetClosing(true);
    window.setTimeout(() => {
      setSheetOpen(false);
      setSheetClosing(false);
    }, 240);
  }

  function handleSheetNav(path: string) {
    closeSheet();
    window.setTimeout(() => navigate(path), 80);
  }

  const navStyle: CSSProperties = {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    width: "100%",
    height: "calc(56px + env(safe-area-inset-bottom))",
    paddingBottom: "env(safe-area-inset-bottom)",
    display: "flex",
    alignItems: "stretch",
    background: "var(--surface-base)",
    borderTop: "1px solid var(--border-default)",
    zIndex: 1000,
    boxShadow: "0 -1px 8px rgba(0,0,0,0.12)",
  };

  const tabButton = (opts: { key: string; label: string; icone: string; active: boolean; onClick: () => void }) => (
    <button
      key={opts.key}
      type="button"
      onClick={opts.onClick}
      aria-label={opts.label}
      aria-current={opts.active ? "page" : undefined}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        minHeight: 44,
        padding: "6px 4px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: opts.active ? "var(--interactive-primary)" : "var(--text-muted)",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 28,
          borderRadius: 999,
          background: opts.active ? "var(--status-sprout-muted)" : "transparent",
          transition: "background 0.15s",
        }}
      >
        {NAV_ICONS[opts.icone]?.(22)}
      </span>
      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10, fontWeight: 500, lineHeight: 1, letterSpacing: "0.01em" }}>
        {opts.label}
      </span>
    </button>
  );

  return (
    <>
      <nav style={navStyle} role="navigation" aria-label="Navegação principal">
        {primaries.map((mod: NavModule) =>
          tabButton({
            key: mod.id,
            label: mod.label,
            icone: mod.icone,
            active: isActive(location.pathname, mod.rota),
            onClick: () => navigate(mod.rota),
          }),
        )}
        {tabButton({ key: "mais", label: "Mais", icone: "mais", active: sheetOpen, onClick: () => setSheetOpen(true) })}
      </nav>

      {sheetOpen && (
        <>
          <div
            onClick={closeSheet}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(11,10,8,0.6)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              zIndex: 1050,
              animation: sheetClosing ? "fadeOut 200ms ease both" : "fadeIn 200ms ease both",
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Mais opções"
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              maxHeight: "80vh",
              overflowY: "auto",
              zIndex: 1060,
              background: "var(--surface-raised)",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              paddingBottom: "max(16px, env(safe-area-inset-bottom))",
              animation: sheetClosing
                ? "slideDownSheet 240ms cubic-bezier(0.16,1,0.3,1) both"
                : "slideUpSheet 300ms cubic-bezier(0.16,1,0.3,1) both",
              boxShadow: "0 -8px 24px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 8, position: "sticky", top: 0, background: "var(--surface-raised)" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border-strong)" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px 4px" }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                Navegar
              </span>
              <button
                type="button"
                onClick={closeSheet}
                aria-label="Fechar"
                style={{ width: 44, height: 44, borderRadius: 999, background: "transparent", border: "none", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <IcClose size={20} />
              </button>
            </div>

            {sheetGroups.map((group) => (
              <div key={group.secao} style={{ padding: "4px 12px 8px" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, color: "var(--text-disabled)", textTransform: "uppercase", letterSpacing: "0.16em", padding: "10px 4px 6px" }}>
                  {group.label}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
                  {group.modules.map((mod) => {
                    const active = isActive(location.pathname, mod.rota);
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => handleSheetNav(mod.rota)}
                        aria-label={mod.label}
                        aria-current={active ? "page" : undefined}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          minHeight: 80,
                          padding: "12px 6px",
                          background: "transparent",
                          border: "none",
                          borderRadius: 12,
                          cursor: "pointer",
                          color: active ? "var(--interactive-primary)" : "var(--text-secondary)",
                          WebkitTapHighlightColor: "transparent",
                          transition: "background 0.15s",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 44,
                            height: 44,
                            borderRadius: 999,
                            background: active ? "var(--status-sprout-muted)" : "var(--surface-hover)",
                          }}
                        >
                          {NAV_ICONS[mod.icone]?.(22)}
                        </span>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 500, textAlign: "center", lineHeight: 1.2, color: active ? "var(--interactive-primary)" : "var(--text-secondary)" }}>
                          {mod.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
