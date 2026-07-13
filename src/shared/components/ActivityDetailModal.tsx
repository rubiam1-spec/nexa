import { useState, useEffect } from "react";
import { NexaModal } from "../ui/NexaModal";
import InlineEdit from "../../modules/atividades/components/InlineEdit";
import EntityPicker from "../../modules/atividades/fields/EntityPicker";
import { formatDateBRT, formatWeekdayDateLongBRT } from "../utils/dateUtils";
import { useIsMobile } from "../hooks/useIsMobile";

interface Activity {
  id: string; type: string; title: string; status: string;
  activity_date: string; start_time: string | null; duration_minutes: number;
  outcome: string | null; description: string | null; skip_reason: string | null;
  archived_at?: string | null;
  contact_name: string | null; created_at: string; updated_at?: string | null;
  broker_id?: string | null; brokers?: { name: string } | null;
  profiles?: { name: string; role: string } | null;
  activity_photos?: { id: string; photo_url: string }[] | null;
}

interface ActivityParticipant {
  participant_type: string; participant_name: string; participant_detail: string | null; participant_id?: string | null;
}

interface TeamProfile { id: string; name: string; role: string }
interface ChecklistItem { id: string; text: string; done: boolean; position: number }

const T = {
  ink: "var(--surface-base)", carbon: "var(--surface-raised)", stone: "var(--border-default)",
  chalk: "var(--text-primary)", bone: "var(--text-secondary)", fog: "var(--text-muted)",
  slate: "var(--text-disabled)", sprout: "var(--interactive-primary)", blue: "#60A5FA",
  red: "#F87171", amber: "#FBBF24", purple: "#A78BFA",
};

const TYPE_LABELS: Record<string, string> = {
  visit_broker: "Visita corretor", visit_client: "Visita cliente", visit_development: "Visita empreend.",
  training: "Treinamento", phone_call: "Ligação", follow_up: "Follow-up",
  meeting_internal: "Reunião interna", meeting_external: "Reunião externa", other: "Outro",
};

const PCOLORS: Record<string, string> = { broker: "#4ADE80", client: "#60A5FA", user: "#A78BFA", external: "#9C9686" };

function fmtDuration(m: number) { if (!m) return "—"; if (m < 60) return `${m}min`; const h = Math.floor(m / 60); const r = m % 60; return r > 0 ? `${h}h${r}min` : `${h}h`; }
function todayStr() { return new Date().toISOString().slice(0, 10); }

