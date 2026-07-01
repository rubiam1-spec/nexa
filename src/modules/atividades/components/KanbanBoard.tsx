import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { computeSlotDateTime, agingLevel } from "../../../domain/atividade/ActivityScheduling";
import { useIsMobile } from "../../../shared/hooks/useIsMobile";
import InlineEdit from "./InlineEdit";
import KindIcon from "./KindIcon";
import ParticipantAvatar, { MoreAvatar } from "./ParticipantAvatar";
import { parseQuickCapture, type QuickParsed } from "../config/quickParse";
import { useHorizontalSwipe, BottomSheet } from "./mobileKit";
import { getActivityColors } from "../../../shared/utils/activityColors";
import type { ActivityKind } from "../../../infra/repositories/activityKindsRepository";

// Shape mínimo que o quadro precisa — espelha o consumido pela AtividadesPage.
export interface KanbanActivity {
  id: string;
  type: string;
  title: string;
  status: string;
  activity_date: string;
  start_time: string | null;
  updated_at?: string | null;
  profile_id: string;
  duration_minutes: number;
  client_id: string | null;
  column_id: string | null;
  kind_id?: string | null;
  activity_kinds?: { id: string; label: string; icon: string; color: string | null; base_type: string } | null;
  clients?: { name: string; temperature?: string | null } | null;
  negotiations?: { temperature: string | null } | null;
  brokers?: { name: string } | null;
  profiles?: { name: string; role: string } | null;
  activity_participants?:
    | { participant_name: string; participant_type: string; participant_id?: string | null }[]
    | null;
  activity_checklist_items?: { id: string; text: string; done: boolean; position: number }[] | null;
  third_party_property?: { id: string; titulo: string } | null;
}

export interface KanbanSuggestion {
  id: string; // negotiation_id
  clientId?: string | null;
  clientName: string;
  quadra: string;
  lote: string;
  dias: number;
}

export interface BoardColumnVM {
  id: string;
  name: string;
  color: string;
  position: number;
  completes_activity: boolean;
}

interface KanbanBoardProps {
  activities: KanbanActivity[];
  columns: BoardColumnVM[];
  suggestions: KanbanSuggestion[];
  suggestionsColumnId: string | null;
  profileId: string | null;
  isManager: boolean; // pode arrastar cards de terceiros
  canManageColumns: boolean; // pode CRUD/reordenar colunas
  typeFilter: string[]; // vazio = todos
  ownerFilter: string; // "all" = todos
  search: string; // busca client-side (título/cliente/participante)
  keyboardEnabled: boolean; // atalhos só quando view ativa e sem modal
  onCardClick: (a: KanbanActivity) => void;
  onSuggestionClick: (s: KanbanSuggestion) => void;
  onChangeColumn: (id: string, toColumnId: string) => Promise<boolean>;
  onReorderOptimistic: (
    id: string,
    schedule: { activity_date: string; start_time: string },
  ) => Promise<boolean>;
  onCompleteCard: (a: KanbanActivity) => void;
  // Soltar numa coluna que conclui dispara confirmação leve (Tarefa 3) — a
  // regra de conclusão vive na página; o board só sinaliza a intenção.
  onRequestComplete: (a: KanbanActivity, toColumnId: string, fromColumnId: string) => void;
  onAddCard: (columnId: string) => void;
  onRenameCard: (id: string, title: string) => void;
  onQuickAdd: (columnId: string, parsed: QuickParsed & { title: string }) => void | Promise<void>;
  onAddPerson: (activityId: string, profile: { id: string; name: string }) => void;
  onArchive: (id: string) => void;
  // Swipe-esquerda (mobile) → reagendar; chip de tipo → trocar categoria.
  onReschedule?: (a: KanbanActivity) => void;
  onChipClick?: (a: KanbanActivity) => void;
  // Conclusão rápida (mobile + swipe-direita) — otimista c/ desfazer. Distinto
  // do onCompleteCard (modal com resultado/duração, usado no hover desktop).
  onQuickComplete?: (a: KanbanActivity) => void;
  // Reabrir card concluído (volta para agendado) — ação discreta no card.
  onReopen?: (a: KanbanActivity) => void;
  teamProfiles: { id: string; name: string }[];
  kindsByKey: Record<string, ActivityKind>;
  onCreateColumn: () => void;
  onUpdateColumn: (id: string, patch: { name?: string; color?: string; completes_activity?: boolean }) => void;
  onDeleteColumn: (column: BoardColumnVM) => void;
  onReorderColumn: (columnId: string, newPosition: number) => void;
  toast: (msg: string) => void;
  // Card recém-criado: rola até ele e aplica flash de destaque (Tarefa 4).
  flashCardId?: string | null;
}

const T = {
  ink: "var(--surface-base)",
  carbon: "var(--surface-raised)",
  stone: "var(--border-default)",
  chalk: "var(--text-primary)",
  bone: "var(--text-secondary)",
  fog: "var(--text-muted)",
  slate: "var(--text-disabled)",
  sprout: "var(--interactive-primary)",
  blue: "#60A5FA",
  purple: "#A78BFA",
  amber: "#FBBF24",
  orange: "#F97316",
  red: "#F87171",
  rust: "#C2613A",
};

const MONO = "var(--font-mono)";

const badgeLabels: Record<string, string> = {
  visit_broker: "Visita corretor",
  visit_client: "Visita cliente",
  visit_development: "Visita empreend.",
  training: "Treinamento",
  phone_call: "Ligação",
  follow_up: "Follow-up",
  meeting_internal: "Reunião interna",
  meeting_external: "Reunião externa",
  operational: "Demanda operacional",
  other: "Outro",
};

const COLUMN_PALETTE = ["#9A958B", "#E0A23C", "#4ADE80", "#60A5FA", "#A78BFA", "#F87171", "#F97316", "#C2613A"];
const DONE_RENDER_CAP = 25;
const COL_PREFIX = "col:";

// Temperatura da negociação → dot 8px ao lado do vínculo (não mais a barra).
const TEMP_COLORS: Record<string, string> = {
  hot: "#C75B4A",
  warm: "#E0A23C",
  cold: "#5B8DB8",
};

function fmtDayMonth(dateStr: string) {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}


function isOverdueScheduled(a: KanbanActivity): boolean {
  if (a.status !== "scheduled") return false;
  const today = todayStr();
  if (a.activity_date < today) return true;
  if (a.activity_date === today && a.start_time) {
    const [h, m] = a.start_time.split(":");
    const at = new Date();
    at.setHours(Number(h) || 0, Number(m) || 0, 0, 0);
    return at.getTime() < Date.now();
  }
  return false;
}

