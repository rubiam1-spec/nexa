import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "../hooks/useIsMobile";
import { supabase } from "../../infra/supabase/supabaseClient";
import Avatar from "./Avatar";

const T = { ink: "var(--surface-base)", carbon: "var(--surface-raised)", stone: "var(--border-default)", chalk: "var(--text-primary)", bone: "var(--text-secondary)", fog: "var(--text-muted)", slate: "var(--text-disabled)", sprout: "var(--interactive-primary)", red: "#F87171", amber: "#FBBF24", blue: "#60A5FA" };

const TYPE_LABELS: Record<string, string> = { visit_broker: "Visita corretor", visit_client: "Visita cliente", visit_development: "Visita empreend.", training: "Treinamento", phone_call: "Ligação", follow_up: "Follow-up", meeting_internal: "Reunião interna", meeting_external: "Reunião externa", other: "Outro" };
const ROLE_LABELS: Record<string, string> = { owner: "Diretor", director: "Diretor", manager: "Gestor", commercial_consultant: "Consultora", broker: "Corretor", administrative: "Administrativo", concierge: "Concierge" };

interface MemberData { id: string; name: string; role: string; avatarUrl?: string | null; activitiesToday: number; lastActivityDaysAgo: number; activeNegotiations: number }
interface Activity { id: string; type: string; title: string; outcome: string | null; start_time: string | null }

export default function TeamMemberPanel({ member, open, onClose, onRequestUpdate, updateSent }: {
  member: MemberData | null; open: boolean; onClose: () => void;
  onRequestUpdate: (memberId: string, memberName: string) => void; updateSent: boolean;
}) {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [negCount, setNegCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const mobile = useIsMobile();

  useEffect(() => {
    if (!open || !member || !supabase) return;
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);

    if (member.role === "broker") {
      supabase.from("negotiations").select("id").eq("broker_id", member.id).not("status", "in", '("lost","cancelled","won")').then(({ data }) => { setNegCount((data ?? []).length); setLoading(false); });
    } else {
      supabase.from("activities").select("id, type, title, outcome, start_time").eq("profile_id", member.id).eq("activity_date", today).order("start_time", { ascending: true }).limit(10).then(({ data }) => { setActivities((data ?? []) as Activity[]); setLoading(false); });
    }
  }, [open, member]);

  if (!open || !member) return null;

  const isBroker = member.role === "broker";
  const hasActivities = activities.length > 0;

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9998 }} />
      <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: mobile ? "100%" : 400, maxWidth: "100vw", background: T.ink, borderLeft: mobile ? "none" : `1px solid ${T.stone}`, zIndex: 9999, transform: "translateX(0)", display: "flex", flexDirection: "column", boxShadow: "-8px 0 32px rgba(0,0,0,0.3)", overflowY: "auto" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${T.stone}`, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <Avatar name={member.name} avatarUrl={member.avatarUrl} size={44} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.chalk }}>{member.name}</div>
            <div style={{ fontSize: 12, color: T.fog }}>{ROLE_LABELS[member.role] || member.role}{!isBroker && ` · ${member.activitiesToday} atividade${member.activitiesToday !== 1 ? "s" : ""} hoje`}</div>
          </div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: T.fog, fontSize: 22, cursor: "pointer", padding: "4px" }}>×</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: 24 }}>
          {loading && <div style={{ fontSize: 13, color: T.fog, fontFamily: "var(--font-mono)" }}>Carregando...</div>}

          {!loading && isBroker && (
            <>
              <div style={{ fontSize: 13, color: T.fog, marginBottom: 16 }}>Corretor externo não registra atividades no sistema.</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: T.slate, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>DADOS</div>
              <div style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
                <div style={{ fontSize: 14, color: T.bone }}>Negociações ativas: <strong>{negCount}</strong></div>
              </div>
            </>
          )}

          {!loading && !isBroker && hasActivities && (
            <>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: T.slate, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>ATIVIDADES HOJE</div>
              <div style={{ display: "grid", gap: 8 }}>
                {activities.map((a) => (
                  <div key={a.id} style={{ background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: T.sprout + "15", color: T.sprout, textTransform: "uppercase" }}>{TYPE_LABELS[a.type] || a.type}</span>
                      {a.start_time && <span style={{ fontSize: 11, color: T.fog, fontFamily: "var(--font-mono)" }}>{a.start_time.substring(0, 5)}</span>}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: T.bone }}>{a.title}</div>
                    {a.outcome && <div style={{ fontSize: 12, color: T.fog, marginTop: 4 }}>{a.outcome}</div>}
                  </div>
                ))}
              </div>
            </>
          )}

          {!loading && !isBroker && !hasActivities && (
            <div style={{ background: T.amber + "08", border: `1px solid ${T.amber}30`, borderRadius: 10, padding: "16px 18px" }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: T.amber }}>⚠ Nenhuma atividade registrada hoje.</div>
              <div style={{ fontSize: 12, color: T.fog, marginTop: 4 }}>
                {member.lastActivityDaysAgo === 0 ? "Última atividade: hoje." : member.lastActivityDaysAgo < 999 ? `Última atividade: há ${member.lastActivityDaysAgo} dia${member.lastActivityDaysAgo > 1 ? "s" : ""}.` : "Sem atividades registradas."}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ padding: "16px 24px", borderTop: `1px solid ${T.stone}`, display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
          {isBroker ? (
            <button type="button" onClick={() => { onClose(); navigate(`/corretores/${member.id}`); }} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.bone, fontSize: 13, cursor: "pointer" }}>Ver ficha</button>
          ) : (
            <button type="button" onClick={() => { onClose(); navigate("/atividades"); }} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.bone, fontSize: 13, cursor: "pointer" }}>Ver atividades</button>
          )}
          {!isBroker && (
            <button type="button" disabled={updateSent} onClick={() => onRequestUpdate(member.id, member.name)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: updateSent ? T.stone : T.sprout, color: updateSent ? T.fog : "var(--interactive-on-primary)", fontSize: 13, fontWeight: 600, cursor: updateSent ? "default" : "pointer" }}>
              {updateSent ? "Solicitação enviada" : "Solicitar atualização"}
            </button>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
