import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotificationFeed } from "../hooks/useNotificationFeed";
import { MobileSheet } from "../mobile";
import type { FeedItem, FeedPriority } from "../notifications/notificationFeed";

// N4 · O SINO HONESTO. Fonte única (notificationFeed): notifications + alertas do
// motor, dedupe do par, badge SÓ de acionáveis. Painel: chip de prioridade,
// agrupamento por dia, clique navega à entidade (grafo) e marca visto; "Resolver"
// inline nos alertas; "marcar todas lidas" nas notifications. Mobile = MobileSheet.
const PRIO_META: Record<FeedPriority, { color: string; label: string | null }> = {
  critical: { color: "#E24B4A", label: "Crítico" },
  warning: { color: "#F59E0B", label: "Atenção" },
  info: { color: "#60A5FA", label: null },
};

function relTime(iso: string, nowMs: number): string {
  const mins = Math.floor((nowMs - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
}

function dayLabel(iso: string, nowMs: number): string {
  const d = new Date(iso), n = new Date(nowMs);
  const dayStart = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((dayStart(n) - dayStart(d)) / 86_400_000);
  if (diff <= 0) return "Hoje";
  if (diff === 1) return "Ontem";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function groupByDay(items: FeedItem[], nowMs: number): [string, FeedItem[]][] {
  const groups: [string, FeedItem[]][] = [];
  let last = "";
  for (const it of items) {
    const lbl = dayLabel(it.createdAt, nowMs);
    if (lbl !== last) { groups.push([lbl, []]); last = lbl; }
    groups[groups.length - 1][1].push(it);
  }
  return groups;
}

export function NotificationBell({ userId, accountId, isMobile }: { userId: string | null; accountId: string | null; isMobile: boolean }) {
  const navigate = useNavigate();
  const { feed, badge, markAsRead, markAllAsRead, resolveAlert } = useNotificationFeed(userId, accountId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nowMs = Date.now();

  useEffect(() => {
    if (!open || isMobile) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, isMobile]);

  const close = () => setOpen(false);
  const hasUnreadNotif = feed.some((it) => it.source === "notification" && !it.read);

  const onItemClick = (it: FeedItem) => {
    if (it.source === "notification" && !it.read) void markAsRead(it.rawId);
    close();
    if (it.link) navigate(it.link);
  };

  const Row = (it: FeedItem) => {
    const meta = PRIO_META[it.priority];
    const dim = it.source === "notification" && it.read;
    return (
      <div key={it.id} onClick={() => onItemClick(it)} style={{ display: "flex", gap: 10, padding: "12px 16px", cursor: "pointer", background: dim ? "transparent" : "rgba(74,222,128,0.03)", borderBottom: "1px solid var(--border-default)" }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: meta.color, flexShrink: 0, marginTop: 6 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
            <span style={{ fontSize: 13, fontWeight: dim ? 400 : 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</span>
            <span style={{ fontSize: 11, color: "var(--text-disabled)", flexShrink: 0 }}>{relTime(it.createdAt, nowMs)}</span>
          </div>
          {it.message && <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.4 }}>{it.message}</p>}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            {meta.label && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: meta.color, background: meta.color + "1F", padding: "1px 6px", borderRadius: 4 }}>{meta.label}</span>}
            {it.resolvable && (
              <button type="button" onClick={(e) => { e.stopPropagation(); void resolveAlert(it.rawId); }} style={{ fontSize: 11, fontWeight: 600, color: "#4ADE80", background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 6, padding: "3px 10px", minHeight: 28, cursor: "pointer" }}>Resolver</button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const HeaderActions = (
    hasUnreadNotif ? <button type="button" onClick={() => void markAllAsRead()} style={{ fontSize: 12, color: "#4ADE80", background: "transparent", border: "none", cursor: "pointer", minHeight: 44 }}>Marcar todas lidas</button> : null
  );

  const Body = (
    <>
      <div style={{ overflowY: "auto", flex: 1, WebkitOverflowScrolling: "touch" }}>
        {feed.length === 0
          ? <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--text-disabled)", fontSize: 13 }}>Nada para você agora</div>
          : groupByDay(feed.slice(0, 40), nowMs).map(([label, items]) => (
            <div key={label}>
              <div style={{ padding: "8px 16px 4px", fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-disabled)", position: "sticky", top: 0, background: "var(--surface-raised)" }}>{label}</div>
              {items.map(Row)}
            </div>
          ))}
      </div>
      <div onClick={() => { close(); navigate("/notificacoes"); }} style={{ padding: "12px 16px", textAlign: "center", borderTop: "1px solid var(--border-default)", cursor: "pointer", fontSize: 13, color: "#4ADE80", fontWeight: 500, flexShrink: 0 }}>Ver todas as notificações</div>
    </>
  );

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Notificações" style={{ position: "relative", cursor: "pointer", padding: 6, borderRadius: 8, background: "transparent", border: "none", minWidth: 44, minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(156,150,134,0.08)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
        {badge > 0 && <div style={{ position: "absolute", top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 99, background: "#E24B4A", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", border: "2px solid var(--surface-base)" }}>{badge > 9 ? "9+" : badge}</div>}
      </button>

      {open && (isMobile ? (
        <MobileSheet open onClose={close} title={<span style={{ display: "flex", alignItems: "center", gap: 10 }}>Notificações{badge > 0 ? <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{badge}</span> : null}{HeaderActions}</span>} ariaLabel="Notificações">
          <div style={{ display: "flex", flexDirection: "column", maxHeight: "70vh" }}>{Body}</div>
        </MobileSheet>
      ) : (
        <div className="nexa-dropdown-enter" style={{ position: "absolute", top: 44, right: 0, width: 384, maxWidth: "92vw", maxHeight: 520, display: "flex", flexDirection: "column", background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", zIndex: 999, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--border-default)", flexShrink: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Notificações{badge > 0 ? ` · ${badge}` : ""}</span>
            {HeaderActions}
          </div>
          {Body}
        </div>
      ))}
    </div>
  );
}

export default NotificationBell;