function bondLine(a: KanbanActivity): string {
  const parts: string[] = [];
  if (a.third_party_property?.titulo) parts.push(a.third_party_property.titulo);
  if (a.clients?.name) parts.push(a.clients.name);
  else if (a.activity_participants?.length) {
    const first = a.activity_participants.find((p) => p.participant_type !== "user");
    if (first) parts.push(first.participant_name);
  }
  return parts.join(" · ");
}

export default function KanbanBoard({
  activities,
  columns,
  suggestions,
  suggestionsColumnId,
  profileId,
  isManager,
  canManageColumns,
  typeFilter,
  ownerFilter,
  search,
  keyboardEnabled,
  onCardClick,
  onSuggestionClick,
  onChangeColumn,
  onReorderOptimistic,
  onCompleteCard,
  onRequestComplete,
  onAddCard,
  onRenameCard,
  onQuickAdd,
  onAddPerson,
  onArchive,
  onReschedule,
  onChipClick,
  onQuickComplete,
  onReopen,
  teamProfiles,
  kindsByKey,
  onCreateColumn,
  onUpdateColumn,
  onDeleteColumn,
  onReorderColumn,
  toast,
  flashCardId,
}: KanbanBoardProps) {
  const mobile = useIsMobile();
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveMenuFor, setMoveMenuFor] = useState<KanbanActivity | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColId, setOverColId] = useState<string | null>(null);
  const [showAllDone, setShowAllDone] = useState<Record<string, boolean>>({});
  // Navegação por teclado (mouseless): coluna + card focados.
  const [focusedColId, setFocusedColId] = useState<string | null>(null);
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  // Click-to-edit do título e popover de pessoa (controlados pelo board).
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [personPopoverFor, setPersonPopoverFor] = useState<KanbanActivity | null>(null);

  // Física do drag (Tarefa 1): threshold 8px no ponteiro garante que clique
  // simples abra o card e nunca inicie arrasto; long-press (250ms) no toque
  // evita drag acidental ao rolar a coluna no mobile (padrão Trello).
  // Toque é tratado SÓ pelo TouchSensor (long-press 250ms) para não brigar com o
  // swipe horizontal do card; o MouseSensor cuida do desktop. (Antes, o
  // PointerSensor armava o drag a 8px em qualquer direção e engolia o swipe.)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const colById = useMemo(() => {
    const m = new Map<string, BoardColumnVM>();
    for (const c of columns) m.set(c.id, c);
    return m;
  }, [columns]);
  const orderedCols = useMemo(
    () => [...columns].sort((a, b) => a.position - b.position),
    [columns],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activities.filter((a) => {
      if (typeFilter.length > 0 && !typeFilter.includes(a.type)) return false;
      if (ownerFilter !== "all" && a.profile_id !== ownerFilter) return false;
      if (q) {
        const inTitle = a.title?.toLowerCase().includes(q);
        const inClient = a.clients?.name?.toLowerCase().includes(q);
        const inPart = (a.activity_participants ?? []).some((p) =>
          p.participant_name?.toLowerCase().includes(q),
        );
        if (!inTitle && !inClient && !inPart) return false;
      }
      return true;
    });
  }, [activities, typeFilter, ownerFilter, search]);

  // Agrupa por column_id (não por status). column_id NULL não aparece.
  const grouped = useMemo(() => {
    const byCol: Record<string, KanbanActivity[]> = {};
    for (const c of columns) byCol[c.id] = [];
    for (const a of filtered) {
      if (a.column_id && byCol[a.column_id]) byCol[a.column_id].push(a);
    }
    for (const c of columns) {
      if (c.completes_activity) {
        byCol[c.id].sort(
          (a, b) =>
            b.activity_date.localeCompare(a.activity_date) ||
            (b.start_time || "").localeCompare(a.start_time || ""),
        );
      } else {
        byCol[c.id].sort(
          (a, b) =>
            a.activity_date.localeCompare(b.activity_date) ||
            (a.start_time || "").localeCompare(b.start_time || ""),
        );
      }
    }
    return byCol;
  }, [filtered, columns]);

  const byId = useMemo(() => {
    const m = new Map<string, KanbanActivity>();
    for (const a of filtered) m.set(a.id, a);
    return m;
  }, [filtered]);

  const canDrag = (a: KanbanActivity) =>
    Boolean(profileId) && (a.profile_id === profileId || isManager);

  const activeCard = activeId && !activeId.startsWith(COL_PREFIX) ? byId.get(activeId) ?? null : null;

  // Resolve a coluna alvo a partir do `over` (card ou nó da coluna).
  const targetColOf = (overId: string | null): string | null => {
    if (!overId) return null;
    if (overId.startsWith(COL_PREFIX)) return overId.slice(COL_PREFIX.length);
    const a = byId.get(overId);
    return a?.column_id ?? null;
  };

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const handleDragOver = (e: DragOverEvent) => {
    const aId = String(e.active.id);
    if (aId.startsWith(COL_PREFIX)) {
      setOverColId(null);
      return;
    }
    setOverColId(targetColOf(e.over ? String(e.over.id) : null));
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const aId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    setActiveId(null);
    setOverColId(null);
    if (!overId) return;

    // ── Reordenar COLUNA ──
    if (aId.startsWith(COL_PREFIX)) {
      if (!canManageColumns || !overId.startsWith(COL_PREFIX)) return;
      const movedId = aId.slice(COL_PREFIX.length);
      const overColumnId = overId.slice(COL_PREFIX.length);
      if (movedId === overColumnId) return;
      const ids = orderedCols.map((c) => c.id);
      const oldIndex = ids.indexOf(movedId);
      const newIndex = ids.indexOf(overColumnId);
      if (oldIndex < 0 || newIndex < 0) return;
      const reordered = arrayMove(ids, oldIndex, newIndex);
      const pos = reordered.indexOf(movedId);
      const prevPos = pos > 0 ? colById.get(reordered[pos - 1])?.position ?? null : null;
      const nextPos =
        pos < reordered.length - 1 ? colById.get(reordered[pos + 1])?.position ?? null : null;
      let newPosition: number;
      if (prevPos != null && nextPos != null) newPosition = (prevPos + nextPos) / 2;
      else if (prevPos != null) newPosition = prevPos + 1000;
      else if (nextPos != null) newPosition = nextPos - 1000;
      else newPosition = 1000;
      onReorderColumn(movedId, newPosition);
      return;
    }

    // ── Card ──
    const card = byId.get(aId);
    if (!card || !canDrag(card)) return;
    const sourceCol = card.column_id;
    const targetCol = targetColOf(overId);
    if (!sourceCol || !targetCol) return;

    // Drop em OUTRA coluna = muda só column_id (status independente).
    if (targetCol !== sourceCol) {
      const destCompletes = colById.get(targetCol)?.completes_activity;
      // Coluna que conclui + card ainda não concluído → confirmação leve.
      // O card assenta na coluna destino (otimista, na página) mas a
      // conclusão fica pendente até o usuário decidir.
      if (destCompletes && card.status !== "completed") {
        onRequestComplete(card, targetCol, sourceCol);
        return;
      }
      setMovingId(aId);
      try {
        const ok = await onChangeColumn(aId, targetCol);
        if (!ok) toast("Não foi possível mover (sem permissão)");
      } finally {
        setMovingId(null);
      }
      return;
    }

    // Mesma coluna: reorder por horário (só colunas de planejamento).
    if (colById.get(sourceCol)?.completes_activity) return;
    const list = grouped[sourceCol] ?? [];
    const ids = list.map((a) => a.id);
    const oldIndex = ids.indexOf(aId);
    let newIndex: number;
    if (overId.startsWith(COL_PREFIX)) newIndex = ids.length - 1;
    else newIndex = ids.indexOf(overId);
    if (newIndex < 0 || oldIndex < 0 || oldIndex === newIndex) return;

    const reordered = arrayMove(ids, oldIndex, newIndex);
    const pos = reordered.indexOf(aId);
    const prevCard = pos > 0 ? byId.get(reordered[pos - 1]) ?? null : null;
    const nextCard = pos < reordered.length - 1 ? byId.get(reordered[pos + 1]) ?? null : null;
    const taken = list
      .filter((a) => a.id !== aId)
      .map((a) => a.start_time?.slice(0, 5))
      .filter((t): t is string => Boolean(t));
    const slot = computeSlotDateTime(
      prevCard ? { activity_date: prevCard.activity_date, start_time: prevCard.start_time } : null,
      nextCard ? { activity_date: nextCard.activity_date, start_time: nextCard.start_time } : null,
      { taken },
    );
    setMovingId(aId);
    try {
      const ok = await onReorderOptimistic(aId, slot);
      if (ok) toast(`Reagendado para ${fmtDayMonth(slot.activity_date)} ${slot.start_time} ✓`);
      else toast("Não foi possível reagendar (sem permissão)");
    } finally {
      setMovingId(null);
    }
  };

  const moveViaMenu = async (a: KanbanActivity, toColumnId: string) => {
    if (!canDrag(a) || a.column_id === toColumnId) {
      setMoveMenuFor(null);
      return;
    }
    const destCompletes = colById.get(toColumnId)?.completes_activity;
    if (destCompletes && a.status !== "completed") {
      setMoveMenuFor(null);
      onRequestComplete(a, toColumnId, a.column_id ?? "");
      return;
    }
    setMovingId(a.id);
    try {
      const ok = await onChangeColumn(a.id, toColumnId);
      if (!ok) toast("Não foi possível mover (sem permissão)");
    } finally {
      setMovingId(null);
      setMoveMenuFor(null);
    }
  };

  // ── Atalhos de teclado (mouseless) — só no Quadro, foco fora de input/modal ──
  useEffect(() => {
    if (!keyboardEnabled || mobile) return;
    const cols = orderedCols;
    if (cols.length === 0) return;
    const visibleItems = (cid: string) => {
      const all = grouped[cid] ?? [];
      const c = colById.get(cid);
      return c?.completes_activity && !showAllDone[cid] ? all.slice(0, DONE_RENDER_CAP) : all;
    };
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const colIdx = Math.max(0, cols.findIndex((c) => c.id === (focusedColId ?? cols[0].id)));
      const curCol = cols[colIdx];
      const items = visibleItems(curCol.id);
      const cardIdx = items.findIndex((a) => a.id === focusedCardId);
      switch (e.key) {
        case "ArrowDown":
        case "j": {
          e.preventDefault();
          const ni = cardIdx < 0 ? 0 : Math.min(items.length - 1, cardIdx + 1);
          if (items[ni]) { setFocusedColId(curCol.id); setFocusedCardId(items[ni].id); }
          break;
        }
        case "ArrowUp":
        case "k": {
          e.preventDefault();
          const ni = cardIdx <= 0 ? 0 : cardIdx - 1;
          if (items[ni]) { setFocusedColId(curCol.id); setFocusedCardId(items[ni].id); }
          break;
        }
        case "ArrowRight":
        case "l": {
          e.preventDefault();
          const nc = cols[Math.min(cols.length - 1, colIdx + 1)];
          setFocusedColId(nc.id);
          setFocusedCardId(visibleItems(nc.id)[0]?.id ?? null);
          break;
        }
        case "ArrowLeft":
        case "h": {
          e.preventDefault();
          const nc = cols[Math.max(0, colIdx - 1)];
          setFocusedColId(nc.id);
          setFocusedCardId(visibleItems(nc.id)[0]?.id ?? null);
          break;
        }
        case "Enter": {
          if (focusedCardId) { const a = byId.get(focusedCardId); if (a) { e.preventDefault(); onCardClick(a); } }
          break;
        }
        case "c":
        case "C": {
          if (focusedCardId) { const a = byId.get(focusedCardId); if (a && a.status !== "completed") { e.preventDefault(); onCompleteCard(a); } }
          break;
        }
        case "e":
        case "E": {
          if (focusedCardId && byId.get(focusedCardId)) { e.preventDefault(); setEditingCardId(focusedCardId); }
          break;
        }
        case "m":
        case "M": {
          if (focusedCardId) { const a = byId.get(focusedCardId); if (a) { e.preventDefault(); setPersonPopoverFor(a); } }
          break;
        }
        case "Escape":
          setFocusedCardId(null);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [keyboardEnabled, mobile, orderedCols, grouped, colById, showAllDone, focusedColId, focusedCardId, byId, onCardClick, onCompleteCard]);

  // Scroll do card focado para dentro da viewport.
  useEffect(() => {
    if (!focusedCardId) return;
    document.getElementById(`kcard-${focusedCardId}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [focusedCardId]);

  // Visibilidade pós-criação (Tarefa 4): rola até o card recém-criado, no
  // eixo vertical da coluna e horizontal do board. Depende de `activities`
  // para reexecutar quando o card monta após o refetch.
  useEffect(() => {
    if (!flashCardId) return;
    const el = document.getElementById(`kcard-${flashCardId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }, [flashCardId, activities]);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, height: "100%" }}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setOverColId(null);
        }}
      >
        <div
          style={{
            display: "flex",
            gap: mobile ? 12 : 16,
            flex: 1,
            minHeight: 0,
            overflowX: "auto",
            overflowY: "hidden",
            scrollSnapType: mobile ? "x mandatory" : undefined,
            paddingBottom: mobile ? "calc(env(safe-area-inset-bottom, 0px) + 8px)" : 4,
            WebkitOverflowScrolling: mobile ? "touch" : undefined,
            alignItems: "stretch",
          }}
        >
          <SortableContext
            items={orderedCols.map((c) => `${COL_PREFIX}${c.id}`)}
            strategy={horizontalListSortingStrategy}
          >
            {orderedCols.map((col) => {
              const all = grouped[col.id] ?? [];
              const isDone = col.completes_activity;
              const expanded = showAllDone[col.id];
              const items = isDone && !expanded ? all.slice(0, DONE_RENDER_CAP) : all;
              return (
                <Column
                  key={col.id}
                  col={col}
                  isOver={overColId === col.id}
                  totalCount={all.length}
                  suggestionCount={col.id === suggestionsColumnId ? suggestions.length : 0}
                  mobile={mobile}
                  canManageColumns={canManageColumns}
                  onUpdateColumn={onUpdateColumn}
                  onDeleteColumn={() => onDeleteColumn(col)}
                  onAddCard={() => onAddCard(col.id)}
                  onQuickAdd={(parsed) => onQuickAdd(col.id, parsed)}
                  kindsByKey={kindsByKey}
                  teamProfiles={teamProfiles}
                >
                  {col.id === suggestionsColumnId &&
                    suggestions.map((s) => (
                      <SuggestionCard key={`sug-${s.id}`} suggestion={s} onClick={() => onSuggestionClick(s)} />
                    ))}

                  {all.length === 0 && (col.id !== suggestionsColumnId || suggestions.length === 0) && (
                    <div
                      style={{
                        fontSize: 12,
                        color: T.slate,
                        fontStyle: "italic",
                        textAlign: "center",
                        padding: "20px 8px",
                      }}
                    >
                      Coluna vazia
                    </div>
                  )}

                  <SortableContext items={items.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                    {items.map((a) => (
                      <SortableCard
                        key={a.id}
                        activity={a}
                        disabled={!canDrag(a)}
                        moving={movingId === a.id}
                        dimmed={activeId === a.id}
                        focused={focusedCardId === a.id}
                        flash={flashCardId === a.id}
                        editing={editingCardId === a.id}
                        onEditingChange={(v) => setEditingCardId(v ? a.id : null)}
                        onRename={(title) => onRenameCard(a.id, title)}
                        onAddPersonClick={() => setPersonPopoverFor(a)}
                        onArchive={() => onArchive(a.id)}
                        mobile={mobile}
                        onClick={() => onCardClick(a)}
                        onMoveMenu={() => setMoveMenuFor(a)}
                        onComplete={() => onCompleteCard(a)}
                        onQuickComplete={onQuickComplete ? () => onQuickComplete(a) : undefined}
                        onReopen={onReopen ? () => onReopen(a) : undefined}
                        onReschedule={onReschedule ? () => onReschedule(a) : undefined}
                        onChipClick={onChipClick ? () => onChipClick(a) : undefined}
                        columnCompletes={col.completes_activity}
                      />
                    ))}
                  </SortableContext>

                  {isDone && all.length > DONE_RENDER_CAP && (
                    <button
                      type="button"
                      onClick={() => setShowAllDone((p) => ({ ...p, [col.id]: !p[col.id] }))}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: `1px dashed ${T.stone}`,
                        background: "transparent",
                        color: T.fog,
                        fontFamily: MONO,
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      {expanded ? "Mostrar menos" : `Ver mais (${all.length - DONE_RENDER_CAP})`}
                    </button>
                  )}
                </Column>
              );
            })}
          </SortableContext>

          {canManageColumns && (
            <button
              type="button"
              onClick={onCreateColumn}
              style={{
                flex: "0 0 auto",
                width: mobile ? "70vw" : 200,
                alignSelf: "flex-start",
                minHeight: 48,
                borderRadius: 12,
                border: `1px dashed ${T.stone}`,
                background: "transparent",
                color: T.fog,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              + adicionar coluna
            </button>
          )}
        </div>

        <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
          {activeCard ? <CardView activity={activeCard} mobile={mobile} overlay /> : null}
        </DragOverlay>
      </DndContext>

      {moveMenuFor && (
        <MoveMenu
          activity={moveMenuFor}
          columns={orderedCols}
          onClose={() => setMoveMenuFor(null)}
          onSelect={(colId) => moveViaMenu(moveMenuFor, colId)}
        />
      )}

      {personPopoverFor && (
        <PersonPicker
          activity={personPopoverFor}
          teamProfiles={teamProfiles}
          onClose={() => setPersonPopoverFor(null)}
          onSelect={(p) => { onAddPerson(personPopoverFor.id, p); setPersonPopoverFor(null); toast("Salvo com sucesso ✓"); }}
        />
      )}
    </div>
  );
}

function PersonPicker({
  activity,
  teamProfiles,
  onClose,
  onSelect,
}: {
  activity: KanbanActivity;
  teamProfiles: { id: string; name: string }[];
  onClose: () => void;
  onSelect: (p: { id: string; name: string }) => void;
}) {
  const already = new Set(
    (activity.activity_participants ?? [])
      .filter((p) => p.participant_type === "user" && p.participant_id)
      .map((p) => p.participant_id),
  );
  const available = teamProfiles.filter((p) => !already.has(p.id));
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9500 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%,-50%)",
          width: 320,
          maxWidth: "92vw",
          maxHeight: "70vh",
          overflowY: "auto",
          background: T.ink,
          border: `1px solid ${T.stone}`,
          borderRadius: 14,
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ fontSize: 13, color: T.fog, fontFamily: MONO, textAlign: "center", marginBottom: 6 }}>
          Adicionar pessoa
        </div>
        {available.length === 0 && (
          <div style={{ fontSize: 12, color: T.slate, fontStyle: "italic", textAlign: "center", padding: "12px 0" }}>
            Todos já adicionados
          </div>
        )}
        {available.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              minHeight: 44,
              padding: "8px 12px",
              borderRadius: 10,
              border: `1px solid ${T.stone}`,
              background: "var(--surface-raised)",
              color: T.chalk,
              fontSize: 14,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <ParticipantAvatar name={p.name} title={p.name} size={26} ring="var(--surface-base)" />
            {p.name}
          </button>
        ))}
        <button
          type="button"
          onClick={onClose}
          style={{ minHeight: 40, marginTop: 4, border: "none", background: "transparent", color: T.fog, fontSize: 13, cursor: "pointer" }}
        >
          Cancelar
        </button>
      </div>
    </div>,
    document.body,
  );
}

