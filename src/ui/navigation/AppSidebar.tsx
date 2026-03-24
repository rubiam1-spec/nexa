import { NavLink } from "react-router-dom";
import { useAuth } from "../../app/contexts/AuthContext";
import { useAccount } from "../../app/contexts/AccountContext";
import { getUserRoleLabel } from "../../shared/types/role";
import { navigationConfig } from "../../app/navigation/navigationConfig";
import NexaIcon from "../../shared/components/NexaIcon";

export default function AppSidebar() {
  const { user } = useAuth();
  const { account } = useAccount();
  const initial = (user?.name ?? user?.email ?? "N").charAt(0).toUpperCase();

  return (
    <aside
      style={{
        width: 240,
        height: "100%",
        background: "#0E0D0B",
        borderRight: "1px solid var(--color-stone)",
        display: "flex",
        flexDirection: "column",
        padding: "16px 12px",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "4px 12px 16px",
          borderBottom: "1px solid var(--color-stone)",
          marginBottom: 16,
        }}
      >
        <NexaIcon size={22} />
        <span
          style={{
            fontWeight: 800,
            fontSize: 14,
            letterSpacing: "0.1em",
            color: "var(--color-chalk)",
          }}
        >
          NEXA
        </span>
      </div>

      {/* Section label */}
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--color-fog)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          padding: "0 12px 8px",
        }}
      >
        Navegação
      </div>

      {/* Navigation items */}
      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          flex: 1,
        }}
      >
        {navigationConfig.map((item) => (
          <NavLink
            key={item.key}
            to={item.path}
            style={({ isActive }) => ({
              padding: "8px 12px",
              borderRadius: 6,
              textDecoration: "none",
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? "var(--color-sprout)" : "var(--color-dust)",
              background: isActive ? "var(--color-sprout-muted)" : "transparent",
              transition: "background 150ms ease, color 150ms ease",
            })}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer — user info */}
      <div
        style={{
          borderTop: "1px solid var(--color-stone)",
          paddingTop: 16,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "var(--color-stone)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--color-bone)",
            flexShrink: 0,
          }}
        >
          {initial}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--color-bone)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user?.name ?? user?.email ?? "Usuário"}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--color-fog)",
            }}
          >
            {getUserRoleLabel(account?.role)}
          </div>
        </div>
      </div>
    </aside>
  );
}
