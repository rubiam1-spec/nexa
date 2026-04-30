import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from "react";
import Avatar from "./Avatar";

// Tokens v7 hardcoded (hex dos T.*) — componente é autoportante.
const T = {
  carbon: "#1C1B18",
  stone: "#2A2822",
  chalk: "#FAF9F6",
  fog: "#9C9686",
  slate: "#706B5F",
  red: "#F87171",
  dividerBg: "rgba(61,58,48,0.4)",
  borderColor: "rgba(61,58,48,0.4)",
};

interface UserMenuProfile {
  fullName: string;
  email: string;
  avatarUrl?: string | null;
}

interface UserMenuAccount {
  role: string;
  accountName: string;
}

interface UserMenuProps {
  profile: UserMenuProfile;
  account: UserMenuAccount;
  onProfile: () => void;
  onSettings: () => void;
  onSwitchDevelopment: () => void;
  onSwitchAccount: () => void;
  onSignOut: () => void;
  /** Label acessível do botão trigger. Default: "Menu da conta". */
  triggerLabel?: string;
  /** Tamanho do avatar no trigger. Default: 32. */
  triggerSize?: number;
}

export default function UserMenu({
  profile,
  account,
  onProfile,
  onSettings,
  onSwitchDevelopment,
  onSwitchAccount,
  onSignOut,
  triggerLabel = "Menu da conta",
  triggerSize = 32,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Click-outside via mousedown listener no document.
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      const wrap = wrapperRef.current;
      if (!wrap) return;
      if (wrap.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  // ESC fecha.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function runThenClose(fn: () => void) {
    return () => {
      setOpen(false);
      // Deixa o fechamento terminar antes de executar a navegação — evita
      // flash visual em navegação síncrona.
      window.setTimeout(fn, 0);
    };
  }

  return (
    <div ref={wrapperRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="usermenu-trigger"
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          borderRadius: "50%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform 120ms ease",
        }}
      >
        <Avatar name={profile.fullName} avatarUrl={profile.avatarUrl ?? null} size={triggerSize} />
      </button>

      {open ? (
        <div
          role="menu"
          data-testid="usermenu-dropdown"
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 8,
            minWidth: 260,
            maxWidth: 320,
            background: T.carbon,
            border: `0.5px solid ${T.borderColor}`,
            borderRadius: 12,
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            overflow: "hidden",
            zIndex: 9000,
          }}
        >
          {/* Header */}
          <div style={{ padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar name={profile.fullName} avatarUrl={profile.avatarUrl ?? null} size={40} />
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span
                data-testid="usermenu-name"
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  color: T.chalk,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {profile.fullName || "Usuário"}
              </span>
              <span
                data-testid="usermenu-email"
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 12,
                  fontWeight: 400,
                  color: T.fog,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {profile.email}
              </span>
              <span
                data-testid="usermenu-context"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  fontWeight: 500,
                  color: T.slate,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  marginTop: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {account.role} · {account.accountName}
              </span>
            </div>
          </div>

          <Divider />

          <MenuItem
            icon={<IcUser />}
            label="Perfil"
            onClick={runThenClose(onProfile)}
            testId="usermenu-item-profile"
          />
          <MenuItem
            icon={<IcGear />}
            label="Configurações"
            onClick={runThenClose(onSettings)}
            testId="usermenu-item-settings"
          />
          <MenuItem
            icon={<IcBuilding />}
            label="Trocar empreendimento"
            onClick={runThenClose(onSwitchDevelopment)}
            testId="usermenu-item-switch-development"
          />
          <MenuItem
            icon={<IcSwap />}
            label="Trocar de conta"
            onClick={runThenClose(onSwitchAccount)}
            testId="usermenu-item-switch-account"
          />

          <Divider />

          <MenuItem
            icon={<IcLogout />}
            label="Sair"
            danger
            onClick={runThenClose(onSignOut)}
            testId="usermenu-item-signout"
          />
        </div>
      ) : null}
    </div>
  );
}

// ── atoms ──

function Divider() {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      style={{ height: "0.5px", background: T.dividerBg, margin: "4px 0" }}
    />
  );
}

interface MenuItemProps {
  icon: ReactElement;
  label: string;
  onClick: () => void;
  danger?: boolean;
  testId?: string;
}

function MenuItem({ icon, label, onClick, danger = false, testId }: MenuItemProps) {
  const [hover, setHover] = useState(false);
  const style: CSSProperties = {
    height: 42,
    width: "100%",
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: hover ? T.stone : "transparent",
    color: danger ? T.red : T.chalk,
    border: "none",
    fontFamily: "'Outfit', sans-serif",
    fontSize: 14,
    fontWeight: 400,
    cursor: "pointer",
    textAlign: "left",
    transition: "background 120ms ease",
  };
  return (
    <button
      type="button"
      role="menuitem"
      data-testid={testId}
      data-danger={danger ? "true" : undefined}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={style}
    >
      <span style={{ display: "inline-flex", width: 16, height: 16, alignItems: "center", justifyContent: "center", color: danger ? T.red : T.fog, flexShrink: 0 }}>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

// ── icons (SVG inline, stroke 1.6, 16x16) ──

function IcUser() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}
function IcGear() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}
function IcBuilding() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
    </svg>
  );
}
function IcSwap() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 4 21 10 15 10" />
      <path d="M3 14a9 9 0 0115.5-6L21 10" />
      <polyline points="3 20 3 14 9 14" />
      <path d="M21 10a9 9 0 01-15.5 6L3 14" />
    </svg>
  );
}
function IcLogout() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
