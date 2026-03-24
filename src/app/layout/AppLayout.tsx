import { useNavigate } from "react-router-dom";
import { useAccount } from "../contexts/AccountContext";
import { useDevelopment } from "../contexts/DevelopmentContext";
import { useAuth } from "../contexts/AuthContext";
import AppSidebar from "../../ui/navigation/AppSidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { account } = useAccount();
  const { development } = useDevelopment();
  const { signOut } = useAuth();

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: "var(--color-ink)",
        overflow: "hidden",
      }}
    >
      <AppSidebar />
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
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--color-stone)",
            background: "var(--color-carbon)",
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--color-fog)",
              }}
            >
              {account?.accountName ?? "Sem conta"}
              {" · "}
              {development?.developmentName ?? "Sem empreendimento"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => navigate("/selecionar-empreendimento")}
              style={{
                background: "transparent",
                color: "var(--color-bone)",
                border: "1px solid var(--color-stone)",
                borderRadius: 8,
                padding: "0 12px",
                height: 32,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Trocar empreendimento
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              style={{
                background: "transparent",
                color: "var(--color-fog)",
                border: "none",
                borderRadius: 8,
                padding: "0 12px",
                height: 32,
                fontSize: 12,
              }}
            >
              Sair
            </button>
          </div>
        </header>

        {/* Main content */}
        <main
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 24,
            background: "var(--color-ink)",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
