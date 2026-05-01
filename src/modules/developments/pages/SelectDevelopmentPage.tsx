import { useNavigate } from "react-router-dom";
import { useAvailableDevelopments } from "../hooks/useAvailableDevelopments";
import NexaIcon from "../../../shared/components/NexaIcon";

export default function SelectDevelopmentPage() {
  const navigate = useNavigate();
  const {
    accountContext: {
      account,
      availableAccounts,
      errorMessage: accountErrorMessage,
      isLoading: isLoadingAccounts,
      selectAccount,
      status: accountStatus,
    },
    developmentContext: {
      availableDevelopments,
      errorMessage: developmentErrorMessage,
      isLoading: isLoadingDevelopments,
      selectDevelopment,
      status: developmentStatus,
    },
  } = useAvailableDevelopments();

  function handleSelectDevelopment(developmentId: string) {
    const postSelectUrl = localStorage.getItem("nexa_oauth_post_select_url");

    selectDevelopment(developmentId);

    if (postSelectUrl) {
      localStorage.removeItem("nexa_oauth_post_select_url");
      setTimeout(() => {
        window.location.href = postSelectUrl;
      }, 300);
      return;
    }

    navigate("/");
  }

  if (isLoadingAccounts || isLoadingDevelopments) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--color-ink)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--color-fog)" }}>Carregando contexto operacional...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-ink)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "var(--color-carbon)",
          border: "1px solid var(--color-stone)",
          borderRadius: 12,
          padding: 40,
          maxWidth: 480,
          width: "100%",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <NexaIcon size={28} />
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "0.1em", color: "var(--color-chalk)" }}>
            NEXA
          </span>
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-fog)", marginBottom: 32 }}>
          Plataforma comercial imobiliária
        </p>

        {/* Title */}
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-bone)", margin: "0 0 4px" }}>
          Selecionar empreendimento
        </h1>
        <p style={{ fontSize: 13, color: "var(--color-fog)", marginBottom: 24 }}>
          Selecione a conta e o empreendimento para iniciar a operação.
        </p>

        {/* Errors */}
        {accountStatus === "no_access" ? (
          <p style={{ color: "var(--color-red)", fontSize: 12, marginBottom: 16 }}>
            {accountErrorMessage ?? "Usuário sem acesso a conta."}
          </p>
        ) : null}
        {accountStatus === "error" ? (
          <p style={{ color: "var(--color-red)", fontSize: 12, marginBottom: 16 }}>
            {accountErrorMessage ?? "Falha ao carregar contas acessíveis."}
          </p>
        ) : null}

        {/* Account selection */}
        {availableAccounts.length > 0 ? (
          <div style={{ marginBottom: 24 }}>
            <div className="nexa-label" style={{ marginBottom: 8 }}>Conta</div>
            <div style={{ display: "grid", gap: 8 }}>
              {availableAccounts.map((acc) => {
                const isSelected = account?.accountId === acc.accountId;
                return (
                  <button
                    key={acc.accountId}
                    type="button"
                    onClick={() => selectAccount(acc.accountId)}
                    style={{
                      background: "var(--color-stone)",
                      color: isSelected ? "var(--color-sprout)" : "var(--color-bone)",
                      border: isSelected ? "1px solid var(--color-sprout)" : "1px solid var(--color-stone)",
                      borderRadius: 8,
                      padding: "10px 16px",
                      width: "100%",
                      textAlign: "left",
                      fontSize: 13,
                      fontWeight: isSelected ? 600 : 400,
                    }}
                  >
                    {acc.accountName}
                  </button>
                );
              })}
            </div>
          </div>
        ) : accountStatus !== "loading" ? (
          <p style={{ color: "var(--color-fog)", fontSize: 13, marginBottom: 16 }}>
            Nenhuma conta disponível.
          </p>
        ) : null}

        {/* Development selection */}
        {availableDevelopments.length > 0 ? (
          <div>
            <div className="nexa-label" style={{ marginBottom: 8 }}>Empreendimento</div>
            <div style={{ display: "grid", gap: 8 }}>
              {availableDevelopments.map((dev) => (
                <div
                  key={dev.developmentId}
                  style={{
                    background: "var(--color-ink)",
                    border: "1px solid var(--color-stone)",
                    borderRadius: 8,
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-bone)" }}>
                      {dev.developmentName}
                    </div>
                    <span
                      className="nexa-badge"
                      style={{
                        marginTop: 4,
                        color: dev.status === "active" ? "var(--color-sprout)" : "var(--color-fog)",
                        background: dev.status === "active" ? "var(--color-sprout-muted)" : "rgba(156,150,134,0.12)",
                      }}
                    >
                      {dev.status === "active" ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={dev.status !== "active"}
                    onClick={() => handleSelectDevelopment(dev.developmentId)}
                    style={{
                      background: dev.status === "active" ? "var(--color-sprout)" : "var(--color-stone)",
                      color: dev.status === "active" ? "var(--color-ink)" : "var(--color-fog)",
                      border: "none",
                      borderRadius: 8,
                      padding: "0 16px",
                      height: 36,
                      fontSize: 13,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    Selecionar
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {developmentStatus === "empty" ? (
          <p style={{ color: "var(--color-fog)", fontSize: 13, marginTop: 16 }}>
            {developmentErrorMessage ?? "Nenhum empreendimento disponível para esta conta."}
          </p>
        ) : null}
        {developmentStatus === "error" ? (
          <p style={{ color: "var(--color-red)", fontSize: 12, marginTop: 16 }}>
            {developmentErrorMessage ?? "Falha ao carregar empreendimentos."}
          </p>
        ) : null}
      </div>
    </div>
  );
}
