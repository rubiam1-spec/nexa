import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { ACTIVITY_COLORS } from "../../../shared/utils/activityColors";
import { useIsMobile } from "../../../shared/hooks/useIsMobile";
import ParticipantAvatar from "./ParticipantAvatar";

interface Activity {
  id: string;
  type: string;
  title: string;
  status?: string | null;
  activity_date: string;
  start_time: string | null;
  duration_minutes: number;
  contact_name: string | null;
  clients?: { name: string } | null;
  activity_kinds?: { label?: string | null } | null;
  activity_participants?: { participant_name: string; participant_type: string }[] | null;
}

interface Aniversariante {
  id: string;
  name: string;
  tipo: string;
  mes_aniversario: number;
  dia_aniversario: number;
  phone?: string | null;
}

interface WeeklyCalendarProps {
  activities: Activity[];
  accountId: string | null;
  onSlotClick?: (date: string, time: string) => void;
  onEventClick?: (activityId: string) => void;
  onReschedule?: (id: string, schedule: { activity_date: string; start_time: string }) => void | Promise<boolean>;
}

const MONO = "var(--font-mono)";
const DAY_NAMES = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MONTH_ABBR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const PX_PER_HOUR = 48;

const TYPE_LABELS: Record<string, string> = {
  visit_broker: "Visita corretor", visit_client: "Visita cliente", visit_development: "Visita empreend.",
  phone_call: "Ligação", follow_up: "Follow-up", meeting_internal: "Reunião interna",
  meeting_external: "Reunião externa", training: "Treinamento", operational: "Operacional", other: "Outro",
};

function pad(n: number) { return String(n).padStart(2, "0"); }
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function localDate(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}
function formatWeekRange(start: Date, end: Date): string {
  if (start.getMonth() === end.getMonth()) return `${start.getDate()} – ${end.getDate()} ${MONTH_ABBR[start.getMonth()]} ${start.getFullYear()}`;
  return `${start.getDate()} ${MONTH_ABBR[start.getMonth()]} – ${end.getDate()} ${MONTH_ABBR[end.getMonth()]} ${end.getFullYear()}`;
}

interface PositionedEvent { activity: Activity; top: number; height: number; column: number; totalColumns: number; hidden?: boolean; extraCount?: number; }

function layoutEvents(events: Activity[], startHour: number, endHour: number): PositionedEvent[] {
  const valid = events.filter((e) => e.start_time);
  const positioned: PositionedEvent[] = valid.map((activity) => {
    const [h, m] = (activity.start_time || "08:00").split(":");
    const startH = parseInt(h) || 0, startM = parseInt(m) || 0;
    const top = (startH - startHour) * PX_PER_HOUR + startM * (PX_PER_HOUR / 60);
    const duration = activity.duration_minutes || 60;
    const height = Math.max((duration / 60) * PX_PER_HOUR, 30);
    return { activity, top, height, column: 0, totalColumns: 1, _h: startH } as PositionedEvent & { _h: number };
  }).filter((p) => (p as unknown as { _h: number })._h >= startHour && (p as unknown as { _h: number })._h <= endHour);
  positioned.sort((a, b) => a.top - b.top || a.height - b.height);

  const groups: PositionedEvent[][] = [];
  let current: PositionedEvent[] = [];
  let groupEnd = -Infinity;
  for (const pe of positioned) {
    if (current.length && pe.top < groupEnd) { current.push(pe); groupEnd = Math.max(groupEnd, pe.top + pe.height); }
    else { if (current.length) groups.push(current); current = [pe]; groupEnd = pe.top + pe.height; }
  }
  if (current.length) groups.push(current);

  for (const group of groups) {
    const columns: PositionedEvent[][] = [];
    for (const pe of group) {
      let placed = false;
      for (let c = 0; c < columns.length; c++) {
        const last = columns[c][columns[c].length - 1];
        if (pe.top >= last.top + last.height) { columns[c].push(pe); pe.column = c; placed = true; break; }
      }
      if (!placed) { pe.column = columns.length; columns.push([pe]); }
    }
    const total = columns.length;
    if (total <= 3) { for (const pe of group) pe.totalColumns = total; }
    else {
      for (const pe of group) { if (pe.column >= 3) pe.hidden = true; else pe.totalColumns = 3; }
      const hiddenEvents = group.filter((pe) => pe.hidden);
      for (const pe of group) {
        if (pe.column === 2 && !pe.hidden) {
          const overlapping = hiddenEvents.filter((h) => pe.top < h.top + h.height && pe.top + pe.height > h.top).length;
          if (overlapping > 0) pe.extraCount = overlapping;
        }
      }
    }
  }
  return positioned;
}

