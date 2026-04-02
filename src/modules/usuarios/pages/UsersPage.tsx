import { useEffect, useRef, useState } from "react";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useAuth } from "../../../app/contexts/AuthContext";
import type { UserRole } from "../../../shared/types/auth";
import { getUserRoleLabel } from "../../../shared/types/role";
import { getPermissions } from "../../../shared/utils/permissoes";
import { useUsers } from "../hooks/useUsers";
import { useIsMobile } from "../../../shared/hooks/useIsMobile";
import {
  updateUserRole,
  deactivateUser,
  reactivateUser,
  countUserNegotiations,
  deleteUser,
} from "../../../infra/repositories/usersSupabaseRepository";
import type { AccountUser } from "../../../shared/types/accountUser";

const roleOptions: Array<{ value: UserRole; label: string; desc: string }> = [
  { value: "director", label: "Diretor", desc: "Acesso total, configurações estruturais" },
  { value: "manager", label: "Gestor Comercial", desc: "Acesso completo exceto configurações" },
  { value: "commercial_consultant", label: "Consultor Comercial", desc: "Negocia, propõe, solicita reserva" },
  { value: "administrative", label: "Administrativo", desc: "Acesso operacional completo, sem gerenciar usuários" },
  { value: "concierge", label: "Concierge", desc: "Cadastros, documentos e verificação de vendas" },
];

