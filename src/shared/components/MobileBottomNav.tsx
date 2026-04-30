import { useEffect, useState, type CSSProperties, type ReactElement } from "react";
import { useNavigate, useLocation } from "react-router-dom";

interface IconProps { size?: number }
const svgBase = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

const IcHome = ({ size = 24 }: IconProps) => (
  <svg {...svgBase(size)}>
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const IcPipeline = ({ size = 24 }: IconProps) => (
  <svg {...svgBase(size)}>
    <rect x="3" y="3" width="7" height="18" rx="1.5" />
    <rect x="14" y="3" width="7" height="11" rx="1.5" />
  </svg>
);
const IcCalculator = ({ size = 24 }: IconProps) => (
  <svg {...svgBase(size)}>
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <line x1="8" y1="6" x2="16" y2="6" />
    <line x1="8" y1="11" x2="8.01" y2="11" />
    <line x1="12" y1="11" x2="12.01" y2="11" />
    <line x1="16" y1="11" x2="16.01" y2="11" />
    <line x1="8" y1="15" x2="8.01" y2="15" />
    <line x1="12" y1="15" x2="12.01" y2="15" />
    <line x1="16" y1="15" x2="16.01" y2="15" />
    <line x1="8" y1="19" x2="8.01" y2="19" />
    <line x1="12" y1="19" x2="12.01" y2="19" />
    <line x1="16" y1="19" x2="16.01" y2="19" />
  </svg>
);
const IcGrid = ({ size = 24 }: IconProps) => (
  <svg {...svgBase(size)}>
    <circle cx="5" cy="5" r="1" />
    <circle cx="12" cy="5" r="1" />
    <circle cx="19" cy="5" r="1" />
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="19" r="1" />
    <circle cx="12" cy="19" r="1" />
    <circle cx="19" cy="19" r="1" />
  </svg>
);
const IcUsers = ({ size = 24 }: IconProps) => (
  <svg {...svgBase(size)}>
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);
const IcActivity = ({ size = 24 }: IconProps) => (
  <svg {...svgBase(size)}>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);
const IcBroker = ({ size = 24 }: IconProps) => (
  <svg {...svgBase(size)}>
    <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="19" y1="8" x2="19" y2="14" />
    <line x1="22" y1="11" x2="16" y2="11" />
  </svg>
);
const IcReport = ({ size = 24 }: IconProps) => (
  <svg {...svgBase(size)}>
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);
const IcSettings = ({ size = 24 }: IconProps) => (
  <svg {...svgBase(size)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83" />
  </svg>
);
const IcBell = ({ size = 24 }: IconProps) => (
  <svg {...svgBase(size)}>
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 01-3.46 0" />
  </svg>
);
const IcUnits = ({ size = 24 }: IconProps) => (
  <svg {...svgBase(size)}>
    <path d="M3 21h18" />
    <path d="M5 21V7l8-4v18" />
    <path d="M19 21V11l-6-4" />
  </svg>
);
const IcBuilding = ({ size = 24 }: IconProps) => (
  <svg {...svgBase(size)}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <line x1="15" y1="3" x2="15" y2="21" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="15" x2="21" y2="15" />
  </svg>
);
const IcClose = ({ size = 20 }: IconProps) => (
  <svg {...svgBase(size)}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

type BottomItem =
  | { id: string; label: string; Icon: (p: IconProps) => ReactElement; path: string; action?: undefined }
  | { id: string; label: string; Icon: (p: IconProps) => ReactElement; action: "sheet"; path?: undefined };

const BOTTOM_ITEMS: BottomItem[] = [
  { id: "central", label: "Central", Icon: IcHome, path: "/" },
  { id: "pipeline", label: "Pipeline", Icon: IcPipeline, path: "/pipeline" },
  { id: "simular", label: "Simular", Icon: IcCalculator, path: "/simulador" },
  { id: "mais", label: "Mais", Icon: IcGrid, action: "sheet" },
];

const SHEET_ITEMS: { id: string; label: string; Icon: (p: IconProps) => ReactElement; path: string }[] = [
  { id: "contatos", label: "Contatos", Icon: IcUsers, path: "/contatos" },
  { id: "atividades", label: "Atividades", Icon: IcActivity, path: "/atividades" },
  { id: "corretores", label: "Corretores", Icon: IcBroker, path: "/corretores" },
  // "Mapa" unificado em "Unidades" (mesma página, mesma rota).
  { id: "relatorios", label: "Relatórios", Icon: IcReport, path: "/relatorios" },
  { id: "configuracoes", label: "Config.", Icon: IcSettings, path: "/configuracoes" },
  { id: "notificacoes", label: "Notif.", Icon: IcBell, path: "/notificacoes" },
  { id: "unidades", label: "Unidades", Icon: IcUnits, path: "/unidades" },
  { id: "imoveis", label: "Imóveis", Icon: IcBuilding, path: "/imoveis" },
];

function isActive(pathname: string, itemPath: string): boolean {
  if (itemPath === "/") return pathname === "/" || pathname === "/central" || pathname === "/meu-dia" || pathname === "/dashboard";
  return pathname === itemPath || pathname.startsWith(itemPath + "/");
}

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetClosing, setSheetClosing] = useState(false);

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

  function handleItemTap(item: BottomItem) {
    if (item.action === "sheet") { setSheetOpen(true); return; }
    navigate(item.path);
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

  return (
    <>
      <nav style={navStyle} role="navigation" aria-label="Navegação principal">
        {BOTTOM_ITEMS.map((item) => {
          const active = item.action === "sheet" ? false : isActive(location.pathname, item.path);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleItemTap(item)}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
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
                color: active ? "var(--interactive-primary)" : "var(--text-muted)",
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
                  background: active ? "var(--status-sprout-muted)" : "transparent",
                  transition: "background 0.15s",
                }}
              >
                <item.Icon size={22} />
              </span>
              <span
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 10,
                  fontWeight: 500,
                  lineHeight: 1,
                  letterSpacing: "0.01em",
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
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
              animation: sheetClosing
                ? "fadeOut 200ms ease both"
                : "fadeIn 200ms ease both",
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
              zIndex: 1060,
              background: "var(--surface-raised)",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              paddingBottom: "env(safe-area-inset-bottom)",
              animation: sheetClosing
                ? "slideDownSheet 240ms cubic-bezier(0.16,1,0.3,1) both"
                : "slideUpSheet 300ms cubic-bezier(0.16,1,0.3,1) both",
              boxShadow: "0 -8px 24px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border-strong)" }} />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 16px 4px",
              }}
            >
              <span
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                Navegar
              </span>
              <button
                type="button"
                onClick={closeSheet}
                aria-label="Fechar"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <IcClose size={20} />
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 4,
                padding: "8px 12px 16px",
              }}
            >
              {SHEET_ITEMS.map((it) => {
                const active = isActive(location.pathname, it.path.split("?")[0]);
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => handleSheetNav(it.path)}
                    aria-label={it.label}
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
                      <it.Icon size={22} />
                    </span>
                    <span
                      style={{
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: 11,
                        fontWeight: 500,
                        color: "var(--text-secondary)",
                      }}
                    >
                      {it.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