// ── Mini Calendar ──
function MiniCalendar({ currentMonth, selectedRange, onSelectDate, monthBirthdays }: { currentMonth: Date; selectedRange: Date[]; onSelectDate: (date: Date) => void; monthBirthdays: number[] }) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#E8E5DE", textTransform: "capitalize", marginBottom: 10 }}>{MONTH_NAMES[month]} {year}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, textAlign: "center" }}>
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => <span key={i} style={{ fontFamily: MONO, fontSize: 8, color: "#3D3A30", padding: 2 }}>{d}</span>)}
        {Array.from({ length: firstDay }, (_, i) => <span key={`e-${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const dayNum = i + 1;
          const isToday = dayNum === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const hasBirthday = monthBirthdays.includes(dayNum);
          const inRange = selectedRange.some((d) => d.getDate() === dayNum && d.getMonth() === month && d.getFullYear() === year);
          return (
            <div key={dayNum} onClick={() => onSelectDate(new Date(year, month, dayNum))} style={{ fontSize: 9, cursor: "pointer", color: isToday ? "#0B0A08" : inRange ? "#E8E5DE" : "#706B5F", background: isToday ? "#4ADE80" : inRange ? "rgba(74,222,128,0.08)" : "transparent", borderRadius: isToday ? "50%" : 3, fontWeight: isToday ? 700 : 400, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", position: "relative" }}>
              {dayNum}
              {hasBirthday && !isToday && <div style={{ position: "absolute", bottom: 1, left: "50%", transform: "translateX(-50%)", width: 3, height: 3, borderRadius: "50%", background: "#A78BFA" }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function WeeklyCalendar({ activities, accountId, onSlotClick, onEventClick, onReschedule }: WeeklyCalendarProps) {
  const mobile = useIsMobile();
  const [view, setView] = useState<"week" | "day">(mobile ? "day" : "week");
  useEffect(() => { if (mobile) setView("day"); }, [mobile]);
  const [anchor, setAnchor] = useState(() => new Date());
  const [aniversariantes, setAniversariantes] = useState<Aniversariante[]>([]);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [showExtra, setShowExtra] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const scrollRef = useRef<HTMLDivElement>(null);
  const didAutoScroll = useRef(false);

  const startHour = showExtra ? 0 : 7;
  const endHour = showExtra ? 23 : 20;
  const hours = useMemo(() => Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i), [startHour, endHour]);

  const weekStart = useMemo(() => getWeekStart(anchor), [anchor]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; }), [weekStart]);
  const days = view === "day" ? [new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())] : weekDays;

  // Tick "now" line a cada minuto.
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(id); }, []);

  // Auto-scroll pro horário atual ao abrir.
  useEffect(() => {
    if (didAutoScroll.current || !scrollRef.current) return;
    const target = (new Date().getHours() - startHour) * PX_PER_HOUR - 80;
    scrollRef.current.scrollTop = Math.max(0, target);
    didAutoScroll.current = true;
  }, [startHour]);

  // Aniversariantes do mês.
  useEffect(() => {
    if (!supabase || !accountId) return;
    const month = anchor.getMonth() + 1;
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase!.from("vw_aniversariantes").select("*").eq("account_id", accountId).eq("mes_aniversario", month).order("dia_aniversario");
        if (mounted) setAniversariantes((data ?? []) as Aniversariante[]);
      } catch { /* view pode não existir */ }
    })();
    return () => { mounted = false; };
  }, [anchor, accountId]);

  const monthBirthdays = useMemo(() => aniversariantes.map((a) => a.dia_aniversario), [aniversariantes]);
  const rangeBirthdays = useMemo(() => aniversariantes.filter((a) => days.some((d) => d.getDate() === a.dia_aniversario && d.getMonth() + 1 === a.mes_aniversario)), [aniversariantes, days]);

  // Tipos presentes (para o filtro/legenda).
  const presentTypes = useMemo(() => {
    const set = new Set<string>();
    for (const a of activities) set.add(a.type);
    return Array.from(set);
  }, [activities]);

  const visibleActivities = useMemo(() => {
    const ds = days.map((d) => localDate(d));
    return activities.filter((a) => ds.includes(a.activity_date) && (typeFilter.size === 0 || typeFilter.has(a.type)));
  }, [activities, days, typeFilter]);

  const go = (deltaDays: number) => { const d = new Date(anchor); d.setDate(d.getDate() + deltaDays); setAnchor(d); };
  const goToday = () => setAnchor(new Date());
  const toggleType = (t: string) => setTypeFilter((prev) => { const n = new Set(prev); if (n.has(t)) n.delete(t); else n.add(t); return n; });

  const C = { line: "rgba(61,58,48,0.12)", fog: "#706B5F", bone: "#C4BFB3", chalk: "#E8E5DE", sprout: "#4ADE80", red: "#F87171", ink: "#16150F" };
  const gridTemplate = `52px repeat(${days.length}, minmax(0, 1fr))`;

  function handleDrop(e: React.DragEvent, day: Date) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id || !onReschedule) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    let mins = startHour * 60 + Math.round(((y / PX_PER_HOUR) * 60) / 15) * 15;
    mins = Math.max(startHour * 60, Math.min(endHour * 60 + 45, mins));
    void onReschedule(id, { activity_date: localDate(day), start_time: `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}` });
  }

  return (
    <div style={{ display: "flex", height: "calc(100vh - 220px)", minHeight: 540, background: "linear-gradient(168deg, rgba(34,33,28,0.3), rgba(18,17,14,0.1))", borderRadius: 12, border: "1px solid rgba(61,58,48,0.08)", overflow: "hidden" }}>
      {/* ═══ RAIL (colapsável) ═══ */}
      {!railCollapsed && !mobile && (
        <div style={{ width: 210, flexShrink: 0, padding: 16, background: "rgba(11,10,8,0.4)", borderRight: `1px solid ${C.line}`, overflowY: "auto" }}>
          <MiniCalendar currentMonth={anchor} selectedRange={days} onSelectDate={(d) => setAnchor(d)} monthBirthdays={monthBirthdays} />
          <div style={{ marginTop: 20 }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.fog, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>Tipos</div>
            {presentTypes.map((t) => {
              const col = (ACTIVITY_COLORS[t] || ACTIVITY_COLORS.other).color;
              const active = typeFilter.size === 0 || typeFilter.has(t);
              return (
                <button key={t} type="button" onClick={() => toggleType(t)} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, width: "100%", padding: "4px 6px", borderRadius: 6, border: "none", background: typeFilter.has(t) ? "rgba(74,222,128,0.08)" : "transparent", cursor: "pointer", opacity: active ? 1 : 0.4, textAlign: "left" }}>
                  <div style={{ width: 9, height: 9, borderRadius: 2, background: col, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: C.bone }}>{TYPE_LABELS[t] || t}</span>
                </button>
              );
            })}
            {typeFilter.size > 0 && <button type="button" onClick={() => setTypeFilter(new Set())} style={{ marginTop: 4, background: "none", border: "none", color: C.fog, fontSize: 10, fontFamily: MONO, cursor: "pointer" }}>limpar filtro</button>}
          </div>
          {rangeBirthdays.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: C.fog, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>Aniversariantes</div>
              {rangeBirthdays.map((b) => (
                <div key={`${b.id}-${b.tipo}`} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: C.bone, marginBottom: 4 }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: "#D97706", minWidth: 20 }}>{pad(b.dia_aniversario)}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ MAIN ═══ */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: `1px solid ${C.line}`, flexShrink: 0, flexWrap: "wrap" }}>
          {!mobile && <button type="button" onClick={() => setRailCollapsed((v) => !v)} title="Recolher painel" style={{ background: "none", border: `1px solid ${C.line}`, borderRadius: 6, padding: "4px 9px", color: C.fog, cursor: "pointer", fontSize: 13 }}>{railCollapsed ? "»" : "«"}</button>}
          <button type="button" onClick={() => go(view === "day" ? -1 : -7)} style={{ background: "none", border: `1px solid ${C.line}`, borderRadius: 6, padding: "4px 10px", color: C.fog, cursor: "pointer", fontSize: 12 }}>‹</button>
          <button type="button" onClick={goToday} style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 6, padding: "4px 12px", color: C.sprout, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Hoje</button>
          <button type="button" onClick={() => go(view === "day" ? 1 : 7)} style={{ background: "none", border: `1px solid ${C.line}`, borderRadius: 6, padding: "4px 10px", color: C.fog, cursor: "pointer", fontSize: 12 }}>›</button>
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.chalk, fontWeight: 600, marginLeft: 6 }}>{view === "day" ? `${days[0].getDate()} ${MONTH_ABBR[days[0].getMonth()]} ${days[0].getFullYear()}` : formatWeekRange(weekDays[0], weekDays[6])}</span>
          <div style={{ flex: 1 }} />
          {!mobile && (
            <div style={{ display: "flex", gap: 0, border: `1px solid ${C.line}`, borderRadius: 6, overflow: "hidden" }}>
              {(["week", "day"] as const).map((v) => (
                <button key={v} type="button" onClick={() => setView(v)} style={{ padding: "5px 12px", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", color: view === v ? C.sprout : C.fog, background: view === v ? "rgba(74,222,128,0.08)" : "transparent" }}>{v === "week" ? "Semana" : "Dia"}</button>
              ))}
            </div>
          )}
          <button type="button" onClick={() => setShowExtra((v) => !v)} style={{ background: "none", border: `1px solid ${C.line}`, borderRadius: 6, padding: "5px 10px", color: C.fog, cursor: "pointer", fontSize: 10, fontFamily: MONO }}>{showExtra ? "07–20h" : "00–23h"}</button>
        </div>

        {/* Day headers */}
        <div style={{ display: "grid", gridTemplateColumns: gridTemplate, borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
          <div />
          {days.map((day, i) => {
            const isToday = isSameDay(day, new Date());
            const dayName = view === "day" ? DAY_NAMES[(day.getDay() + 6) % 7] : DAY_NAMES[i];
            const count = visibleActivities.filter((a) => a.activity_date === localDate(day)).length;
            return (
              <div key={i} style={{ padding: "8px 4px", textAlign: "center", borderLeft: `1px solid ${C.line}`, background: isToday ? "rgba(74,222,128,0.04)" : "transparent" }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: isToday ? C.sprout : C.fog, letterSpacing: "0.1em", fontWeight: 600 }}>{dayName}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 3 }}>
                  <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: isToday ? 700 : 500, color: isToday ? "#0B0A08" : C.bone, background: isToday ? C.sprout : "transparent", borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>{day.getDate()}</div>
                  {count > 0 && <span style={{ fontFamily: MONO, fontSize: 9, color: C.fog, background: "rgba(42,40,34,0.5)", padding: "1px 6px", borderRadius: 8 }}>{count}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* All-day birthdays */}
        {rangeBirthdays.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: gridTemplate, borderBottom: `1px solid ${C.line}`, background: "rgba(255,183,77,0.02)", flexShrink: 0 }}>
            <div style={{ fontSize: 11, display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "3px 6px 3px 0" }}>🎂</div>
            {days.map((day, i) => {
              const dayB = rangeBirthdays.filter((b) => b.dia_aniversario === day.getDate() && b.mes_aniversario === day.getMonth() + 1);
              return (
                <div key={i} style={{ padding: "3px", minHeight: 20, borderLeft: `1px solid ${C.line}` }}>
                  {dayB.map((b) => {
                    const firstName = b.name.split(" ")[0];
                    const phoneClean = b.phone?.replace(/\D/g, "") || "";
                    const waLink = phoneClean ? `https://wa.me/55${phoneClean}?text=${encodeURIComponent(`Feliz aniversário, ${firstName}! 🎂`)}` : null;
                    return (
                      <div key={`${b.id}-${b.tipo}`} title={b.name} onClick={(e) => { e.stopPropagation(); if (waLink) window.open(waLink, "_blank"); }} style={{ background: "rgba(255,183,77,0.12)", borderLeft: "2px solid #FFB74D", borderRadius: 3, padding: "2px 6px", marginBottom: 2, fontSize: 10, fontWeight: 600, color: "#FFB74D", cursor: waLink ? "pointer" : "default", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🎂 {firstName}</div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Scrollable grid */}
        <div ref={scrollRef} style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: gridTemplate, position: "relative" }}>
            {/* Hours column */}
            <div>
              {hours.map((hour) => (
                <div key={hour} style={{ height: PX_PER_HOUR, display: "flex", alignItems: "flex-start", justifyContent: "flex-end", padding: "2px 8px 0 0", borderTop: `1px solid ${C.line}` }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: C.fog }}>{pad(hour)}h</span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day, dayIdx) => {
              const dayStr = localDate(day);
              const dayActs = visibleActivities.filter((a) => a.activity_date === dayStr);
              const isToday = isSameDay(day, new Date());
              const nowTop = (now.getHours() - startHour) * PX_PER_HOUR + now.getMinutes() * (PX_PER_HOUR / 60);
              const showNow = isToday && now.getHours() >= startHour && now.getHours() <= endHour;
              return (
                <div key={dayIdx}
                  onDragOver={(e) => { if (onReschedule) e.preventDefault(); }}
                  onDrop={(e) => handleDrop(e, day)}
                  style={{ position: "relative", borderLeft: `1px solid ${C.line}`, background: isToday ? "rgba(74,222,128,0.02)" : "transparent" }}
                >
                  {hours.map((hour) => (
                    <div key={hour} onClick={() => onSlotClick && onSlotClick(dayStr, `${pad(hour)}:00`)} style={{ height: PX_PER_HOUR, borderTop: `1px solid ${C.line}`, cursor: onSlotClick ? "pointer" : "default", transition: "background 100ms" }}
                      onMouseEnter={(e) => { if (onSlotClick) (e.currentTarget as HTMLDivElement).style.background = "rgba(74,222,128,0.03)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                    />
                  ))}

                  {/* NOW line */}
                  {showNow && (
                    <div style={{ position: "absolute", left: 0, right: 0, top: nowTop, height: 0, borderTop: `2px solid ${C.red}`, zIndex: 6, pointerEvents: "none" }}>
                      <div style={{ position: "absolute", left: -3, top: -4, width: 7, height: 7, borderRadius: "50%", background: C.red }} />
                    </div>
                  )}

                  {/* Events */}
                  {layoutEvents(dayActs, startHour, endHour).filter((pe) => !pe.hidden).map((pe) => {
                    const a = pe.activity;
                    const colors = ACTIVITY_COLORS[a.type] || ACTIVITY_COLORS.other;
                    const widthPct = 100 / pe.totalColumns;
                    const leftPct = pe.column * widthPct;
                    const completed = a.status === "completed";
                    const overdue = a.status === "scheduled" && (() => { const dt = new Date(`${a.activity_date}T${(a.start_time || "23:59")}:00`); return dt.getTime() < Date.now(); })();
                    const team = (a.activity_participants ?? []).filter((p) => p.participant_type === "user");
                    const compact = pe.height < 44 || pe.totalColumns > 1;
                    return (
                      <div key={a.id} draggable={!!onReschedule}
                        onDragStart={(e) => { e.dataTransfer.setData("text/plain", a.id); e.dataTransfer.effectAllowed = "move"; }}
                        onClick={(e) => { e.stopPropagation(); onEventClick && onEventClick(a.id); }}
                        title={`${a.title}\n${a.start_time?.slice(0, 5) ?? ""}${a.duration_minutes ? ` · ${a.duration_minutes}min` : ""}`}
                        onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.12)"; e.currentTarget.style.zIndex = "5"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; e.currentTarget.style.zIndex = "2"; }}
                        style={{
                          position: "absolute", top: pe.top, left: `calc(${leftPct}% + 2px)`, width: `calc(${widthPct}% - 3px)`, height: pe.height,
                          background: completed ? "rgba(22,21,15,0.7)" : `linear-gradient(180deg, ${colors.bg}, rgba(22,21,15,0.85))`,
                          borderLeft: `3px solid ${overdue ? C.red : colors.color}`,
                          borderRadius: "2px 6px 6px 2px", padding: "3px 6px", overflow: "hidden", cursor: "grab", zIndex: 2,
                          opacity: completed ? 0.6 : 1, boxShadow: overdue ? `0 0 0 1px ${C.red}55` : "0 1px 3px rgba(0,0,0,0.25)",
                          transition: "filter 0.15s", display: "flex", flexDirection: "column", gap: 2,
                        }}>
                        <div style={{ fontSize: compact ? 10 : 11, fontWeight: 600, color: "#FAF9F6", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: completed ? "line-through" : "none" }}>
                          {completed && <span style={{ color: C.sprout, marginRight: 3 }}>✓</span>}{a.title || a.clients?.name || "Atividade"}
                        </div>
                        <div style={{ fontFamily: MONO, fontSize: 9, color: colors.color, fontWeight: 600 }}>{a.start_time?.slice(0, 5)}</div>
                        {!compact && team.length > 0 && (
                          <div style={{ display: "flex", marginTop: "auto" }}>
                            {team.slice(0, 3).map((p, i) => <span key={i} style={{ marginLeft: i === 0 ? 0 : -7 }}><ParticipantAvatar name={p.participant_name} size={18} ring="#16150F" /></span>)}
                            {team.length > 3 && <span style={{ marginLeft: 3, fontFamily: MONO, fontSize: 9, color: C.fog, alignSelf: "center" }}>+{team.length - 3}</span>}
                          </div>
                        )}
                        {pe.extraCount ? <div style={{ position: "absolute", bottom: 2, right: 4, fontFamily: MONO, fontSize: 8, background: "rgba(74,222,128,0.15)", color: C.sprout, padding: "1px 4px", borderRadius: 3, fontWeight: 700 }}>+{pe.extraCount}</div> : null}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