const btnP: React.CSSProperties = { background: "var(--color-sprout)", color: "var(--color-ink)", border: "none", borderRadius: 8, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 700, cursor: "pointer" };
const btnS: React.CSSProperties = { background: "transparent", color: "var(--color-bone)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 700, cursor: "pointer" };
const btnDanger: React.CSSProperties = { background: "#F87171", color: "var(--interactive-on-primary)", border: "none", borderRadius: 8, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 700, cursor: "pointer" };

// ── Action menu ──

type MenuTarget = { user: AccountUser; rect: DOMRect } | null;

function UserActionMenu({ target, onClose, onAction }: {
  target: MenuTarget;
  onClose: () => void;
  onAction: (action: string, user: AccountUser) => void;
}) {
  if (!target) return null;
  const { user, rect } = target;
  const isActive = user.status === "active";
  const s: React.CSSProperties = { display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", fontSize: 13, padding: "8px 12px", borderRadius: 6, cursor: "pointer" };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 900 }} onClick={onClose} />
      <div style={{ position: "fixed", top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right), zIndex: 901, background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 10, padding: 4, minWidth: 180, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
        <button type="button" onClick={() => { onAction("changeRole", user); onClose(); }} style={{ ...s, color: "var(--color-bone)" }}>Alterar perfil</button>
        <button type="button" onClick={() => { onAction("resend", user); onClose(); }} style={{ ...s, color: "var(--color-bone)" }}>Reenviar acesso</button>
        {isActive ? (
          <button type="button" onClick={() => { onAction("deactivate", user); onClose(); }} style={{ ...s, color: "var(--color-bone)" }}>Desativar usuário</button>
        ) : (
          <button type="button" onClick={() => { onAction("reactivate", user); onClose(); }} style={{ ...s, color: "var(--color-sprout)" }}>Reativar usuário</button>
        )}
        <button type="button" onClick={() => { onAction("delete", user); onClose(); }} style={{ ...s, color: "#F87171" }}>Excluir usuário</button>
      </div>
    </>
  );
}

// ── Page ──

export default function UsersPage() {
  const { account, errorMessage: accountErrorMessage, isUsingMock, status: accountStatus } = useAccount();
  const { authenticatedProfile } = useAuth();
  const { users, errorMessage, isLoading, isInviting, status, inviteUser, refetch } = useUsers(account?.accountId ?? null, isUsingMock);
  const isMobile = useIsMobile();
  const perms = getPermissions(account?.role ?? null);
  const currentUserId = authenticatedProfile?.id ?? null;

  // Invite form
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("commercial_consultant");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [linkAcesso, setLinkAcesso] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const fullNameRef = useRef<HTMLInputElement>(null);

  // Action state
  const [menuTarget, setMenuTarget] = useState<MenuTarget>(null);
  const [modal, setModal] = useState<{ type: string; user: AccountUser; negCount?: number } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [changeRoleValue, setChangeRoleValue] = useState<UserRole>("commercial_consultant");

  // Filter
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    if (showForm) fullNameRef.current?.focus();
  }, [showForm]);

  const activeCount = users.filter((u) => u.status === "active").length;
  const inactiveCount = users.length - activeCount;
  const visibleUsers = showInactive ? users : users.filter((u) => u.status === "active");

  async function handleInvite() {
    if (!email.trim() || !fullName.trim()) return;
    setSuccessMessage(null); setErrMsg(null);
    const result = await inviteUser({ email: email.trim(), fullName: fullName.trim(), role });
    if (result) {
      setSuccessMessage(`Convite enviado para ${result.user.email}.`);
      setLinkAcesso(result.link ?? null);
      setCopiado(false);
      setEmail(""); setFullName(""); setRole("commercial_consultant"); setShowForm(false);
    }
  }

  function handleMenuAction(action: string, user: AccountUser) {
    if (action === "changeRole") {
      setChangeRoleValue(user.role ?? "commercial_consultant");
      setModal({ type: "changeRole", user });
    } else if (action === "resend") {
      void handleResend(user);
    } else if (action === "deactivate") {
      setModal({ type: "deactivate", user });
    } else if (action === "reactivate") {
      void executeReactivate(user);
    } else if (action === "delete") {
      void checkAndDelete(user);
    }
  }

  async function handleResend(user: AccountUser) {
    setActionBusy(true); setErrMsg(null); setSuccessMessage(null); setLinkAcesso(null);
    try {
      const result = await inviteUser({ email: user.email, fullName: user.fullName, role: user.role ?? "commercial_consultant" });
      if (result?.link) { setLinkAcesso(result.link); setCopiado(false); }
      setSuccessMessage(`Link de acesso gerado para ${user.fullName}.`);
    } catch (e: unknown) { setErrMsg(e instanceof Error ? e.message : "Falha ao gerar link."); }
    finally { setActionBusy(false); }
  }

  async function executeChangeRole() {
    if (!modal || !account?.accountId) return;
    setActionBusy(true); setErrMsg(null);
    try {
      await updateUserRole(modal.user.id, account.accountId, changeRoleValue);
      setSuccessMessage(`Perfil de ${modal.user.fullName} atualizado para ${getUserRoleLabel(changeRoleValue)}.`);
      setModal(null); refetch();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (e: unknown) { setErrMsg(e instanceof Error ? e.message : "Falha ao atualizar."); setModal(null); }
    finally { setActionBusy(false); }
  }

  async function executeDeactivate() {
    if (!modal) return;
    setActionBusy(true); setErrMsg(null);
    try {
      await deactivateUser(modal.user.id);
      setSuccessMessage(`${modal.user.fullName} desativado.`);
      setModal(null); refetch();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (e: unknown) { setErrMsg(e instanceof Error ? e.message : "Falha ao desativar."); setModal(null); }
    finally { setActionBusy(false); }
  }

  async function executeReactivate(user: AccountUser) {
    setActionBusy(true); setErrMsg(null);
    try {
      await reactivateUser(user.id);
      setSuccessMessage(`${user.fullName} reativado.`);
      refetch();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (e: unknown) { setErrMsg(e instanceof Error ? e.message : "Falha ao reativar."); }
    finally { setActionBusy(false); }
  }

  async function checkAndDelete(user: AccountUser) {
    setActionBusy(true); setErrMsg(null);
    try {
      const count = await countUserNegotiations(user.id);
      if (count > 0) {
        setModal({ type: "deleteBlocked", user, negCount: count });
      } else {
        setModal({ type: "delete", user });
      }
    } catch { setModal({ type: "delete", user }); }
    finally { setActionBusy(false); }
  }

  async function executeDelete() {
    if (!modal || !account?.accountId) return;
    setActionBusy(true); setErrMsg(null);
    try {
      await deleteUser(modal.user.id, account.accountId);
      setSuccessMessage(`${modal.user.fullName} excluído.`);
      setModal(null); refetch();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (e: unknown) { setErrMsg(e instanceof Error ? e.message : "Falha ao excluir."); setModal(null); }
    finally { setActionBusy(false); }
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
            {users.length} registros · {activeCount} ativos{inactiveCount > 0 ? ` · ${inactiveCount} inativos` : ""}
          </div>
        </div>
        {perms.canManageUsers ? (
          <button type="button" onClick={() => { setShowForm((p) => !p); setSuccessMessage(null); setLinkAcesso(null); setCopiado(false); setErrMsg(null); }} style={showForm ? btnS : btnP}>
            {showForm ? "Cancelar" : "Convidar usuário"}
          </button>
        ) : null}
      </div>

      {/* Feedback */}
      {successMessage ? (
        <div style={{ background: "var(--color-sprout-muted)", border: "1px solid var(--color-sprout)", borderRadius: 8, padding: "12px 16px", marginBottom: linkAcesso ? 0 : 16, fontSize: 13, color: "var(--color-sprout)" }}>{successMessage}</div>
      ) : null}
      {errMsg ? (
        <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#F87171" }}>{errMsg}</div>
      ) : null}

      {/* Link de acesso */}
      {linkAcesso && (
        <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "16px 20px", marginTop: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace", letterSpacing: "0.08em", marginBottom: 8 }}>LINK DE ACESSO — copie e envie ao usuário</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input readOnly value={linkAcesso} style={{ flex: 1, background: "var(--surface-base)", border: "1px solid var(--border-strong)", borderRadius: 6, padding: "8px 12px", color: "var(--text-muted)", fontSize: 11, fontFamily: "monospace" }} onFocus={e => e.target.select()} />
            <button type="button" onClick={() => { navigator.clipboard.writeText(linkAcesso); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }}
              style={{ padding: "8px 16px", borderRadius: 6, background: "var(--interactive-primary)", border: "none", color: "var(--interactive-on-primary)", fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
              {copiado ? "\u2713 Copiado!" : "Copiar link"}
            </button>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-disabled)", marginTop: 8, lineHeight: 1.5 }}>Se o email não chegar, envie este link pelo WhatsApp. O link expira em 24 horas.</div>
        </div>
      )}

      {/* Invite form */}
      {showForm ? (
        <div className="nexa-card" style={{ marginBottom: 24 }}>
          <div className="nexa-label" style={{ marginBottom: 16 }}>Convidar novo usuário</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12, maxWidth: 700 }}>
            <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Nome completo *</span><input ref={fullNameRef} type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nome do usuário" /></label>
            <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>E-mail *</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" /></label>
            <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Perfil</span><select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>{roleOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label} — {opt.desc}</option>))}</select></label>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button type="button" disabled={!email.trim() || !fullName.trim() || isInviting} onClick={() => void handleInvite()} style={btnP}>{isInviting ? "Enviando convite..." : "Enviar convite"}</button>
          </div>
          {errorMessage ? <p style={{ color: "var(--color-red)", marginTop: 8, fontSize: 12 }}>{errorMessage}</p> : null}
        </div>
      ) : null}

      {/* Action menu */}
      <UserActionMenu target={menuTarget} onClose={() => setMenuTarget(null)} onAction={handleMenuAction} />

      {/* Modals */}
      {modal ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => { if (!actionBusy) setModal(null); }}>
          <div style={{ background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 16, padding: 32, width: "100%", maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>

            {modal.type === "changeRole" ? (
              <>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-bone)", margin: "0 0 16px" }}>Alterar perfil</h2>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 13, color: "var(--color-dust)", marginBottom: 4 }}><strong style={{ color: "var(--color-bone)" }}>{modal.user.fullName}</strong></div>
                  <div style={{ fontSize: 12, color: "var(--color-fog)" }}>{modal.user.email}</div>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Novo perfil</span>
                  <select value={changeRoleValue} onChange={(e) => setChangeRoleValue(e.target.value as UserRole)}>
                    <option value="director">Diretor</option>
                    {roleOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" disabled={actionBusy} onClick={() => setModal(null)} style={btnS}>Cancelar</button>
                  <button type="button" disabled={actionBusy} onClick={() => void executeChangeRole()} style={btnP}>{actionBusy ? "Salvando..." : "Salvar"}</button>
                </div>
              </>
            ) : modal.type === "deactivate" ? (
              <>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-bone)", margin: "0 0 12px" }}>Desativar usuário</h2>
                <p style={{ fontSize: 13, color: "var(--color-dust)", lineHeight: 1.6, margin: "0 0 20px" }}>
                  Deseja desativar <strong style={{ color: "var(--color-bone)" }}>{modal.user.fullName}</strong>? O acesso dele ao sistema será revogado.
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" disabled={actionBusy} onClick={() => setModal(null)} style={btnS}>Cancelar</button>
                  <button type="button" disabled={actionBusy} onClick={() => void executeDeactivate()} style={btnDanger}>{actionBusy ? "Desativando..." : "Confirmar"}</button>
                </div>
              </>
            ) : modal.type === "deleteBlocked" ? (
              <>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#F87171", margin: "0 0 12px" }}>Não é possível excluir</h2>
                <p style={{ fontSize: 13, color: "var(--color-dust)", lineHeight: 1.6, margin: "0 0 20px" }}>
                  <strong style={{ color: "var(--color-bone)" }}>{modal.user.fullName}</strong> possui {modal.negCount} negociação{(modal.negCount ?? 0) > 1 ? "ões" : ""} vinculada{(modal.negCount ?? 0) > 1 ? "s" : ""}. Desative-o em vez disso.
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setModal(null)} style={btnS}>Fechar</button>
                  <button type="button" disabled={actionBusy} onClick={() => { setModal({ type: "deactivate", user: modal.user }); }} style={btnDanger}>Desativar em vez disso</button>
                </div>
              </>
            ) : modal.type === "delete" ? (
              <>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#F87171", margin: "0 0 12px" }}>Excluir usuário</h2>
                <p style={{ fontSize: 13, color: "var(--color-dust)", lineHeight: 1.6, margin: "0 0 20px" }}>
                  Excluir <strong style={{ color: "var(--color-bone)" }}>{modal.user.fullName}</strong> permanentemente? Esta ação não pode ser desfeita.
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" disabled={actionBusy} onClick={() => setModal(null)} style={btnS}>Cancelar</button>
                  <button type="button" disabled={actionBusy} onClick={() => void executeDelete()} style={btnDanger}>{actionBusy ? "Excluindo..." : "Excluir permanentemente"}</button>
                </div>
              </>
            ) : null}

          </div>
        </div>
      ) : null}

      {/* Inactive filter */}
      {inactiveCount > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <div onClick={() => setShowInactive((p) => !p)} style={{ width: 32, height: 18, borderRadius: 9, background: showInactive ? "var(--color-sprout)" : "var(--color-stone)", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: showInactive ? 17 : 3, transition: "left 0.2s" }} />
          </div>
          <span style={{ fontSize: 12, color: "var(--color-fog)", cursor: "pointer" }} onClick={() => setShowInactive((p) => !p)}>Mostrar inativos ({inactiveCount})</span>
        </div>
      ) : null}

      {/* Table */}
      {visibleUsers.length === 0 ? (
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
                {perms.canManageUsers ? <th style={{ width: 40 }}></th> : null}
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id} style={{ opacity: u.status === "inactive" ? 0.5 : 1 }}>
                    <td style={{ color: "var(--color-bone)", fontWeight: 600 }}>{u.fullName}</td>
                    <td>{u.email}</td>
                    <td><span className="nexa-badge" style={{ color: "var(--color-blue)", background: "var(--color-blue-muted)" }}>{getUserRoleLabel(u.role)}</span></td>
                    <td>
                      <span className="nexa-badge" style={{
                        color: u.status === "active" ? "var(--color-sprout)" : "#F87171",
                        background: u.status === "active" ? "var(--color-sprout-muted)" : "rgba(248,113,113,0.08)",
                      }}>
                        {u.status === "active" ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    {perms.canManageUsers ? (
                      <td>
                        {!isSelf ? (
                          <button type="button" onClick={(e) => { const rect = (e.target as HTMLElement).getBoundingClientRect(); setMenuTarget({ user: u, rect }); }}
                            style={{ background: "transparent", border: "none", color: "var(--color-fog)", fontSize: 18, cursor: "pointer", padding: "4px 8px", lineHeight: 1, borderRadius: 6 }}>
                            &#8942;
                          </button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
