import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useAuth } from "../../../app/contexts/AuthContext";
import { useNotifications } from "../../../shared/hooks/useNotifications";
import { useIsMobile } from "../../../shared/hooks/useIsMobile";
import { timeAgo } from "../../../shared/utils/timeAgo";

const TYPE_CFG: Record<string, { color: string; label: string }> = {
  new_proposal: { color: "#4ADE80", label: "Proposta" },
  counter_proposal: { color: "#F59E0B", label: "Contraproposta" },
  proposal_approved: { color: "#4ADE80", label: "Proposta" },
  proposal_rejected: { color: "#E24B4A", label: "Proposta" },
  docs_ready_for_review: { color: "#A78BFA", label: "Documentos" },
  doc_approved: { color: "#4ADE80", label: "Documento" },
  doc_rejected: { color: "#E24B4A", label: "Documento" },
  client_ready_for_contract: { color: "#4ADE80", label: "Contrato" },
  reservation_requested: { color: "#F59E0B", label: "Reserva" },
  reservation_approved: { color: "#4ADE80", label: "Reserva" },
  reservation_rejected: { color: "#E24B4A", label: "Reserva" },
  sale_registered: { color: "#4ADE80", label: "Venda" },
  feed_comment: { color: "#60A5FA", label: "Comentário" },
  feed_reaction: { color: "#60A5FA", label: "Reação" },
  followup_overdue: { color: "#E24B4A", label: "Follow-up" },
  negotiation_stale: { color: "#F59E0B", label: "Cadência" },
  reservation_expiring: { color: "#F59E0B", label: "Reserva" },
  update_request: { color: "#F59E0B", label: "Solicitação" },
  weekly_report: { color: "#4ADE80", label: "Relatório" },
  activity_reminder: { color: "#F59E0B", label: "Lembrete" },
  property_pending_approval: { color: "#F59E0B", label: "Imóvel" },
  property_approved: { color: "#4ADE80", label: "Imóvel" },
  property_rejected: { color: "#E24B4A", label: "Imóvel" },
  property_revision_requested: { color: "#60A5FA", label: "Imóvel" },
  brokerage_manager_assigned: { color: "#4ADE80", label: "Imobiliária" },
  brokerage_manager_removed: { color: "#F59E0B", label: "Imobiliária" },
};

function NotifIcon({ type, color }: { type: string; color: string }) {
  switch (type) {
    case "docs_ready_for_review":
      return <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><rect x="4" y="2" width="12" height="16" rx="2" stroke={color} strokeWidth="1.5"/><line x1="7" y1="7" x2="13" y2="7" stroke={color} strokeWidth="1.5" strokeLinecap="round"/><line x1="7" y1="11" x2="11" y2="11" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></svg>;
    case "new_proposal":
      return <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="2" stroke={color} strokeWidth="1.5"/><path d="M7 10H13M10 7V13" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></svg>;
    case "proposal_approved":
    case "doc_approved":
      return <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke={color} strokeWidth="1.5"/><path d="M7 10L9 12L13 8" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    case "proposal_rejected":
    case "doc_rejected":
      return <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke={color} strokeWidth="1.5"/><path d="M7.5 7.5L12.5 12.5M12.5 7.5L7.5 12.5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></svg>;
    case "client_ready_for_contract":
      return <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M10 2L12.5 7.5L18 8.5L14 12.5L15 18L10 15.5L5 18L6 12.5L2 8.5L7.5 7.5L10 2Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/></svg>;
    default:
      return <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M10 2C7.24 2 5 4.24 5 7V10.5L3.5 13H16.5L15 10.5V7C15 4.24 12.76 2 10 2Z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 16C8 17.1 8.9 18 10 18C11.1 18 12 17.1 12 16" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></svg>;
  }
}

export default function NotificacoesPage() {
  const navigate = useNavigate();
  const { account } = useAccount();
  const { authenticatedProfile } = useAuth();
  const isMobile = useIsMobile();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(authenticatedProfile?.id ?? null, account?.accountId ?? null);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const filtered = filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Notificações</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0" }}>{unreadCount} não lida{unreadCount !== 1 ? "s" : ""}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 2, background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 8, padding: 3 }}>
            {([["all", "Todas"], ["unread", "Não lidas"]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setFilter(k)} style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: filter === k ? "var(--interactive-primary)" : "transparent", color: filter === k ? "var(--interactive-on-primary)" : "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{l}</button>
            ))}
          </div>
          {unreadCount > 0 && (
            <button type="button" onClick={markAllAsRead} style={{ padding: "5px 14px", borderRadius: 8, border: "1px solid var(--border-default)", background: "transparent", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>Marcar todas como lidas</button>
          )}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-disabled)" }}>
          <div style={{ fontSize: 14 }}>Nenhuma notificação{filter === "unread" ? " não lida" : ""}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {filtered.map((n) => {
            const cfg = TYPE_CFG[n.type] || { color: "#8A8985", label: "Sistema" };
            return (
              <div key={n.id} onClick={() => { markAsRead(n.id); if (n.action_url) navigate(n.action_url); }}
                style={{ display: "flex", gap: 12, padding: "14px 16px", borderRadius: 10, cursor: n.action_url ? "pointer" : "default", background: n.read ? "transparent" : "rgba(74,222,128,0.03)", borderLeft: n.read ? "3px solid transparent" : `3px solid ${cfg.color}`, transition: "background 0.2s" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: cfg.color + "15", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <NotifIcon type={n.type} color={cfg.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: "var(--text-primary)" }}>{n.title}</span>
                    <span style={{ fontSize: 11, color: "var(--text-disabled)", flexShrink: 0, fontFamily: "var(--font-mono)" }}>{timeAgo(n.created_at)}</span>
                  </div>
                  {n.message && <p style={{ margin: "4px 0 0", fontSize: 12, color: n.read ? "var(--text-disabled)" : "var(--text-muted)", lineHeight: 1.4 }}>{n.message}</p>}
                  <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: cfg.color + "15", color: cfg.color, marginTop: 6, display: "inline-block" }}>{cfg.label}</span>
                </div>
                {!n.read && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ADE80", flexShrink: 0, marginTop: 4 }} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
