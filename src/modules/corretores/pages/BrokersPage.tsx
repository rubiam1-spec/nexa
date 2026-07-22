import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useBrokers } from "../hooks/useBrokers";
import { useBrokerages } from "../../imobiliarias/hooks/useBrokerages";
import {
  createBroker,
  inviteBroker,
  deactivateBroker,
  reactivateBroker,
  countBrokerNegotiations,
  deleteBroker,
  approveBroker,
} from "../../../infra/repositories/brokersSupabaseRepository";
import { useAuth } from "../../../app/contexts/AuthContext";
import type { Broker } from "../../../shared/types/broker";
import { EmptyState } from "../../../shared/components/EmptyState";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { getPermissions } from "../../../shared/utils/permissoes";
import { usePermissions } from "../../../shared/hooks/usePermissions";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import { NexaSelect } from "../../../shared/ui/NexaSelect";
import { NexaModal } from "../../../shared/ui/NexaModal";

const btnP: React.CSSProperties = { background: "var(--color-sprout)", color: "var(--color-ink)", border: "none", borderRadius: 8, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 700, cursor: "pointer" };
const btnS: React.CSSProperties = { background: "transparent", color: "var(--color-bone)", border: "1px solid var(--color-stone)", borderRadius: 8, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 700, cursor: "pointer" };
const btnDanger: React.CSSProperties = { background: "#F87171", color: "var(--interactive-on-primary)", border: "none", borderRadius: 8, padding: "0 16px", height: 36, fontSize: 13, fontWeight: 700, cursor: "pointer" };