// ── Sub-components ──

function Column({
  col,
  isOver,
  totalCount,
  suggestionCount,
  mobile,
  canManageColumns,
  onUpdateColumn,
  onDeleteColumn,
  onAddCard,
  onQuickAdd,
  kindsByKey,
  teamProfiles,
  children,
}: {
  col: BoardColumnVM;
  isOver: boolean;
  totalCount: number;
  suggestionCount: number;
  mobile: boolean;
  canManageColumns: boolean;
  onUpdateColumn: (id: string, patch: { name?: string; color?: string; completes_activity?: boolean }) => void;
  onDeleteColumn: () => void;
  onAddCard: () => void;
  onQuickAdd: (parsed: QuickParsed & { title: string }) => void;
  kindsByKey: Record<string, ActivityKind>;
  teamProfiles: { id: string; name: string }[];
  children: React.ReactNode;
}) {
  // A coluna é sortable (reordenação) — os listeners ficam só no grip.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${COL_PREFIX}${col.id}`,
    disabled: !canManageColumns,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [parsed, setParsed] = useState<QuickParsed>({ kind: null });
  const draftRef = useRef<HTMLTextAreaElement>(null);

  // Quick-add inteligente: parseia o texto (debounce 250ms) → chips.
  useEffect(() => {
    if (!adding || !draft.trim()) { setParsed({ kind: null }); return; }
    const t = setTimeout(() => setParsed(parseQuickCapture(draft, kindsByKey, teamProfiles)), 250);
    return () => clearTimeout(t);
  }, [draft, adding, kindsByKey, teamProfiles]);

  const submitQuick = () => {
    const title = draft.trim();
    if (!title) return;
    const p = parseQuickCapture(title, kindsByKey, teamProfiles);
    onQuickAdd({ ...p, title });
    setDraft("");
    setParsed({ kind: null });
    setTimeout(() => draftRef.current?.focus(), 0);
  };

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    flex: "0 0 auto",
    width: mobile ? "85vw" : 312,
    scrollSnapAlign: mobile ? "start" : undefined,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    background: isOver
      ? "linear-gradient(145deg, rgba(74,222,128,0.08), var(--surface-base))"
      : "linear-gradient(145deg, var(--surface-raised), var(--surface-base))",
    border: `1px solid ${isOver ? T.sprout : T.stone}`,
    borderRadius: 12,
    minHeight: 0,
  };

  return (
    <div ref={setNodeRef} data-col-id={col.id} style={style}>
      {/* Header fixo */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          padding: "14px 14px 10px",
          borderBottom: `1px solid ${T.stone}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {canManageColumns && (
            <span
              {...attributes}
              {...listeners}
              title="Arraste para reordenar"
              style={{ cursor: "grab", color: T.slate, fontSize: 12, lineHeight: 1, touchAction: "none" }}
            >
              ⠿
            </span>
          )}
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.color, flexShrink: 0 }} />
          {canManageColumns ? (
            <InlineEdit
              value={col.name}
              onSave={(v) => onUpdateColumn(col.id, { name: v })}
              ariaLabel="Nome da coluna"
              textStyle={{ fontSize: 12, fontWeight: 600, color: T.chalk, textTransform: "uppercase", letterSpacing: "0.06em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              inputStyle={{ fontSize: 12, fontWeight: 600, color: T.chalk, background: "var(--surface-base)", border: `1px solid ${T.sprout}`, borderRadius: 6, padding: "2px 6px", outline: "none", width: 150, textTransform: "uppercase", letterSpacing: "0.06em" }}
            />
          ) : (
            <span style={{ fontSize: 12, fontWeight: 600, color: T.chalk, textTransform: "uppercase", letterSpacing: "0.06em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {col.name}
            </span>
          )}
          {col.completes_activity && (
            <span title="Concluir ao soltar aqui" style={{ color: T.sprout, fontSize: 11 }}>✓</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 11,
              color: T.fog,
              background: "rgba(42,40,34,0.4)",
              padding: "2px 8px",
              borderRadius: 10,
            }}
          >
            {totalCount}
            {suggestionCount > 0 ? ` + ${suggestionCount}` : ""}
          </span>
          {canManageColumns && (
            <button
              type="button"
              onClick={(e) => { setMenuAnchor(e.currentTarget.getBoundingClientRect()); setMenuOpen((v) => !v); }}
              style={{ background: "none", border: "none", color: T.fog, fontSize: 16, cursor: "pointer", padding: "0 2px", lineHeight: 1 }}
            >
              ⋮
            </button>
          )}
          {menuOpen && (
            <ColumnMenu
              col={col}
              anchor={menuAnchor}
              mobile={mobile}
              onClose={() => setMenuOpen(false)}
              onUpdate={(patch) => onUpdateColumn(col.id, patch)}
              onDelete={onDeleteColumn}
            />
          )}
        </div>
      </div>

      {/* Lista rolável (só ela rola) */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "12px 12px",
        }}
      >
        {children}
      </div>

      {/* Rodapé: captura rápida inline sequencial (Trello-style) */}
      <div style={{ flexShrink: 0, padding: "0 12px 12px" }}>
        {adding ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <textarea
              ref={draftRef}
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitQuick();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setAdding(false);
                  setDraft("");
                }
              }}
              placeholder="Ex: ligar pro João amanhã 10h — Enter cria"
              rows={2}
              style={{ resize: "none", background: "var(--surface-base)", border: `1px solid ${T.sprout}`, borderRadius: 8, padding: "8px 10px", color: T.chalk, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" }}
            />
            {/* Chips do que o parser entendeu */}
            {(parsed.date || parsed.time || (parsed.kind && parsed.kind.key !== "other") || parsed.participant) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {(parsed.date || parsed.time) && (
                  <QuickChip>{[parsed.date ? fmtDayMonth(parsed.date) : null, parsed.time].filter(Boolean).join(" · ")}</QuickChip>
                )}
                {parsed.kind && parsed.kind.key !== "other" && <QuickChip>tipo: {parsed.kind.label}</QuickChip>}
                {parsed.participant && <QuickChip>@{parsed.participant.name.split(" ")[0]}</QuickChip>}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button type="button" onClick={submitQuick} style={{ background: T.sprout, color: "var(--surface-base)", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Adicionar</button>
              <button type="button" onClick={() => { setAdding(false); setDraft(""); }} style={{ background: "none", border: "none", color: T.fog, fontSize: 16, cursor: "pointer", lineHeight: 1 }}>×</button>
              <button type="button" onClick={() => { setAdding(false); setDraft(""); onAddCard(); }} title="Criação completa" style={{ marginLeft: "auto", background: "none", border: "none", color: T.fog, fontFamily: MONO, fontSize: 11, cursor: "pointer" }}>completo →</button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: 8,
              border: `1px dashed ${T.stone}`,
              background: "transparent",
              color: T.fog,
              fontFamily: MONO,
              fontSize: 11,
              cursor: "pointer",
              textAlign: "left",
              transition: "border-color 0.16s ease, color 0.16s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.sprout + "66"; e.currentTarget.style.color = T.bone; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.stone; e.currentTarget.style.color = T.fog; }}
          >
            + adicionar cartão
          </button>
        )}
      </div>
    </div>
  );
}

function ColumnMenu({
  col,
  onClose,
  onUpdate,
  onDelete,
  anchor,
  mobile,
}: {
  col: BoardColumnVM;
  onClose: () => void;
  onUpdate: (patch: { name?: string; color?: string; completes_activity?: boolean }) => void;
  onDelete: () => void;
  anchor?: DOMRect | null;
  mobile?: boolean;
}) {
  const [name, setName] = useState(col.name);
  // Ancorado por portal com clamp na viewport (nunca corta na borda).
  const W = 230;
  const left = anchor ? Math.min(Math.max(8, anchor.right - W), window.innerWidth - W - 8) : 8;
  const top = anchor ? Math.min(anchor.bottom + 6, window.innerHeight - 8) : 8;
  const inner = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name.trim() !== col.name && onUpdate({ name: name.trim() })}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) {
            onUpdate({ name: name.trim() });
            onClose();
          }
        }}
        placeholder="Nome da coluna"
        style={{ background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 8, padding: "10px 12px", color: T.chalk, fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" }}
      />

      {/* Cor — círculos perfeitos e iguais (flex:none, nunca esticam); selecionado com anel. */}
      <div>
        <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.slate, marginBottom: 8 }}>Cor</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {COLUMN_PALETTE.map((c) => {
            const selected = col.color === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => onUpdate({ color: c })}
                aria-label={`Cor ${c}`}
                aria-pressed={selected}
                style={{ width: 44, height: 44, flex: "none", padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", borderRadius: "50%", cursor: "pointer" }}
              >
                <span style={{ width: 30, height: 30, flex: "none", borderRadius: "50%", background: c, display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: selected ? `0 0 0 2px ${T.carbon}, 0 0 0 4px ${T.chalk}` : "none" }}>
                  {selected && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ stroke: T.ink, strokeWidth: 3.5, strokeLinecap: "round", strokeLinejoin: "round" }}><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* "Conclui" — checkbox estilizado + label na mesma linha, toque ≥44px. */}
      <label style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 44, cursor: "pointer", fontSize: 14, color: T.bone }}>
        <span style={{ position: "relative", flex: "none", width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${col.completes_activity ? T.sprout : T.stone}`, background: col.completes_activity ? T.sprout : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <input
            type="checkbox"
            checked={col.completes_activity}
            onChange={(e) => onUpdate({ completes_activity: e.target.checked })}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", margin: 0, opacity: 0, cursor: "pointer" }}
          />
          {col.completes_activity && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ stroke: T.ink, strokeWidth: 3.5, strokeLinecap: "round", strokeLinejoin: "round" }}><polyline points="20 6 9 17 4 12" /></svg>
          )}
        </span>
        Esta coluna conclui a atividade
      </label>

      <div style={{ height: 1, background: T.stone, opacity: 0.6 }} />

      <button
        type="button"
        onClick={() => { onClose(); onDelete(); }}
        style={{ width: "100%", minHeight: 44, background: "transparent", border: `1px solid ${T.red}55`, color: T.red, borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
      >
        Excluir coluna
      </button>
    </div>
  );
  if (mobile) return <BottomSheet open onClose={onClose} title={col.name || "Coluna"}>{inner}</BottomSheet>;
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9000 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0 }} />
      <div style={{ position: "fixed", top, left, width: W, maxHeight: "80vh", overflowY: "auto", background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 10, padding: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column", gap: 10 }}>{inner}</div>
    </div>,
    document.body,
  );
}

