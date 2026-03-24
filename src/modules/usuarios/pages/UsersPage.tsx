import { useEffect, useRef, useState } from "react";
import { useAccount } from "../../../app/contexts/AccountContext";
import type { UserRole } from "../../../shared/types/auth";
import { getUserRoleLabel } from "../../../shared/types/role";
import { useUsers } from "../hooks/useUsers";

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: "director", label: "Diretor" },
  { value: "manager", label: "Gestor" },
  { value: "commercial_consultant", label: "Consultor comercial" },
  { value: "broker", label: "Corretor" },
  { value: "administrative", label: "Administrativo" },
];

const btnPrimary: React.CSSProperties = {
  background: "var(--color-sprout)",
  color: "var(--color-ink)",
  border: "none",
  borderRadius: 8,
  padding: "0 16px",
  height: 36,
  fontSize: 13,
  fontWeight: 700,
};

const btnSecondary: React.CSSProperties = {
  background: "transparent",
  color: "var(--color-bone)",
  border: "1px solid var(--color-stone)",
  borderRadius: 8,
  padding: "0 16px",
  height: 36,
  fontSize: 13,
  fontWeight: 700,
};

export default function UsersPage() {
  const { account, errorMessage: accountErrorMessage, isUsingMock, status: accountStatus } = useAccount();
  const { users, errorMessage, isLoading, isInviting, status, inviteUser } = useUsers(account?.accountId ?? null, isUsingMock);
  const activeCount = users.filter((u) => u.status === "active").length;

  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("commercial_consultant");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fullNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showForm) fullNameRef.current?.focus();
  }, [showForm]);

  async function handleInvite() {
    if (!email.trim() || !fullName.trim()) return;
    setSuccessMessage(null);

    const result = await inviteUser({
      email: email.trim(),
      fullName: fullName.trim(),
      role,
    });

    if (result) {
      setSuccessMessage(`Convite enviado para ${result.email}. O usuário receberá um e-mail de confirmação.`);
      setEmail("");
      setFullName("");
      setRole("commercial_consultant");
      setShowForm(false);
    }
  }

  if (isLoading) return <p style={{ color: "var(--color-fog)" }}>Carregando usuários...</p>;
  if (accountStatus === "no_access" || accountStatus === "error") return <p style={{ color: "var(--color-fog)" }}>{accountErrorMessage ?? "Conta indisponível."}</p>;
  if (status === "error" && !users.length) return <p style={{ color: "var(--color-red)" }}>{errorMessage}</p>;
  if (status === "idle") return <p style={{ color: "var(--color-fog)" }}>Selecione uma conta para continuar.</p>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-bone)", margin: 0 }}>Usuários</h1>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-fog)", marginTop: 4 }}>
            {users.length} registros · {activeCount} ativos
          </div>
        </div>
        <button type="button" onClick={() => { setShowForm((p) => !p); setSuccessMessage(null); }} style={showForm ? btnSecondary : btnPrimary}>
          {showForm ? "Cancelar" : "Convidar usuário"}
        </button>
      </div>

      {/* Success message */}
      {successMessage ? (
        <div style={{ background: "var(--color-sprout-muted)", border: "1px solid var(--color-sprout)", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "var(--color-sprout)" }}>
          {successMessage}
        </div>
      ) : null}

      {/* Invite form */}
      {showForm ? (
        <div className="nexa-card" style={{ marginBottom: 24 }}>
          <div className="nexa-label" style={{ marginBottom: 16 }}>Convidar novo usuário</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, maxWidth: 700 }}>
            <label>
              <span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Nome completo *</span>
              <input
                ref={fullNameRef}
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nome do usuário"
              />
            </label>
            <label>
              <span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>E-mail *</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </label>
            <label>
              <span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Perfil</span>
              <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                {roleOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button
              type="button"
              disabled={!email.trim() || !fullName.trim() || isInviting}
              onClick={() => void handleInvite()}
              style={btnPrimary}
            >
              {isInviting ? "Enviando convite..." : "Enviar convite"}
            </button>
          </div>
          {errorMessage ? <p style={{ color: "var(--color-red)", marginTop: 8, fontSize: 12 }}>{errorMessage}</p> : null}
          <p style={{ color: "var(--color-fog)", fontSize: 11, marginTop: 12 }}>
            O usuário receberá um e-mail de confirmação para ativar o acesso.
          </p>
        </div>
      ) : null}

      {/* Users table */}
      {users.length === 0 ? (
        <div className="nexa-card"><p style={{ color: "var(--color-fog)" }}>Nenhum usuário encontrado.</p></div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="nexa-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ color: "var(--color-bone)", fontWeight: 600 }}>{u.fullName}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className="nexa-badge" style={{ color: "var(--color-blue)", background: "var(--color-blue-muted)" }}>
                      {getUserRoleLabel(u.role)}
                    </span>
                  </td>
                  <td>
                    <span className="nexa-badge" style={{
                      color: u.status === "active" ? "var(--color-sprout)" : "var(--color-fog)",
                      background: u.status === "active" ? "var(--color-sprout-muted)" : "rgba(156,150,134,0.12)",
                    }}>
                      {u.status === "active" ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