const AVATAR_COLORS = ["#4ADE80", "#60A5FA", "#A78BFA", "#F87171", "#FBBF24", "#D97706", "#EC4899", "#22D3EE"];
function getAvatarColor(name: string): string {
  const hash = (name ?? "").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
function getInitials(name: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return "??";
}

// ── Action dropdown ──

type ActionMenuTarget = { broker: Broker; rect: DOMRect } | null;

function ActionMenu({ target, onClose, onAction, onEdit, canDeactivate }: {
  target: ActionMenuTarget;
  onClose: () => void;
  onAction: (action: "deactivate" | "reactivate" | "delete" | "approve", broker: Broker) => void;
  onEdit: (broker: Broker) => void;
  canDeactivate: boolean;
}) {
  useEffect(() => {
    if (!target) return;
    const close = () => onClose();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [target, onClose]);

  if (!target) return null;
  const { broker, rect } = target;
  const isActive = broker.status === "active";
  const isPending = broker.approvalStatus === "pending_approval";
  const menuBtnStyle: React.CSSProperties = { display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", fontSize: 13, padding: "8px 12px", borderRadius: 6, cursor: "pointer" };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 9998 }} onClick={onClose} />
      <div onClick={(e) => e.stopPropagation()} style={{
        position: "fixed",
        top: rect.bottom + 4,
        right: Math.max(8, window.innerWidth - rect.right),
        zIndex: 9999,
        background: "var(--color-carbon)",
        border: "1px solid var(--color-stone)",
        borderRadius: 10,
        padding: 4,
        minWidth: 180,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      }}>
        <button type="button" onClick={() => { onEdit(broker); onClose(); }}
          style={{ ...menuBtnStyle, color: "var(--color-bone)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(156,150,134,0.08)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >Editar corretor</button>
        {isPending && canDeactivate ? (
          <button type="button" onClick={() => { onAction("approve", broker); onClose(); }}
            style={{ ...menuBtnStyle, color: "var(--color-sprout)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(156,150,134,0.08)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >Aprovar corretor</button>
        ) : null}
        {canDeactivate && isActive ? (
          <button type="button" onClick={() => { onAction("deactivate", broker); onClose(); }}
            style={{ ...menuBtnStyle, color: "var(--color-bone)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(156,150,134,0.08)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >Desativar corretor</button>
        ) : canDeactivate && !isActive ? (
          <button type="button" onClick={() => { onAction("reactivate", broker); onClose(); }}
            style={{ ...menuBtnStyle, color: "var(--color-sprout)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(156,150,134,0.08)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >Reativar corretor</button>
        ) : null}
        {canDeactivate ? (
          <button type="button" onClick={() => { onAction("delete", broker); onClose(); }}
            style={{ ...menuBtnStyle, color: "#F87171" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.06)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >Excluir corretor</button>
        ) : null}
      </div>
    </>
  );
}

// ── Page ──

export default function BrokersPage() {
  const { account, errorMessage: accountError, isUsingMock, status: accountStatus, isConsultant } = useAccount();
  const screen = useScreen();
  const { authenticatedProfile } = useAuth();
  const userId = authenticatedProfile?.id ?? null;
  // canManage/canCreate migrados para o sistema novo (3 camadas: preset + role override + individual).
  // canInvite/canDeactivate permanecem no legado neste sprint.
  const perms = getPermissions(account?.role ?? null);
  const { can } = usePermissions();
  const canManage = can("can_manage_brokers");
  const canCreate = can("can_manage_brokers");
  const canInvite = perms.canInviteBroker;
  const canDeactivate = perms.canDeactivateBroker;

  // Consultant filter: fetch broker IDs from their negotiations
  const [consultantBrokerIds, setConsultantBrokerIds] = useState<string[]>([]);
  useEffect(() => {
    if (!isConsultant || !userId || !supabase || !account?.accountId) return;
    supabase.from("negotiations").select("broker_id").eq("owner_profile_id", userId).eq("account_id", account.accountId)
      .then(({ data }) => {
        const ids = [...new Set((data ?? []).map((n: Record<string, unknown>) => n.broker_id as string).filter(Boolean))];
        setConsultantBrokerIds(ids);
      });
  }, [isConsultant, userId, account?.accountId]);

  const navigate = useNavigate();
  const consultantFilter = isConsultant && userId ? { userId, brokerIdsFromNegs: consultantBrokerIds } : undefined;
  const { brokers, errorMessage, isLoading, status, refetch } = useBrokers(account?.accountId ?? null, isUsingMock, consultantFilter);
  const { brokerages } = useBrokerages(account?.accountId ?? null, isUsingMock);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [list, setList] = useState<Broker[]>([]);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [phone, setPhone] = useState("");
  const [creci, setCreci] = useState(""); const [city, setCity] = useState(""); const [brokerageId, setBrokerageId] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [darAcesso, setDarAcesso] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Invite state
  const [confirmInvite, setConfirmInvite] = useState<Broker | null>(null);
  const [inviting, setInviting] = useState(false);
  const [linkAcesso, setLinkAcesso] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Action menu + modals
  const [menuTarget, setMenuTarget] = useState<ActionMenuTarget>(null);
  const [modalAction, setModalAction] = useState<{ type: "deactivate" | "reactivate" | "delete" | "delete_blocked"; broker: Broker; negCount?: number } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Filter
  const [showInactive, setShowInactive] = useState(false);
  const [filterBrokerageId, setFilterBrokerageId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (showForm) firstInputRef.current?.focus();
  }, [showForm]);

  const allBrokers = [...list, ...brokers];
  const activeCount = allBrokers.filter((b) => b.status === "active").length;
  const inactiveCount = allBrokers.length - activeCount;
  const accessCount = allBrokers.filter((b) => b.hasSystemAccess).length;

  const uniqueBrokerages = useMemo(() => {
    const map = new Map<string, string>();
    allBrokers.forEach((b) => {
      if (b.brokerageId && b.brokerageName) map.set(b.brokerageId, b.brokerageName);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [allBrokers]);

  const selectedBrokerageName = filterBrokerageId ? uniqueBrokerages.find((b) => b.id === filterBrokerageId)?.name : null;

  const visibleBrokers = useMemo(() => {
    let result = showInactive ? allBrokers : allBrokers.filter((b) => b.status === "active");
    if (filterBrokerageId) result = result.filter((b) => b.brokerageId === filterBrokerageId);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((b) => b.name.toLowerCase().includes(q) || b.email?.toLowerCase().includes(q) || (b.phone ?? "").includes(q));
    }
    return result;
  }, [allBrokers, showInactive, filterBrokerageId, searchQuery]);

  async function getAccessToken(): Promise<string> {
    if (!supabase) throw new Error("Supabase não configurado.");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sessão expirada. Faça login novamente.");
    return token;
  }

  async function handleInviteBroker(broker: Broker) {
    setInviting(true); setErr(null);
    try {
      const token = await getAccessToken();
      const result = await inviteBroker(broker.id, token);
      if (result.link) { setLinkAcesso(result.link); setCopiado(false); }
      setConfirmInvite(null);
      setSuccessMsg(`Convite enviado para ${broker.name}.`);
      setList((p) => p.map((b) => b.id === broker.id ? { ...b, hasSystemAccess: true } : b));
      refetch();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Falha ao convidar corretor."); }
    finally { setInviting(false); }
  }

  async function handleSave() {
    if (!account?.accountId || !name.trim() || !email.trim() || !phone.trim()) return;
    const selectedBrokerage = brokerages.find((b) => b.id === brokerageId);
    setSaving(true); setErr(null);
    try {
      const b = await createBroker({
        accountId: account.accountId, name: name.trim(), email: email.trim(), phone: phone.trim(), city: city.trim(),
        creci: creci.trim() || undefined, brokerageId: brokerageId || undefined, brokerageName: selectedBrokerage?.name,
        createdBy: userId ?? undefined, approvalStatus: canManage ? "approved" : "pending_approval",
        dataNascimento: dataNascimento || undefined,
      });
      if (darAcesso && canManage) {
        try {
          const token = await getAccessToken();
          const result = await inviteBroker(b.id, token);
          if (result.link) { setLinkAcesso(result.link); setCopiado(false); }
          b.hasSystemAccess = true;
          setSuccessMsg(`Corretor criado e convite enviado para ${b.name}.`);
        } catch (inviteErr: unknown) {
          setSuccessMsg(`Corretor criado. Falha ao enviar convite: ${inviteErr instanceof Error ? inviteErr.message : "erro desconhecido"}.`);
        }
      } else {
        setSuccessMsg(canManage ? "Corretor cadastrado com sucesso!" : "Corretor cadastrado com sucesso! Aguardando aprovação do gestor.");
      }
      setList((p) => [b, ...p]); setShowForm(false);
      setName(""); setEmail(""); setPhone(""); setCreci(""); setCity(""); setBrokerageId(""); setDataNascimento(""); setDarAcesso(false);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Falha ao criar corretor."); }
    finally { setSaving(false); }
  }

  // ── Lifecycle actions ──

  function handleActionMenu(action: "deactivate" | "reactivate" | "delete" | "approve", broker: Broker) {
    if (action === "approve") {
      void (async () => {
        setActionBusy(true); setErr(null);
        try {
          await approveBroker(broker.id);
          setSuccessMsg(`${broker.name} aprovado com sucesso.`);
          refetch();
          setTimeout(() => setSuccessMsg(null), 4000);
        } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Falha ao aprovar."); }
        finally { setActionBusy(false); }
      })();
      return;
    }
    if (action === "delete") {
      // Check negotiations before showing modal
      void (async () => {
        setActionBusy(true);
        try {
          const count = await countBrokerNegotiations(broker.id);
          if (count > 0) {
            setModalAction({ type: "delete_blocked", broker, negCount: count });
          } else {
            setModalAction({ type: "delete", broker });
          }
        } catch { setModalAction({ type: "delete", broker }); }
        finally { setActionBusy(false); }
      })();
    } else {
      setModalAction({ type: action, broker });
    }
  }

  async function executeAction() {
    if (!modalAction) return;
    const { type, broker } = modalAction;
    setActionBusy(true); setErr(null);
    try {
      if (type === "deactivate" || type === "delete_blocked") {
        await deactivateBroker(broker);
        setSuccessMsg(`${broker.name} desativado com sucesso.`);
      } else if (type === "reactivate") {
        await reactivateBroker(broker);
        setSuccessMsg(`${broker.name} reativado com sucesso.`);
      } else if (type === "delete") {
        await deleteBroker(broker);
        setSuccessMsg(`${broker.name} excluído.`);
        setList((p) => p.filter((b) => b.id !== broker.id));
      }
      setModalAction(null);
      refetch();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Falha na operação.");
      setModalAction(null);
    } finally { setActionBusy(false); }
  }

  // ── Render guards ──

  if (isLoading) return <p style={{ color: "var(--color-fog)" }}>Carregando corretores...</p>;
  if (accountStatus === "no_access" || accountStatus === "error") return <p style={{ color: "var(--color-fog)" }}>{accountError ?? "Conta indisponível."}</p>;
  if (status === "error") return <p style={{ color: "var(--color-red)" }}>{errorMessage}</p>;
  if (status === "idle") return <p style={{ color: "var(--color-fog)" }}>Selecione uma conta para continuar.</p>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontSize: 28, fontWeight: 400, color: "var(--color-bone)", margin: 0, lineHeight: 1.1 }}>Corretores</h1>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-fog)", marginTop: 6, letterSpacing: "0.03em" }}>
            {selectedBrokerageName
              ? `${visibleBrokers.length} ${visibleBrokers.length === 1 ? "corretor" : "corretores"} · ${selectedBrokerageName}`
              : `${allBrokers.length} registros · ${activeCount} ativos · ${accessCount} com acesso ao sistema`}
          </div>
        </div>
        {canCreate ? <button type="button" onClick={() => setShowForm((p) => !p)} style={showForm ? btnS : btnP}>{showForm ? "Cancelar" : "Novo corretor"}</button> : null}
      </div>

      {/* Success */}
      {successMsg ? (
        <div style={{ background: "var(--color-sprout-muted)", border: "1px solid var(--color-sprout)", borderRadius: 8, padding: "10px 16px", marginBottom: linkAcesso ? 0 : 16, fontSize: 13, color: "var(--color-sprout)", display: "flex", alignItems: "center", gap: 8 }}>
          <span>&#10003;</span> {successMsg}
        </div>
      ) : null}

      {/* Link de acesso */}
      {linkAcesso && (
        <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "16px 20px", marginTop: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace", letterSpacing: "0.08em", marginBottom: 8 }}>
            LINK DE ACESSO — copie e envie ao corretor
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input readOnly value={linkAcesso} style={{ flex: 1, background: "var(--surface-base)", border: "1px solid var(--border-strong)", borderRadius: 6, padding: "8px 12px", color: "var(--text-muted)", fontSize: 11, fontFamily: "monospace" }} onFocus={e => e.target.select()} />
            <button type="button" onClick={() => { navigator.clipboard.writeText(linkAcesso); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }}
              style={{ padding: "8px 16px", borderRadius: 6, background: "var(--interactive-primary)", border: "none", color: "var(--interactive-on-primary)", fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
              {copiado ? "\u2713 Copiado!" : "Copiar link"}
            </button>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-disabled)", marginTop: 8, lineHeight: 1.5 }}>Se o email não chegar, envie este link diretamente pelo WhatsApp ou outro canal. O link expira em 24 horas.</div>
        </div>
      )}

      {/* Error */}
      {err ? <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#F87171" }}>{err}</div> : null}

      {/* Form */}
      {showForm ? (
        <div className="nexa-card" style={{ marginBottom: 24 }}>
          <div className="nexa-label" style={{ marginBottom: 16 }}>Cadastrar corretor</div>
          <div style={{ display: "grid", gridTemplateColumns: screen.isMobile ? "1fr" : screen.isTablet ? "1fr 1fr" : "1fr 1fr 1fr", gap: 12, maxWidth: 700 }}>
            <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Nome *</span><input ref={firstInputRef} type="text" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>E-mail *</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Telefone *</span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
            <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>CRECI</span><input type="text" value={creci} onChange={(e) => setCreci(e.target.value)} /></label>
            <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Imobiliária</span>
              <NexaSelect value={brokerageId} onChange={(v) => setBrokerageId(v)} options={brokerages.map((b) => ({ value: b.id, label: b.name }))} placeholder="Selecione" ariaLabel="Imobiliária" />
            </label>
            <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Cidade</span><input type="text" value={city} onChange={(e) => setCity(e.target.value)} /></label>
            <label><span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Data de nascimento</span><input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} /></label>
          </div>
          {canManage ? (
            <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "var(--surface-base)", borderRadius: 10, border: "1px solid var(--color-stone)", cursor: "pointer" }} onClick={() => setDarAcesso((p) => !p)}>
              <div style={{ width: 36, height: 20, borderRadius: 10, flexShrink: 0, background: darAcesso ? "var(--color-sprout)" : "var(--color-stone)", position: "relative", transition: "background 0.2s" }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: darAcesso ? 19 : 3, transition: "left 0.2s" }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: darAcesso ? "var(--color-sprout)" : "var(--color-bone)" }}>Dar acesso ao sistema</div>
                <div style={{ fontSize: 11, color: "var(--color-fog)", marginTop: 2 }}>O corretor receberá um link por email para acessar o NEXA</div>
              </div>
            </div>
          ) : null}
          <button type="button" disabled={!name.trim() || !email.trim() || !phone.trim() || saving} onClick={() => void handleSave()} style={{ ...btnP, marginTop: 16 }}>{saving ? "Salvando..." : "Salvar corretor"}</button>
        </div>
      ) : null}

      {/* Invite modal */}
      {confirmInvite ? (
        <NexaModal onClose={() => { if (!inviting) setConfirmInvite(null); }}>
          <div style={{ background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 16, padding: 32, width: "100%", maxWidth: 440 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-bone)", margin: "0 0 12px" }}>Convidar para o sistema</h2>
            <p style={{ fontSize: 13, color: "var(--color-dust)", lineHeight: 1.6, margin: "0 0 20px" }}>
              Deseja convidar <strong style={{ color: "var(--color-bone)" }}>{confirmInvite.name}</strong> ({confirmInvite.email}) para acessar o sistema NEXA? Ele receberá um link por email para definir sua senha.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" disabled={inviting} onClick={() => setConfirmInvite(null)} style={btnS}>Cancelar</button>
              <button type="button" disabled={inviting} onClick={() => void handleInviteBroker(confirmInvite)} style={btnP}>{inviting ? "Enviando..." : "Confirmar convite"}</button>
            </div>
          </div>
        </NexaModal>
      ) : null}

      {/* Lifecycle action modal */}
      {modalAction ? (
        <NexaModal onClose={() => { if (!actionBusy) setModalAction(null); }}>
          <div style={{ background: "var(--color-carbon)", border: "1px solid var(--color-stone)", borderRadius: 16, padding: 32, width: "100%", maxWidth: 440 }}>
            {modalAction.type === "deactivate" ? (
              <>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-bone)", margin: "0 0 12px" }}>Desativar corretor</h2>
                <p style={{ fontSize: 13, color: "var(--color-dust)", lineHeight: 1.6, margin: "0 0 20px" }}>
                  Deseja desativar <strong style={{ color: "var(--color-bone)" }}>{modalAction.broker.name}</strong>? Ele não poderá mais ser vinculado a novas negociações.
                  {modalAction.broker.hasSystemAccess ? <><br /><span style={{ color: "#F87171" }}>O acesso dele ao sistema será revogado.</span></> : null}
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" disabled={actionBusy} onClick={() => setModalAction(null)} style={btnS}>Cancelar</button>
                  <button type="button" disabled={actionBusy} onClick={() => void executeAction()} style={btnDanger}>{actionBusy ? "Desativando..." : "Confirmar"}</button>
                </div>
              </>
            ) : modalAction.type === "reactivate" ? (
              <>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-bone)", margin: "0 0 12px" }}>Reativar corretor</h2>
                <p style={{ fontSize: 13, color: "var(--color-dust)", lineHeight: 1.6, margin: "0 0 20px" }}>
                  Deseja reativar <strong style={{ color: "var(--color-bone)" }}>{modalAction.broker.name}</strong>? Ele poderá ser vinculado a novas negociações novamente.
                  <br /><span style={{ color: "var(--color-fog)" }}>O acesso ao sistema não será restaurado automaticamente.</span>
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" disabled={actionBusy} onClick={() => setModalAction(null)} style={btnS}>Cancelar</button>
                  <button type="button" disabled={actionBusy} onClick={() => void executeAction()} style={btnP}>{actionBusy ? "Reativando..." : "Confirmar"}</button>
                </div>
              </>
            ) : modalAction.type === "delete_blocked" ? (
              <>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#F87171", margin: "0 0 12px" }}>Não é possível excluir</h2>
                <p style={{ fontSize: 13, color: "var(--color-dust)", lineHeight: 1.6, margin: "0 0 20px" }}>
                  <strong style={{ color: "var(--color-bone)" }}>{modalAction.broker.name}</strong> possui {modalAction.negCount} negociação{(modalAction.negCount ?? 0) > 1 ? "ões" : ""} vinculada{(modalAction.negCount ?? 0) > 1 ? "s" : ""}. Você pode desativá-lo.
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setModalAction(null)} style={btnS}>Fechar</button>
                  <button type="button" disabled={actionBusy} onClick={() => void executeAction()} style={btnDanger}>{actionBusy ? "Desativando..." : "Desativar em vez disso"}</button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#F87171", margin: "0 0 12px" }}>Excluir corretor</h2>
                <p style={{ fontSize: 13, color: "var(--color-dust)", lineHeight: 1.6, margin: "0 0 20px" }}>
                  Excluir <strong style={{ color: "var(--color-bone)" }}>{modalAction.broker.name}</strong> permanentemente? Esta ação não pode ser desfeita.
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" disabled={actionBusy} onClick={() => setModalAction(null)} style={btnS}>Cancelar</button>
                  <button type="button" disabled={actionBusy} onClick={() => void executeAction()} style={btnDanger}>{actionBusy ? "Excluindo..." : "Excluir permanentemente"}</button>
                </div>
              </>
            )}
          </div>
        </NexaModal>
      ) : null}

      {/* Action dropdown */}
      <ActionMenu target={menuTarget} onClose={() => setMenuTarget(null)} onAction={handleActionMenu} onEdit={(b) => navigate(`/corretores/${b.id}`)} canDeactivate={canDeactivate} />

      {/* Search + brokerage filter */}
      {allBrokers.length > 0 ? (
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, e-mail ou telefone"
            style={{
              flex: 1, minWidth: 220, padding: "10px 14px", borderRadius: 10,
              background: "var(--surface-raised)", border: "1px solid var(--border-default)",
              color: "var(--text-primary)", fontSize: 13, outline: "none",
            }}
          />
          {uniqueBrokerages.length > 0 ? (
            <div style={{ width: 220 }}>
              <NexaSelect
                value={filterBrokerageId}
                onChange={(v) => setFilterBrokerageId(v)}
                options={[{ value: "", label: "Todas as imobiliárias" }, ...uniqueBrokerages.map((b) => ({ value: b.id, label: b.name }))]}
                ariaLabel="Filtrar por imobiliária"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Filter toggle */}
      {inactiveCount > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <div
            onClick={() => setShowInactive((p) => !p)}
            style={{ width: 32, height: 18, borderRadius: 9, background: showInactive ? "var(--color-sprout)" : "var(--color-stone)", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}
          >
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: showInactive ? 17 : 3, transition: "left 0.2s" }} />
          </div>
          <span style={{ fontSize: 12, color: "var(--color-fog)", cursor: "pointer" }} onClick={() => setShowInactive((p) => !p)}>
            Mostrar inativos ({inactiveCount})
          </span>
        </div>
      ) : null}

      {/* Table */}
      {visibleBrokers.length === 0 && allBrokers.length === 0 ? (
        <EmptyState icone={"\uD83D\uDC64"} titulo="Nenhum corretor cadastrado" descricao={canCreate ? "Adicione corretores para vincular a negociações e acompanhar as negociações." : "Nenhum corretor cadastrado nesta conta."} ctaLabel={canCreate ? "Novo corretor" : undefined} onCta={canCreate ? () => setShowForm(true) : undefined} />
      ) : visibleBrokers.length === 0 ? (
        <div className="nexa-card" style={{ textAlign: "center", padding: 24 }}>
          <p style={{ color: "var(--color-fog)", fontSize: 13 }}>Nenhum corretor ativo. Ative o filtro acima para ver corretores inativos.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {visibleBrokers.map((b) => {
            const isInactive = b.status !== "active";
            const isPending = b.approvalStatus === "pending_approval";
            return (
              <div
                key={b.id}
                onClick={() => navigate(`/corretores/${b.id}`)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px", cursor: "pointer",
                  background: "linear-gradient(145deg, var(--surface-raised), var(--surface-base))",
                  border: "1px solid var(--border-default)",
                  borderRadius: 10,
                  opacity: isInactive ? 0.55 : 1,
                  transition: "border-color 0.15s, transform 0.1s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(74,222,128,0.25)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-default)";
                  e.currentTarget.style.transform = "none";
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: getAvatarColor(b.name),
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "#12110F",
                }}>
                  {getInitials(b.name)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {b.name}
                    </span>
                    {b.hasSystemAccess && (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, color: "#4ADE80", background: "rgba(74,222,128,0.12)", padding: "1px 6px", borderRadius: 4, letterSpacing: "0.08em" }}>ACESSO</span>
                    )}
                    {isInactive && (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, color: "#F87171", background: "rgba(248,113,113,0.12)", padding: "1px 6px", borderRadius: 4, letterSpacing: "0.08em" }}>INATIVO</span>
                    )}
                    {isPending && (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, color: "#FBBF24", background: "rgba(251,191,36,0.12)", padding: "1px 6px", borderRadius: 4, letterSpacing: "0.08em" }}>PENDENTE</span>
                    )}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {b.email || "—"}
                  </div>
                </div>

                {!screen.isMobile && (
                  <div style={{ minWidth: 160, maxWidth: 240, fontFamily: "var(--font-mono)", fontSize: 10, color: "#9C9686", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {b.brokerageName ? b.brokerageName : <span style={{ fontStyle: "italic", color: "var(--text-disabled)" }}>Sem imobiliária</span>}
                    {b.city ? ` · ${b.city}` : ""}
                  </div>
                )}

                {!screen.isMobile && (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", minWidth: 110, textAlign: "right" }}>
                    {b.phone || "—"}
                  </div>
                )}

                {canInvite && !isInactive && !b.hasSystemAccess ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setConfirmInvite(b); setLinkAcesso(null); setErr(null); }}
                    style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, border: "1px solid #4ADE80", background: "transparent", color: "#4ADE80", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
                  >
                    Convidar
                  </button>
                ) : null}

                {canManage ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); setMenuTarget((prev) => prev?.broker.id === b.id ? null : { broker: b, rect }); }}
                    style={{ background: "transparent", border: "none", color: "var(--color-fog)", fontSize: 18, cursor: "pointer", padding: "4px 8px", lineHeight: 1, borderRadius: 6, flexShrink: 0 }}
                  >
                    &#8942;
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