export default function ActivityDetailModal({ activity, participants, teamProfiles, onAddTeamMember, onRemoveTeamMember, accountId, expectsBroker, onSetBroker, checklist, onAddChecklist, onToggleChecklist, onRemoveChecklist, onReorderChecklist, onEditChecklist, onRenameTitle, onArchive, onClose, onEdit, onComplete, onSkip, onDelete, canEdit }: {
  activity: Activity; participants: ActivityParticipant[]; onClose: () => void;
  teamProfiles?: TeamProfile[];
  onAddTeamMember?: (m: { id: string; name: string }) => void;
  onRemoveTeamMember?: (participantId: string) => void;
  // Corretor (activities.broker_id) — NÃO é equipe nem participante.
  accountId?: string | null;
  expectsBroker?: boolean; // tipo espera corretor (needs broker / fields inclui "corretor")
  onSetBroker?: (broker: { id: string; name: string } | null) => void;
  checklist?: ChecklistItem[];
  onAddChecklist?: (text: string, position: number) => Promise<ChecklistItem | null>;
  onToggleChecklist?: (id: string, done: boolean) => void;
  onRemoveChecklist?: (id: string) => void;
  onReorderChecklist?: (id: string, position: number) => void;
  onEditChecklist?: (id: string, text: string) => void;
  onRenameTitle?: (title: string) => void;
  onArchive?: (archived: boolean) => void;
  onEdit?: () => void; onComplete?: () => void; onSkip?: () => void; onDelete?: () => void;
  canEdit?: boolean;
}) {
  const [titleLocal, setTitleLocal] = useState(activity.title);
  useEffect(() => { setTitleLocal(activity.title); }, [activity.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [lightbox, setLightbox] = useState<{ urls: string[]; idx: number } | null>(null);
  const [addingTeam, setAddingTeam] = useState(false);
  const [editingBroker, setEditingBroker] = useState(false);
  useEffect(() => { setEditingBroker(false); }, [activity.id]);
  // Checklist: estado local otimista, semeado da prop e re-semeado por card.
  const [items, setItems] = useState<ChecklistItem[]>(() => [...(checklist ?? [])].sort((a, b) => a.position - b.position));
  const [newItem, setNewItem] = useState("");
  const canManageChecklist = Boolean(canEdit && onAddChecklist && onToggleChecklist && onRemoveChecklist);
  // Reseta só quando troca o card aberto — durante a sessão o estado local
  // (otimista) é a fonte de verdade, evitando que um [] novo a cada render
  // do pai apague itens recém-adicionados.
  useEffect(() => {
    setItems([...(checklist ?? [])].sort((a, b) => a.position - b.position));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity.id]);
  const doneCount = items.filter((i) => i.done).length;
  const pct = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;
  const toggleItem = (it: ChecklistItem) => {
    setItems((p) => p.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)));
    onToggleChecklist?.(it.id, !it.done);
  };
  const removeItem = (id: string) => {
    setItems((p) => p.filter((x) => x.id !== id));
    onRemoveChecklist?.(id);
  };
  const addItem = async () => {
    const text = newItem.trim();
    if (!text || !onAddChecklist) return;
    const pos = (items.reduce((m, x) => Math.max(m, x.position), 0) || 0) + 1000;
    setNewItem("");
    const row = await onAddChecklist(text, pos);
    if (row) setItems((p) => [...p, row]);
  };
  const moveItem = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const reordered = [...items];
    [reordered[idx], reordered[j]] = [reordered[j], reordered[idx]];
    setItems(reordered);
    // Persistir nova posição do item movido (entre vizinhos).
    const moved = reordered[j];
    const prev = reordered[j - 1];
    const next = reordered[j + 1];
    const newPos = prev && next ? (prev.position + next.position) / 2 : prev ? prev.position + 1000 : next ? next.position - 1000 : 1000;
    onReorderChecklist?.(moved.id, newPos);
  };
  const teamParticipants = participants.filter((p) => p.participant_type === "user" && p.participant_id);
  const teamIds = new Set(teamParticipants.map((p) => p.participant_id));
  const canManageTeam = Boolean(canEdit && onAddTeamMember && onRemoveTeamMember && teamProfiles);
  // Corretor: editável só por quem tem canEdit, com accountId + handler.
  const canManageBroker = Boolean(canEdit && onSetBroker && accountId);
  const showBrokerSection = Boolean(activity.broker_id) || (expectsBroker && canManageBroker);
  const photos = activity.activity_photos ?? [];
  const mobile = useIsMobile();
  const st = activity.status || "completed";
  const isScheduled = st === "scheduled";
  const isExpired = st === "expired";
  const isSkipped = st === "skipped";
  const isCompleted = st === "completed";
  const isOverdue = isScheduled && activity.activity_date < todayStr();
  const isToday = activity.activity_date === todayStr();
  const daysUntil = Math.ceil((new Date(activity.activity_date + "T12:00:00").getTime() - Date.now()) / 864e5);
  const wasEdited = activity.updated_at && activity.created_at && new Date(activity.updated_at).getTime() - new Date(activity.created_at).getTime() > 5000;

  const dateLabel = formatWeekdayDateLongBRT(activity.activity_date + "T12:00:00");
  const statusLabel = isOverdue ? `Atrasada — há ${Math.abs(daysUntil)} dias` : isExpired ? `Expirada — ${Math.abs(daysUntil)} dias sem ação` : isToday && isScheduled ? "Hoje" : isScheduled ? `Agendada — em ${daysUntil} dias` : isSkipped ? "Pulada" : "";
  const statusColor = isOverdue || isExpired ? T.red : isToday && isScheduled ? T.blue : isScheduled ? T.blue : isSkipped ? T.slate : T.sprout;

  return (
    <NexaModal onClose={onClose} zIndex={9998} initialFocus={false} ariaLabel="Detalhe da atividade">
      <div style={mobile
        ? { position: "fixed", inset: 0, overflowY: "auto", background: T.ink }
        : { width: 480, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 16, boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }
      }>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span style={{ padding: "4px 12px", borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", background: isScheduled || isExpired ? "transparent" : statusColor + "20", border: isScheduled || isExpired ? `1px solid ${statusColor}` : "none", color: statusColor }}>{TYPE_LABELS[activity.type] || activity.type}</span>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: T.fog, fontSize: 22, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>×</button>
        </div>

        {/* Title (click-to-edit) */}
        <div style={{ padding: "0 24px 16px" }}>
          {canEdit && onRenameTitle && !isSkipped ? (
            <InlineEdit
              value={titleLocal}
              onSave={(v) => { setTitleLocal(v); onRenameTitle(v); }}
              ariaLabel="Título da atividade"
              textStyle={{ fontSize: 18, fontWeight: 700, color: T.chalk, display: "block" }}
              inputStyle={{ width: "100%", boxSizing: "border-box", fontSize: 18, fontWeight: 700, color: T.chalk, background: T.carbon, border: `1px solid ${T.sprout}`, borderRadius: 8, padding: "4px 10px", outline: "none" }}
            />
          ) : (
            <h2 style={{ fontSize: 18, fontWeight: 700, color: T.chalk, margin: 0, textDecoration: isSkipped ? "line-through" : "none" }}>{titleLocal}</h2>
          )}
        </div>

        {/* Info rows */}
        <div style={{ padding: "0 24px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: T.bone }}>
            <span>📅</span> <span style={{ textTransform: "capitalize" }}>{dateLabel}{activity.start_time ? ` às ${activity.start_time.substring(0, 5)}` : ""}</span>
          </div>
          {isCompleted && <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: T.bone }}><span>⏱</span> <span>{fmtDuration(activity.duration_minutes)}</span></div>}
        </div>

        {/* Participants */}
        {(participants.length > 0 || activity.contact_name) && (
          <div style={{ padding: "0 24px 16px" }}>
            <div style={{ fontSize: 10, color: T.fog, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)", marginBottom: 8 }}>PARTICIPANTES</div>
            <div style={{ background: T.carbon, borderRadius: 10, border: `1px solid ${T.stone}`, overflow: "hidden" }}>
              {participants.length > 0 ? participants.map((p, i) => (
                <div key={i} style={{ padding: "10px 14px", borderBottom: i < participants.length - 1 ? `1px solid ${T.stone}` : "none", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: PCOLORS[p.participant_type] || T.slate, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, color: T.bone }}>{p.participant_name}</div>
                    {p.participant_detail && <div style={{ fontSize: 11, color: T.slate }}>{p.participant_detail}</div>}
                  </div>
                </div>
              )) : activity.contact_name && (
                <div style={{ padding: "10px 14px", fontSize: 13, color: T.bone }}>{activity.contact_name}</div>
              )}
            </div>
          </div>
        )}

        {/* Corretor (activities.broker_id) — não é equipe nem participante */}
        {showBrokerSection && (
          <div style={{ padding: "0 24px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: T.fog, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)" }}>CORRETOR</div>
              {canManageBroker && !editingBroker && (
                <button type="button" onClick={() => setEditingBroker(true)} style={{ background: "none", border: "none", color: PCOLORS.broker, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{activity.broker_id ? "Trocar" : "+ Adicionar"}</button>
              )}
            </div>
            {editingBroker && canManageBroker ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <EntityPicker
                  accountId={accountId!}
                  entity="broker"
                  value={null}
                  onChange={(v) => { if (v) { onSetBroker!({ id: v.id, name: v.name }); setEditingBroker(false); } }}
                />
                <button type="button" onClick={() => setEditingBroker(false)} style={{ alignSelf: "flex-start", background: "none", border: "none", color: T.fog, fontSize: 12, cursor: "pointer", padding: 0 }}>Cancelar</button>
              </div>
            ) : activity.broker_id ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 14, background: PCOLORS.broker + "18", border: `1px solid ${PCOLORS.broker}40` }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: PCOLORS.broker, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: PCOLORS.broker, fontWeight: 600 }}>{activity.brokers?.name ?? "Corretor"}</span>
                {canManageBroker && (
                  <button type="button" title="Remover corretor" onClick={() => onSetBroker!(null)} style={{ background: "none", border: "none", color: PCOLORS.broker, fontSize: 14, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: T.slate, fontStyle: "italic" }}>Nenhum corretor informado</div>
            )}
          </div>
        )}

        {/* Equipe (participantes 'user') — add/remove */}
        {canManageTeam && (
          <div style={{ padding: "0 24px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: T.fog, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)" }}>EQUIPE INTERNA</div>
              <button type="button" onClick={() => setAddingTeam((v) => !v)} style={{ background: "none", border: "none", color: T.sprout, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{addingTeam ? "Fechar" : "+ Adicionar"}</button>
            </div>
            {teamParticipants.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: addingTeam ? 8 : 0 }}>
                {teamParticipants.map((p) => (
                  <span key={p.participant_id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 14, background: T.purple + "18", border: `1px solid ${T.purple}30`, fontSize: 12, color: T.purple }}>
                    {p.participant_name}
                    <button type="button" onClick={() => onRemoveTeamMember!(p.participant_id!)} style={{ background: "none", border: "none", color: T.purple, fontSize: 14, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>
            )}
            {addingTeam && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {(teamProfiles ?? []).filter((tp) => !teamIds.has(tp.id)).map((tp) => (
                  <button key={tp.id} type="button" onClick={() => { onAddTeamMember!({ id: tp.id, name: tp.name }); }} style={{ padding: "4px 10px", borderRadius: 14, border: `1px solid ${T.stone}`, background: "transparent", color: T.bone, fontSize: 12, cursor: "pointer" }}>+ {tp.name}</button>
                ))}
                {(teamProfiles ?? []).filter((tp) => !teamIds.has(tp.id)).length === 0 && (
                  <span style={{ fontSize: 12, color: T.slate, fontStyle: "italic" }}>Todos já adicionados</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Checklist */}
        {(items.length > 0 || canManageChecklist) && (
          <div style={{ padding: "0 24px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: T.fog, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)" }}>CHECKLIST</div>
              {items.length > 0 && <div style={{ fontSize: 11, color: T.sprout, fontFamily: "var(--font-mono)", fontWeight: 600 }}>✓ {doneCount}/{items.length}</div>}
            </div>
            {items.length > 0 && (
              <div style={{ height: 4, borderRadius: 2, background: "rgba(42,40,34,0.4)", overflow: "hidden", marginBottom: 10 }}>
                <div style={{ height: "100%", width: `${pct}%`, background: T.sprout, transition: "width 0.3s" }} />
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {items.map((it, idx) => (
                <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                  <button type="button" disabled={!canManageChecklist} onClick={() => toggleItem(it)} style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, border: `1px solid ${it.done ? T.sprout : T.stone}`, background: it.done ? T.sprout : "transparent", color: T.ink, fontSize: 11, cursor: canManageChecklist ? "pointer" : "default", display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18 }}>{it.done ? "✓" : ""}</button>
                  {canManageChecklist && onEditChecklist ? (
                    <span style={{ flex: 1 }}>
                      <InlineEdit
                        value={it.text}
                        onSave={(v) => { setItems((p) => p.map((x) => (x.id === it.id ? { ...x, text: v } : x))); onEditChecklist(it.id, v); }}
                        ariaLabel="Item da checklist"
                        textStyle={{ fontSize: 13, color: it.done ? T.slate : T.bone, textDecoration: it.done ? "line-through" : "none" }}
                        inputStyle={{ width: "100%", boxSizing: "border-box", fontSize: 13, color: T.chalk, background: T.carbon, border: `1px solid ${T.sprout}`, borderRadius: 6, padding: "4px 8px", outline: "none" }}
                      />
                    </span>
                  ) : (
                    <span style={{ flex: 1, fontSize: 13, color: it.done ? T.slate : T.bone, textDecoration: it.done ? "line-through" : "none" }}>{it.text}</span>
                  )}
                  {canManageChecklist && (
                    <>
                      <button type="button" onClick={() => moveItem(idx, -1)} disabled={idx === 0} style={{ background: "none", border: "none", color: idx === 0 ? T.stone : T.fog, fontSize: 12, cursor: idx === 0 ? "default" : "pointer", padding: "0 2px" }}>↑</button>
                      <button type="button" onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1} style={{ background: "none", border: "none", color: idx === items.length - 1 ? T.stone : T.fog, fontSize: 12, cursor: idx === items.length - 1 ? "default" : "pointer", padding: "0 2px" }}>↓</button>
                      <button type="button" onClick={() => removeItem(it.id)} style={{ background: "none", border: "none", color: T.fog, fontSize: 15, cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>×</button>
                    </>
                  )}
                </div>
              ))}
            </div>
            {canManageChecklist && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <input value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addItem(); } }} placeholder="+ adicionar item" style={{ flex: 1, background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8, padding: "9px 12px", color: T.chalk, fontSize: 13, outline: "none", minHeight: 40 }} />
                {newItem.trim() && <button type="button" onClick={() => void addItem()} style={{ background: "transparent", border: `1px solid ${T.sprout}40`, color: T.sprout, borderRadius: 8, padding: "9px 12px", fontSize: 13, cursor: "pointer" }}>Add</button>}
              </div>
            )}
          </div>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <div style={{ padding: "0 24px 16px" }}>
            <div style={{ fontSize: 10, color: T.fog, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)", marginBottom: 8 }}>FOTOS</div>
            {photos.length === 1 ? (
              <img src={photos[0].photo_url} alt="" onClick={() => setLightbox({ urls: photos.map((p) => p.photo_url), idx: 0 })} style={{ width: "100%", maxHeight: 300, objectFit: "cover", borderRadius: 8, cursor: "pointer" }} />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                {photos.map((p, i) => (
                  <img key={p.id} src={p.photo_url} alt="" onClick={() => setLightbox({ urls: photos.map((ph) => ph.photo_url), idx: i })} style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 6, cursor: "pointer" }} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Status badge */}
        {statusLabel && (
          <div style={{ padding: "0 24px 16px" }}>
            <div style={{ fontSize: 10, color: T.fog, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)", marginBottom: 8 }}>STATUS</div>
            <div style={{ padding: "10px 14px", borderRadius: 8, background: statusColor + "10", border: `1px solid ${statusColor}30`, fontSize: 13, color: statusColor, fontWeight: 500 }}>{statusLabel}</div>
          </div>
        )}

        {/* Description */}
        {activity.description && (
          <div style={{ padding: "0 24px 16px" }}>
            <div style={{ fontSize: 10, color: T.fog, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)", marginBottom: 8 }}>OBSERVAÇÕES</div>
            <div style={{ fontSize: 13, color: T.bone, lineHeight: 1.6 }}>{activity.description}</div>
          </div>
        )}

        {/* Result */}
        {isCompleted && (
          <div style={{ padding: "0 24px 16px" }}>
            <div style={{ fontSize: 10, color: T.fog, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)", marginBottom: 8 }}>RESULTADO</div>
            <div style={{ fontSize: 13, color: activity.outcome ? T.bone : T.slate, lineHeight: 1.6 }}>{activity.outcome || "Não registrado"}</div>
          </div>
        )}

        {/* Skip reason */}
        {isSkipped && activity.skip_reason && (
          <div style={{ padding: "0 24px 16px" }}>
            <div style={{ fontSize: 10, color: T.fog, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-mono)", marginBottom: 8 }}>MOTIVO</div>
            <div style={{ fontSize: 13, color: T.amber, lineHeight: 1.6 }}>{activity.skip_reason}</div>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: "12px 24px 8px", borderTop: `1px solid ${T.stone}` }}>
          <div style={{ fontSize: 11, color: T.slate }}>
            Criada por {activity.profiles?.name || "—"} em {formatDateBRT(activity.created_at)}
            {wasEdited && <span style={{ fontStyle: "italic" }}> · editada ✎</span>}
          </div>
        </div>

        {/* Action buttons */}
        {canEdit && (
          <div style={{ padding: "12px 24px 20px", display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(isScheduled || isExpired) && onComplete && <button type="button" onClick={onComplete} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: T.sprout, color: "var(--interactive-on-primary)", fontSize: 13, fontWeight: 700, cursor: "pointer", minWidth: 100 }}>{isExpired ? "✓ Concluir mesmo assim" : "✓ Concluir"}</button>}
            {!isSkipped && onEdit && <button type="button" onClick={onEdit} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.bone, fontSize: 13, cursor: "pointer", minWidth: 80 }}>✎ Editar</button>}
            {(isScheduled || isExpired) && onSkip && <button type="button" onClick={onSkip} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${T.amber}30`, background: T.amber + "10", color: T.amber, fontSize: 13, cursor: "pointer", minWidth: 80 }}>⊘ Pular</button>}
            {onArchive && (activity.archived_at ? <button type="button" onClick={() => onArchive(false)} style={{ padding: "10px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.bone, fontSize: 13, cursor: "pointer" }}>↩ Desarquivar</button> : <button type="button" onClick={() => onArchive(true)} style={{ padding: "10px 16px", borderRadius: 8, border: `1px solid ${T.stone}`, background: "transparent", color: T.bone, fontSize: 13, cursor: "pointer" }}>📥 Arquivar</button>)}
            {onDelete && <button type="button" onClick={onDelete} style={{ padding: "10px 16px", borderRadius: 8, border: `1px solid ${T.red}30`, background: T.red + "10", color: T.red, fontSize: 13, cursor: "pointer" }}>Excluir</button>}
          </div>
        )}
      </div>
      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", zIndex: 10001, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src={lightbox.urls[lightbox.idx]} alt="" style={{ maxWidth: "95vw", maxHeight: "95vh", objectFit: "contain" }} onClick={(e) => e.stopPropagation()} />
          <button type="button" onClick={() => setLightbox(null)} style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", color: "#fff", fontSize: 28, cursor: "pointer" }}>×</button>
          {lightbox.urls.length > 1 && lightbox.idx > 0 && <button type="button" onClick={(e) => { e.stopPropagation(); setLightbox({ ...lightbox, idx: lightbox.idx - 1 }); }} style={{ position: "absolute", left: 16, background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", fontSize: 24, padding: "12px 16px", borderRadius: 8, cursor: "pointer" }}>‹</button>}
          {lightbox.urls.length > 1 && lightbox.idx < lightbox.urls.length - 1 && <button type="button" onClick={(e) => { e.stopPropagation(); setLightbox({ ...lightbox, idx: lightbox.idx + 1 }); }} style={{ position: "absolute", right: 16, background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", fontSize: 24, padding: "12px 16px", borderRadius: 8, cursor: "pointer" }}>›</button>}
        </div>
      )}
    </NexaModal>
  );
}