function SortableCard({
  activity,
  disabled,
  moving,
  dimmed,
  focused,
  flash,
  editing,
  onEditingChange,
  onRename,
  onAddPersonClick,
  onArchive,
  mobile,
  onClick,
  onMoveMenu,
  onComplete,
  onQuickComplete,
  onReopen,
  onReschedule,
  onChipClick,
  columnCompletes,
}: {
  activity: KanbanActivity;
  disabled: boolean;
  moving: boolean;
  dimmed: boolean;
  focused: boolean;
  flash: boolean;
  editing: boolean;
  onEditingChange: (v: boolean) => void;
  onRename: (title: string) => void;
  onAddPersonClick: () => void;
  onArchive: () => void;
  mobile: boolean;
  onClick: () => void;
  onMoveMenu: () => void;
  onComplete: () => void;
  onQuickComplete?: () => void;
  onReopen?: () => void;
  onReschedule?: () => void;
  onChipClick?: () => void;
  columnCompletes?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: activity.id,
    disabled,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 0.18s ease",
    opacity: dimmed || isDragging ? 0.4 : moving ? 0.5 : 1,
    cursor: isDragging ? "grabbing" : undefined,
  };
  // Quando editando o título, suspende os listeners de drag para não brigar.
  const dragProps = editing ? {} : { ...attributes, ...listeners };
  return (
    <div id={`kcard-${activity.id}`} ref={setNodeRef} style={style} {...dragProps}>
      <CardView
        activity={activity}
        draggable={!disabled}
        focused={focused}
        flash={flash}
        editing={editing}
        onEditingChange={onEditingChange}
        onRename={onRename}
        onAddPersonClick={onAddPersonClick}
        onArchive={onArchive}
        mobile={mobile}
        onClick={onClick}
        onMoveMenu={onMoveMenu}
        onComplete={!disabled ? onComplete : undefined}
        onQuickComplete={!disabled ? onQuickComplete : undefined}
        onReopen={!disabled ? onReopen : undefined}
        onReschedule={!disabled ? onReschedule : undefined}
        onChipClick={onChipClick}
        columnCompletes={columnCompletes}
      />
    </div>
  );
}

