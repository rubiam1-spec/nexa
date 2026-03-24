import { useEffect, useState } from "react";
import { canPerformAction, PermissionAction } from "../../../app/authorization/permissions";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { getUserRoleLabel } from "../../../shared/types/role";
import { useCommercialSettings } from "../hooks/useCommercialSettings";

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <div
        onClick={() => !disabled && onChange(!checked)}
        style={{
          width: 40,
          height: 22,
          borderRadius: 11,
          background: checked ? "var(--color-sprout)" : "var(--color-stone)",
          cursor: disabled ? "not-allowed" : "pointer",
          position: "relative",
          transition: "background 150ms ease",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            position: "absolute",
            top: 3,
            left: checked ? 21 : 3,
            transition: "left 150ms ease",
          }}
        />
      </div>
      <span style={{ fontSize: 13, color: "var(--color-dust)" }}>{label}</span>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  background: "var(--color-sprout)",
  color: "var(--color-ink)",
  border: "none",
  borderRadius: 8,
  padding: "0 20px",
  height: 36,
  fontSize: 13,
  fontWeight: 700,
};

export default function SettingsPage() {
  const accountContext = useAccount();
  const developmentContext = useDevelopment();
  const settingsState = useCommercialSettings(
    accountContext.account?.accountId ?? null,
    developmentContext.development?.developmentId ?? null,
    accountContext.isUsingMock || developmentContext.isUsingMock,
    accountContext.account?.role ?? null,
  );
  const canUpdate = canPerformAction(accountContext.account?.role ?? null, PermissionAction.UPDATE_SETTINGS);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [accountForm, setAccountForm] = useState({
    reservationDurationHours: 48,
    requireAcceptedProposalForReservationRequest: true,
    requireCompleteClientDataForReservationRequest: false,
    queueEnabled: false,
  });
  const [developmentForm, setDevelopmentForm] = useState({
    reservationDurationHours: "",
    requireAcceptedProposalForReservationRequest: "",
    requireCompleteClientDataForReservationRequest: "",
    queueEnabled: "",
  });

  useEffect(() => {
    if (!settingsState.accountSettings) return;
    setAccountForm({
      reservationDurationHours: settingsState.accountSettings.reservationDurationHours,
      requireAcceptedProposalForReservationRequest: settingsState.accountSettings.requireAcceptedProposalForReservationRequest,
      requireCompleteClientDataForReservationRequest: settingsState.accountSettings.requireCompleteClientDataForReservationRequest,
      queueEnabled: settingsState.accountSettings.queueEnabled,
    });
  }, [settingsState.accountSettings]);

  useEffect(() => {
    if (!settingsState.developmentSettings) return;
    setDevelopmentForm({
      reservationDurationHours: settingsState.developmentSettings.reservationDurationHours?.toString() ?? "",
      requireAcceptedProposalForReservationRequest: settingsState.developmentSettings.requireAcceptedProposalForReservationRequest === null ? "" : settingsState.developmentSettings.requireAcceptedProposalForReservationRequest ? "true" : "false",
      requireCompleteClientDataForReservationRequest: settingsState.developmentSettings.requireCompleteClientDataForReservationRequest === null ? "" : settingsState.developmentSettings.requireCompleteClientDataForReservationRequest ? "true" : "false",
      queueEnabled: settingsState.developmentSettings.queueEnabled === null ? "" : settingsState.developmentSettings.queueEnabled ? "true" : "false",
    });
  }, [settingsState.developmentSettings]);

  if (settingsState.isLoading) return <p style={{ color: "var(--color-fog)" }}>Carregando configurações...</p>;
  if (accountContext.status === "no_access" || accountContext.status === "error") return <p style={{ color: "var(--color-fog)" }}>{accountContext.errorMessage ?? "Conta indisponível."}</p>;
  if (developmentContext.status === "empty" || developmentContext.status === "error") return <p style={{ color: "var(--color-fog)" }}>{developmentContext.errorMessage ?? "Empreendimento indisponível."}</p>;
  if (settingsState.status === "error") return <p style={{ color: "var(--color-red)" }}>{settingsState.errorMessage}</p>;

  async function handleSaveAccount() {
    setSuccessMsg(null);
    await settingsState.updateAccountSettings({
      reservationDurationHours: Number(accountForm.reservationDurationHours),
      requireAcceptedProposalForReservationRequest: accountForm.requireAcceptedProposalForReservationRequest,
      requireCompleteClientDataForReservationRequest: accountForm.requireCompleteClientDataForReservationRequest,
      queueEnabled: accountForm.queueEnabled,
    });
    if (!settingsState.errorMessage) {
      setSuccessMsg("Configurações salvas com sucesso");
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  }

  async function handleSaveDevelopment() {
    setSuccessMsg(null);
    await settingsState.updateDevelopmentSettings({
      reservationDurationHours: developmentForm.reservationDurationHours === "" ? null : Number(developmentForm.reservationDurationHours),
      requireAcceptedProposalForReservationRequest: developmentForm.requireAcceptedProposalForReservationRequest === "" ? null : developmentForm.requireAcceptedProposalForReservationRequest === "true",
      requireCompleteClientDataForReservationRequest: developmentForm.requireCompleteClientDataForReservationRequest === "" ? null : developmentForm.requireCompleteClientDataForReservationRequest === "true",
      queueEnabled: developmentForm.queueEnabled === "" ? null : developmentForm.queueEnabled === "true",
    });
    if (!settingsState.errorMessage) {
      setSuccessMsg("Configurações salvas com sucesso");
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-bone)", marginBottom: 4 }}>Configurações</h1>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-fog)", marginBottom: 24 }}>
        {accountContext.account?.accountName} · {developmentContext.development?.developmentName} · {getUserRoleLabel(accountContext.account?.role)}
      </div>

      {successMsg ? (
        <div style={{ background: "var(--color-sprout-muted)", border: "1px solid var(--color-sprout)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "var(--color-sprout)" }}>
          {successMsg}
        </div>
      ) : null}

      {/* Account settings */}
      <div className="nexa-card" style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-sprout)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, marginBottom: 16 }}>
          Configurações da conta
        </div>
        <label>
          <span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Prazo padrão de reserva (horas)</span>
          <input
            type="number"
            min={1}
            value={accountForm.reservationDurationHours}
            disabled={!canUpdate || settingsState.isSaving}
            onChange={(e) => setAccountForm((c) => ({ ...c, reservationDurationHours: Number(e.target.value) }))}
            style={{ maxWidth: 200 }}
          />
        </label>
        <Toggle
          checked={accountForm.requireAcceptedProposalForReservationRequest}
          disabled={!canUpdate || settingsState.isSaving}
          onChange={(v) => setAccountForm((c) => ({ ...c, requireAcceptedProposalForReservationRequest: v }))}
          label="Exigir proposta aceita para solicitar reserva"
        />
        <Toggle
          checked={accountForm.requireCompleteClientDataForReservationRequest}
          disabled={!canUpdate || settingsState.isSaving}
          onChange={(v) => setAccountForm((c) => ({ ...c, requireCompleteClientDataForReservationRequest: v }))}
          label="Exigir dados completos do cliente"
        />
        <Toggle
          checked={accountForm.queueEnabled}
          disabled={!canUpdate || settingsState.isSaving}
          onChange={(v) => setAccountForm((c) => ({ ...c, queueEnabled: v }))}
          label="Fila de reserva ativa"
        />
        <button type="button" disabled={!canUpdate || settingsState.isSaving} onClick={() => void handleSaveAccount()} style={{ ...btnPrimary, marginTop: 12 }}>
          Salvar configurações da conta
        </button>
      </div>

      {/* Development settings */}
      <div className="nexa-card" style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-sprout)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, marginBottom: 16 }}>
          Configurações do empreendimento
        </div>
        <p style={{ fontSize: 12, color: "var(--color-fog)", marginBottom: 16 }}>
          Campos vazios mantêm a herança da conta.
        </p>
        <div style={{ display: "grid", gap: 16, maxWidth: 400 }}>
          <label>
            <span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Prazo de reserva (override em horas)</span>
            <input type="number" min={1} value={developmentForm.reservationDurationHours} disabled={!canUpdate || settingsState.isSaving} onChange={(e) => setDevelopmentForm((c) => ({ ...c, reservationDurationHours: e.target.value }))} />
          </label>
          <label>
            <span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Exigir proposta aceita</span>
            <select value={developmentForm.requireAcceptedProposalForReservationRequest} disabled={!canUpdate || settingsState.isSaving} onChange={(e) => setDevelopmentForm((c) => ({ ...c, requireAcceptedProposalForReservationRequest: e.target.value }))}>
              <option value="">Herdar da conta</option>
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          </label>
          <label>
            <span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Exigir dados completos do cliente</span>
            <select value={developmentForm.requireCompleteClientDataForReservationRequest} disabled={!canUpdate || settingsState.isSaving} onChange={(e) => setDevelopmentForm((c) => ({ ...c, requireCompleteClientDataForReservationRequest: e.target.value }))}>
              <option value="">Herdar da conta</option>
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          </label>
          <label>
            <span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Fila de reserva</span>
            <select value={developmentForm.queueEnabled} disabled={!canUpdate || settingsState.isSaving} onChange={(e) => setDevelopmentForm((c) => ({ ...c, queueEnabled: e.target.value }))}>
              <option value="">Herdar da conta</option>
              <option value="true">Ativa</option>
              <option value="false">Inativa</option>
            </select>
          </label>
        </div>
        <button type="button" disabled={!canUpdate || settingsState.isSaving} onClick={() => void handleSaveDevelopment()} style={{ ...btnPrimary, marginTop: 16 }}>
          Salvar configurações do empreendimento
        </button>
      </div>

      {!canUpdate ? (
        <p style={{ color: "var(--color-terracotta)", fontSize: 12 }}>
          Seu perfil não possui permissão para alterar configurações.
        </p>
      ) : null}

      {/* Effective rules */}
      {settingsState.effectiveSettings ? (
        <div className="nexa-card">
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-sprout)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, marginBottom: 16 }}>
            Regra efetiva em uso
          </div>
          <div style={{ fontSize: 13, color: "var(--color-dust)", display: "grid", gap: 6 }}>
            <div>Prazo de reserva: <span style={{ color: "var(--color-bone)", fontWeight: 600 }}>{settingsState.effectiveSettings.reservationDurationHours}h</span></div>
            <div>Proposta aceita obrigatória: <span style={{ color: "var(--color-bone)", fontWeight: 600 }}>{settingsState.effectiveSettings.requireAcceptedProposalForReservationRequest ? "Sim" : "Não"}</span></div>
            <div>Dados completos obrigatórios: <span style={{ color: "var(--color-bone)", fontWeight: 600 }}>{settingsState.effectiveSettings.requireCompleteClientDataForReservationRequest ? "Sim" : "Não"}</span></div>
            <div>Fila ativa: <span style={{ color: "var(--color-bone)", fontWeight: 600 }}>{settingsState.effectiveSettings.queueEnabled ? "Sim" : "Não"}</span></div>
          </div>
        </div>
      ) : null}

      {settingsState.errorMessage ? <p style={{ color: "var(--color-red)", marginTop: 12, fontSize: 12 }}>{settingsState.errorMessage}</p> : null}
    </div>
  );
}