function CardView({
  activity,
  draggable,
  focused,
  flash,
  editing,
  onEditingChange,
  onRename,
  onAddPersonClick,
  onArchive,
  mobile,
  onClick,
  onMoveMenu,
  onComplete,
  onQuickComplete,
  onReopen,
  onReschedule,
  onChipClick,
  columnCompletes,
  overlay,
}: {
  activity: KanbanActivity;
  draggable?: boolean;
  focused?: boolean;
  flash?: boolean;
  editing?: boolean;
  onEditingChange?: (v: boolean) => void;
  onRename?: (title: string) => void;
  onAddPersonClick?: () => void;
  onArchive?: () => void;
  mobile: boolean;
  onClick?: () => void;
  onMoveMenu?: () => void;
  onComplete?: () => void;
  onQuickComplete?: () => void;
  onReopen?: () => void;
  onReschedule?: () => void;
  onChipClick?: () => void;
  columnCompletes?: boolean;
  overlay?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  // Uma cor = uma leitura: a trilha esquerda é SEMPRE o tipo (mesma fonte da
  // Lista via getActivityColors). Temperatura saiu da barra (vira dot no vínculo).
  const typeColor = getActivityColors(activity.type).color;
  // Label/ícone vêm do catálogo (kind) quando disponível; fallback no type.
  const kind = activity.activity_kinds;
  const typeLabel = kind?.label || badgeLabels[activity.type] || activity.type;
  const iconName = kind?.icon || null;
  const overdue = isOverdueScheduled(activity);
  const completed = activity.status === "completed";
  // Coluna que conclui também conta como "feito" — coerência na coluna Concluída,
  // mesmo que o status ainda não seja completed (column_id é independente).
  // "Atrasada" é só rótulo: nunca reativa "Concluir" aqui.
  const isDone = completed || !!columnCompletes;
  const bond = bondLine(activity);
  const owner = activity.profiles?.name || "—";
  const day = new Date(activity.activity_date + "T12:00:00");
  const dayLabel = day.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const time = activity.start_time?.substring(0, 5) || "";
  const teamParticipants = (activity.activity_participants ?? []).filter((p) => p.participant_type === "user");
  const checklist = activity.activity_checklist_items ?? [];
  const checklistDone = checklist.filter((c) => c.done).length;

  // Temperatura só quando há negociação vinculada → dot 8px ao lado do vínculo.
  const negTemp = activity.negotiations?.temperature ?? null;
  const tempColor = negTemp ? TEMP_COLORS[negTemp] ?? null : null;

  // Aging: só esmaece o card (sem texto gritando) — detalhe textual fica na ficha.
  const aging = isDone || overlay ? "none" : agingLevel(activity.updated_at);
  const baseOpacity = isDone ? 0.68 : aging === "stale" ? 0.6 : aging === "soft" ? 0.82 : 1;
  const showActions = hovered && !mobile && !overlay && draggable && !editing;

  // Conclusão rápida (mobile/swipe) cai no quick-complete; sem ele, no modal.
  const quickComplete = onQuickComplete ?? onComplete;
  // Swipe (mobile, arrastável, não concluído): direita = concluir, esquerda = reagendar.
  const swipeEnabled = !!mobile && !overlay && !editing && !!draggable && !isDone;
  const { dx, swiping, handlers } = useHorizontalSwipe({
    enabled: swipeEnabled,
    onRight: () => quickComplete?.(),
    onLeft: () => onReschedule?.(),
  });

  const titleStyle: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 600,
    color: isDone ? T.fog : T.chalk,
    lineHeight: 1.25,
    textDecoration: isDone ? "line-through" : "none",
    textDecorationColor: "rgba(112,107,95,0.4)",
    display: "block",
  };
  const chipClickable = !!onChipClick && !overlay;

  return (
    <div style={{ position: "relative" }}>
      {/* Trilhos de ação revelados no swipe */}
      {swipeEnabled && dx !== 0 && (
        <>
          <div style={{ position: "absolute", inset: 0, borderRadius: 10, display: "flex", alignItems: "center", paddingLeft: 16, fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: T.sprout, background: "rgba(74,222,128,0.12)", opacity: dx > 0 ? 1 : 0 }}>CONCLUIR</div>
          <div style={{ position: "absolute", inset: 0, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 16, fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: T.amber, background: "rgba(224,162,60,0.12)", opacity: dx < 0 ? 1 : 0 }}>REAGENDAR</div>
        </>
      )}
      <div
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        {...(swipeEnabled ? handlers : {})}
        role="button"
        tabIndex={0}
        aria-disabled={!draggable}
        style={{
          position: "relative",
          background: "var(--surface-base)",
          border: `1px solid ${focused ? T.sprout : T.stone}`,
          borderLeft: `4px solid ${typeColor}`,
          borderRadius: 10,
          padding: 12,
          cursor: draggable ? "grab" : "pointer",
          opacity: overlay ? 1 : baseOpacity,
          boxShadow: overlay
            ? "0 10px 28px rgba(0,0,0,0.5)"
            : focused
            ? "0 0 0 2px var(--interactive-primary)"
            : hovered && !mobile
            ? "0 4px 12px rgba(0,0,0,0.28)"
            : "0 1px 2px rgba(0,0,0,0.15)",
          transform: dx !== 0 ? `translateX(${dx}px)` : overlay ? "rotate(3deg)" : hovered && !mobile ? "translateY(-2px)" : "none",
          transition: swiping ? "none" : "box-shadow 0.16s ease, transform 0.16s ease, opacity 0.16s ease",
          animation: flash ? "nexaCardFlash 2s ease" : undefined,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          minHeight: mobile ? 88 : 0,
          touchAction: swipeEnabled ? "pan-y" : "manipulation",
        }}
      >
        {/* Hover quick-actions (desktop) */}
        {showActions && (
          <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 2, background: "var(--surface-raised)", border: `1px solid ${T.stone}`, borderRadius: 8, padding: 2, zIndex: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
            {onRename && <ActionBtn title="Editar título (e)" onClick={() => onEditingChange?.(true)}>✎</ActionBtn>}
            {onAddPersonClick && <ActionBtn title="Adicionar pessoa (m)" onClick={onAddPersonClick}>+</ActionBtn>}
            {!isDone && onComplete && <ActionBtn title="Concluir (c)" onClick={onComplete} accent>✓</ActionBtn>}
            {onArchive && <ActionBtn title="Arquivar" onClick={onArchive}>📥</ActionBtn>}
            {onMoveMenu && <ActionBtn title="Mover" onClick={onMoveMenu}>⋮</ActionBtn>}
          </div>
        )}

        {/* Linha 1 — título herói (InlineEdit) */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {overlay || !draggable ? (
              <div style={titleStyle}>{activity.title}</div>
            ) : (
              <InlineEdit
                value={activity.title}
                onSave={(v) => onRename?.(v)}
                editing={editing}
                onEditingChange={onEditingChange}
                ariaLabel="Título do cartão"
                textStyle={{ ...titleStyle, cursor: "text", borderBottom: "1px solid transparent", transition: "border-color 0.12s ease" }}
                inputStyle={{ ...titleStyle, width: "100%", boxSizing: "border-box", background: "var(--surface-raised)", border: `1px solid ${T.sprout}`, borderRadius: 6, padding: "4px 8px", outline: "none", textDecoration: "none" }}
              />
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
            {isDone && <span title="Concluída" style={{ color: T.sprout, fontSize: 14, fontWeight: 700 }}>✓</span>}
            {/* Mover — discreto no canto, mesmo padrão p/ todos os cards (≥44px de toque) */}
            {mobile && !overlay && draggable && onMoveMenu && (
              <button
                type="button"
                title="Mover"
                aria-label="Mover para outra coluna"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onMoveMenu(); }}
                style={{ width: 44, height: 44, margin: "-10px -8px -10px 0", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: T.fog, fontSize: 18, lineHeight: 1, cursor: "pointer" }}
              >
                ⋯
              </button>
            )}
          </div>
        </div>

        {/* Linha 2 — chip de tipo (toque troca categoria) + hora */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onPointerDown={chipClickable ? (e) => e.stopPropagation() : undefined}
            onClick={chipClickable ? (e) => { e.stopPropagation(); onChipClick?.(); } : undefined}
            title={chipClickable ? "Mudar tipo" : undefined}
            aria-label={chipClickable ? `Tipo: ${typeLabel} — tocar para mudar` : undefined}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 9px",
              minHeight: chipClickable && mobile ? 32 : undefined,
              borderRadius: 6,
              fontSize: 9,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              fontFamily: MONO,
              background: typeColor + "18",
              color: typeColor,
              border: chipClickable ? `1px solid ${typeColor}33` : "none",
              cursor: chipClickable ? "pointer" : "default",
              maxWidth: "70%",
            }}
          >
            {iconName && <KindIcon name={iconName} size={12} color={typeColor} sw={1.8} />}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{typeLabel}</span>
          </button>
          <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 10, fontWeight: 600, color: overdue ? T.red : T.bone, whiteSpace: "nowrap" }}>
            {dayLabel}{time ? ` · ${time}` : ""}{overdue ? " · atrasada" : ""}
          </span>
        </div>

        {/* Vínculo + dot de temperatura (só com negociação vinculada) */}
        {(bond || tempColor) && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            {tempColor && <span title="Temperatura da negociação" style={{ width: 8, height: 8, borderRadius: "50%", background: tempColor, flexShrink: 0 }} />}
            {bond && <span style={{ fontFamily: MONO, fontSize: 10, color: T.fog, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bond}</span>}
          </div>
        )}

        {/* Avatares + checklist — discretos, na mesma linha */}
        {(teamParticipants.length > 0 || owner !== "—" || checklist.length > 0) && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 }}>
            <AvatarRow owner={owner} participants={teamParticipants.map((p) => p.participant_name)} />
            {checklist.length > 0 && (
              <span title="Checklist" style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, color: checklistDone === checklist.length ? T.sprout : T.fog, flexShrink: 0 }}>
                ✓ {checklistDone}/{checklist.length}
              </span>
            )}
          </div>
        )}

        {/* Ação principal mobile — coerente por status: ativo = Concluir; concluído = Reabrir discreto */}
        {mobile && !overlay && draggable && !isDone && quickComplete && (
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); quickComplete(); }}
              style={{ width: "100%", minHeight: 44, borderRadius: 8, border: `1px solid ${T.sprout}55`, background: "rgba(74,222,128,0.08)", color: T.sprout, fontFamily: MONO, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Concluir
            </button>
          </div>
        )}
        {mobile && !overlay && draggable && isDone && onReopen && (
          <div style={{ marginTop: 6 }}>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onReopen(); }}
              style={{ minHeight: 44, padding: "0 4px", background: "transparent", border: "none", color: T.fog, fontFamily: MONO, fontSize: 11, fontWeight: 600, cursor: "pointer" }}
            >
              Reabrir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function QuickChip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, color: T.sprout, background: "rgba(74,222,128,0.12)", border: `1px solid ${T.sprout}30`, borderRadius: 12, padding: "2px 8px" }}>
      {children}
    </span>
  );
}

function ActionBtn({ title, onClick, accent, children }: { title: string; onClick: () => void; accent?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        width: 24,
        height: 24,
        borderRadius: 6,
        border: "none",
        background: "transparent",
        color: accent ? T.sprout : T.bone,
        fontSize: 12,
        cursor: "pointer",
        lineHeight: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 0.12s ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(112,107,95,0.18)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {children}
    </button>
  );
}

// Linha de avatares do card: dono + participantes da equipe, sobrepostos com
// anel, máx. 3 + pílula "+N". Cores calmas por nome (ParticipantAvatar).
function AvatarRow({ owner, participants }: { owner: string; participants: string[] }) {
  const people = [owner, ...participants].filter(Boolean);
  if (people.length === 0) return null;
  const shown = people.slice(0, 3);
  const extra = people.length - shown.length;
  return (
    <div style={{ display: "flex", alignItems: "center", marginTop: 8 }}>
      {shown.map((name, i) => (
        <span key={i} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: shown.length - i }}>
          <ParticipantAvatar name={name} size={28} />
        </span>
      ))}
      {extra > 0 && (
        <span style={{ marginLeft: -8 }}>
          <MoreAvatar count={extra} size={28} />
        </span>
      )}
    </div>
  );
}

function SuggestionCard({ suggestion, onClick }: { suggestion: KanbanSuggestion; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      style={{
        background: "transparent",
        border: `1px dashed ${T.orange}`,
        borderRadius: 10,
        padding: 10,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span
        style={{
          alignSelf: "flex-start",
          padding: "2px 8px",
          borderRadius: 4,
          fontSize: 9,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontFamily: MONO,
          background: "rgba(249,115,22,0.12)",
          color: T.orange,
        }}
      >
        Follow-up sugerido
      </span>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.chalk }}>{suggestion.clientName}</div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: T.fog }}>
        Q{suggestion.quadra} · L{suggestion.lote}
        {suggestion.dias ? ` · ${suggestion.dias} dias sem ação` : ""}
      </div>
    </div>
  );
}

function MoveMenu({
  activity,
  columns,
  onClose,
  onSelect,
}: {
  activity: KanbanActivity;
  columns: BoardColumnVM[];
  onClose: () => void;
  onSelect: (colId: string) => void;
}) {
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9500 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          background: T.ink,
          borderTop: `1px solid ${T.stone}`,
          borderRadius: "16px 16px 0 0",
          padding: 20,
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 13, color: T.fog, fontFamily: MONO, textAlign: "center", marginBottom: 4 }}>
          Mover "{activity.title}" para…
        </div>
        {columns.map((c) => {
          const isCurrent = activity.column_id === c.id;
          return (
            <button
              key={c.id}
              type="button"
              disabled={isCurrent}
              onClick={() => onSelect(c.id)}
              style={{
                minHeight: 48,
                padding: "12px 16px",
                borderRadius: 10,
                border: `1px solid ${isCurrent ? T.sprout : T.stone}`,
                background: isCurrent ? "rgba(74,222,128,0.1)" : "var(--surface-raised)",
                color: isCurrent ? T.slate : T.chalk,
                fontSize: 14,
                fontWeight: 600,
                cursor: isCurrent ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                textAlign: "left",
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.color }} />
              {c.name}
              {c.completes_activity && <span style={{ color: T.sprout, fontSize: 11 }}>✓</span>}
              {isCurrent && <span style={{ marginLeft: "auto", fontSize: 11, color: T.fog }}>atual</span>}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onClose}
          style={{
            minHeight: 44,
            padding: "10px 16px",
            borderRadius: 10,
            border: "none",
            background: "transparent",
            color: T.fog,
            fontSize: 13,
            cursor: "pointer",
            marginTop: 4,
          }}
        >
          Cancelar
        </button>
      </div>
    </div>,
    document.body,
  );
}
