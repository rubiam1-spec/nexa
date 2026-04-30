import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { ACTIVITY_COLORS } from "../../../shared/utils/activityColors";

interface Activity {
  id: string;
  type: string;
  title: string;
  activity_date: string;
  start_time: string | null;
  duration_minutes: number;
  contact_name: string | null;
  clients?: { name: string } | null;
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
}

const MONO = "var(--font-mono)";
const DAY_NAMES = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MONTH_ABBR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

interface PositionedEvent {
  activity: Activity;
  top: number;
  height: number;
  column: number;
  totalColumns: number;
  hidden?: boolean;
  extraCount?: number;
}

function layoutOverlappingEvents(events: Activity[], pxPerHour: number, dayStartHour: number, dayEndHour: number): PositionedEvent[] {
  const valid = events.filter((e) => e.start_time);
  if (!valid.length) return [];

  const positioned: PositionedEvent[] = valid.map((activity) => {
    const [hStr, mStr] = (activity.start_time || "08:00").split(":");
    const startHour = parseInt(hStr) || 0;
    const startMin = parseInt(mStr) || 0;
    const top = (startHour - dayStartHour) * pxPerHour + startMin * (pxPerHour / 60);
    const duration = activity.duration_minutes || 60;
    const height = Math.max((duration / 60) * pxPerHour, 32);
    return { activity, top, height, column: 0, totalColumns: 1, _startHour: startHour } as PositionedEvent & { _startHour: number };
  }).filter((p) => (p as unknown as { _startHour: number })._startHour >= dayStartHour && (p as unknown as { _startHour: number })._startHour <= dayEndHour);

  positioned.sort((a, b) => a.top - b.top || a.height - b.height);

  // Phase 1: group events that chain-overlap (any event extends the group's active range).
  const groups: PositionedEvent[][] = [];
  let current: PositionedEvent[] = [];
  let groupEnd = -Infinity;
  for (const pe of positioned) {
    if (current.length && pe.top < groupEnd) {
      current.push(pe);
      groupEnd = Math.max(groupEnd, pe.top + pe.height);
    } else {
      if (current.length) groups.push(current);
      current = [pe];
      groupEnd = pe.top + pe.height;
    }
  }
  if (current.length) groups.push(current);

  // Phase 2: assign columns within each group; reuse a column when the last event in it has ended.
  for (const group of groups) {
    const columns: PositionedEvent[][] = [];
    for (const pe of group) {
      let placed = false;
      for (let c = 0; c < columns.length; c++) {
        const last = columns[c][columns[c].length - 1];
        if (pe.top >= last.top + last.height) {
          columns[c].push(pe);
          pe.column = c;
          placed = true;
          break;
        }
      }
      if (!placed) {
        pe.column = columns.length;
        columns.push([pe]);
      }
    }
    const total = columns.length;
    if (total <= 2) {
      for (const pe of group) pe.totalColumns = total;
    } else {
      for (const pe of group) {
        if (pe.column >= 2) pe.hidden = true;
        else pe.totalColumns = 2;
      }
      const hiddenEvents = group.filter((pe) => pe.hidden);
      for (const pe of group) {
        if (pe.column === 1 && !pe.hidden) {
          const overlapping = hiddenEvents.filter(
            (h) => pe.top < h.top + h.height && pe.top + pe.height > h.top
          ).length;
          if (overlapping > 0) pe.extraCount = overlapping;
        }
      }
    }
  }
  return positioned;
}

function formatWeekRange(start: Date, end: Date): string {
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} – ${end.getDate()} ${MONTH_ABBR[start.getMonth()]} ${start.getFullYear()}`;
  }
  return `${start.getDate()} ${MONTH_ABBR[start.getMonth()]} – ${end.getDate()} ${MONTH_ABBR[end.getMonth()]} ${end.getFullYear()}`;
}

function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

// ── Mini Calendar ──
function MiniCalendar({ currentMonth, selectedWeek, onSelectDate, monthBirthdays }: {
  currentMonth: Date;
  selectedWeek: Date[];
  onSelectDate: (date: Date) => void;
  monthBirthdays: number[];
}) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#E8E5DE", textTransform: "capitalize" }}>
          {MONTH_NAMES[month]} {year}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, textAlign: "center" }}>
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
          <span key={i} style={{ fontFamily: MONO, fontSize: 7, color: "#3D3A30", padding: 2 }}>{d}</span>
        ))}
        {Array.from({ length: firstDay }, (_, i) => <span key={`empty-${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const dayNum = i + 1;
          const isToday = dayNum === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const hasBirthday = monthBirthdays.includes(dayNum);
          const isInSelectedWeek = selectedWeek.some((d) => d.getDate() === dayNum && d.getMonth() === month && d.getFullYear() === year);
          return (
            <div key={dayNum} onClick={() => onSelectDate(new Date(year, month, dayNum))} style={{
              fontSize: 8.5, padding: 3, cursor: "pointer",
              color: isToday ? "#0B0A08" : isInSelectedWeek ? "#E8E5DE" : "#706B5F",
              background: isToday ? "#4ADE80" : isInSelectedWeek ? "rgba(74,222,128,0.08)" : "transparent",
              borderRadius: isToday ? "50%" : 3,
              fontWeight: isToday ? 700 : 400,
              width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto", position: "relative",
            }}>
              {dayNum}
              {hasBirthday && !isToday && (
                <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 3, height: 3, borderRadius: "50%", background: "#A78BFA" }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Month Picker ──
function MonthPicker({ year, month, onChange }: { year: number; month: number; onChange: (y: number, m: number) => void }) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(year);
  const wrapRef = useRef<HTMLDivElement>(null);
  const today = new Date();

  useEffect(() => { setViewYear(year); }, [year, open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{
        padding: "5px 24px 5px 10px", borderRadius: 6,
        background: "rgba(22,21,15,0.9)", border: "1px solid rgba(42,40,34,0.5)",
        color: "#C4BFB3", fontFamily: MONO, fontSize: 10, cursor: "pointer",
        position: "relative",
      }}>
        {MONTH_ABBR[month]} {year}
        <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#9C9686", fontSize: 8 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "100%", right: 0, marginTop: 4,
          background: "#1C1B18", border: "1px solid rgba(42,40,34,0.6)",
          borderRadius: 10, padding: 12, zIndex: 9999, width: 220,
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button type="button" onClick={() => setViewYear((y) => y - 1)} style={{ background: "none", border: "1px solid rgba(42,40,34,0.5)", borderRadius: 4, padding: "2px 8px", color: "#9C9686", cursor: "pointer", fontFamily: MONO, fontSize: 11 }}>‹</button>
            <span style={{ fontFamily: MONO, fontSize: 12, color: "#E8E5DE", fontWeight: 600 }}>{viewYear}</span>
            <button type="button" onClick={() => setViewYear((y) => y + 1)} style={{ background: "none", border: "1px solid rgba(42,40,34,0.5)", borderRadius: 4, padding: "2px 8px", color: "#9C9686", cursor: "pointer", fontFamily: MONO, fontSize: 11 }}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
            {MONTH_ABBR.map((m, i) => {
              const isCurrent = i === today.getMonth() && viewYear === today.getFullYear();
              const isSelected = i === month && viewYear === year;
              return (
                <button key={i} type="button"
                  onClick={() => { onChange(viewYear, i); setOpen(false); }}
                  onMouseEnter={(e) => { if (!isSelected && !isCurrent) (e.currentTarget as HTMLButtonElement).style.background = "rgba(42,40,34,0.3)"; }}
                  onMouseLeave={(e) => { if (!isSelected && !isCurrent) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  style={{
                    padding: 8, borderRadius: 6, fontSize: 11, fontFamily: MONO,
                    cursor: "pointer",
                    color: isSelected || isCurrent ? "#4ADE80" : "#C4BFB3",
                    background: isSelected ? "rgba(74,222,128,0.18)" : isCurrent ? "rgba(74,222,128,0.08)" : "transparent",
                    border: isSelected ? "1px solid rgba(74,222,128,0.35)" : isCurrent ? "1px solid rgba(74,222,128,0.2)" : "1px solid transparent",
                    fontWeight: isSelected || isCurrent ? 600 : 500,
                    transition: "background 120ms",
                  }}>{m}</button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Calendar ──
export default function WeeklyCalendar({ activities, accountId, onSlotClick, onEventClick }: WeeklyCalendarProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));
  const [aniversariantes, setAniversariantes] = useState<Aniversariante[]>([]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    return d;
  }), [currentWeekStart]);

  const hours = Array.from({ length: 12 }, (_, i) => i + 8);

  // Fetch birthdays for current month
  useEffect(() => {
    if (!supabase || !accountId) return;
    const month = currentWeekStart.getMonth() + 1;
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase!.from("vw_aniversariantes").select("*").eq("account_id", accountId).eq("mes_aniversario", month).order("dia_aniversario");
        if (mounted) setAniversariantes((data ?? []) as Aniversariante[]);
      } catch { /* view may not exist */ }
    })();
    return () => { mounted = false; };
  }, [currentWeekStart, accountId]);

  const monthBirthdays = useMemo(() => aniversariantes.map((a) => a.dia_aniversario), [aniversariantes]);

  // Birthdays in current week
  const weekBirthdays = useMemo(() => {
    return aniversariantes.filter((a) => {
      return weekDays.some((d) => d.getDate() === a.dia_aniversario && d.getMonth() + 1 === a.mes_aniversario);
    });
  }, [aniversariantes, weekDays]);

  // Filter activities for the current week
  const weekActivities = useMemo(() => {
    const startStr = weekDays[0].toISOString().slice(0, 10);
    const endStr = weekDays[6].toISOString().slice(0, 10);
    return activities.filter((a) => a.activity_date >= startStr && a.activity_date <= endStr);
  }, [activities, weekDays]);

  const prevWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeekStart(prev);
  };
  const nextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + 7);
    setCurrentWeekStart(next);
  };
  const goToday = () => setCurrentWeekStart(getWeekStart(new Date()));
  const selectDate = (date: Date) => setCurrentWeekStart(getWeekStart(date));

  return (
    <div style={{ display: "flex", height: "calc(100vh - 240px)", minHeight: 520, background: "linear-gradient(168deg, rgba(34,33,28,0.3), rgba(18,17,14,0.1))", borderRadius: 12, border: "1px solid rgba(61,58,48,0.08)", overflow: "hidden" }}>
      {/* ═══ SIDEBAR ═══ */}
      <div style={{ width: 200, flexShrink: 0, padding: 16, background: "rgba(11,10,8,0.4)", borderRight: "1px solid rgba(61,58,48,0.1)", overflowY: "auto" }}>
        <MiniCalendar currentMonth={currentWeekStart} selectedWeek={weekDays} onSelectDate={selectDate} monthBirthdays={monthBirthdays} />

        {/* Legend */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: "#706B5F", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>
            TIPOS
          </div>
          {[
            { label: "Visita", color: "#4ADE80" },
            { label: "Reunião", color: "#60A5FA" },
            { label: "Follow-up", color: "#D97706" },
            { label: "Treinamento", color: "#A78BFA" },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "#9C9686" }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Week birthdays */}
        {weekBirthdays.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: "#706B5F", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>
              ANIVERSARIANTES
            </div>
            {weekBirthdays.map((b) => (
              <div key={`${b.id}-${b.tipo}`} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "#C4BFB3", marginBottom: 4, padding: "2px 0" }}>
                <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: "#D97706", minWidth: 20 }}>
                  {String(b.dia_aniversario).padStart(2, "0")}
                </span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ GRID ═══ */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {/* Nav header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "1px solid rgba(61,58,48,0.1)", position: "sticky", top: 0, zIndex: 10, background: "rgba(15,14,12,0.95)", backdropFilter: "blur(8px)" }}>
          <button type="button" onClick={prevWeek} style={{ background: "none", border: "1px solid rgba(61,58,48,0.2)", borderRadius: 6, padding: "4px 10px", color: "#706B5F", cursor: "pointer", fontSize: 12 }}>‹</button>
          <button type="button" onClick={goToday} style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 6, padding: "4px 12px", color: "#4ADE80", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Hoje</button>
          <button type="button" onClick={nextWeek} style={{ background: "none", border: "1px solid rgba(61,58,48,0.2)", borderRadius: 6, padding: "4px 10px", color: "#706B5F", cursor: "pointer", fontSize: 12 }}>›</button>
          <span style={{ fontFamily: MONO, fontSize: 11, color: "#E8E5DE", fontWeight: 600, marginLeft: 8 }}>
            {formatWeekRange(weekDays[0], weekDays[6])}
          </span>
          <div style={{ flex: 1 }} />
          <MonthPicker
            year={currentWeekStart.getFullYear()}
            month={currentWeekStart.getMonth()}
            onChange={(y, m) => setCurrentWeekStart(getWeekStart(new Date(y, m, 1)))}
          />
        </div>

        {/* Day headers */}
        <div style={{ display: "grid", gridTemplateColumns: "48px repeat(7, 1fr)", borderBottom: "1px solid rgba(61,58,48,0.1)", position: "sticky", top: 44, zIndex: 9, background: "rgba(15,14,12,0.95)" }}>
          <div />
          {weekDays.map((day, i) => {
            const isToday = isSameDay(day, new Date());
            return (
              <div key={i} style={{ padding: "10px 4px", textAlign: "center" }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: isToday ? "#4ADE80" : "#706B5F", letterSpacing: "0.1em", fontWeight: 600 }}>
                  {DAY_NAMES[i]}
                </div>
                <div style={{
                  fontFamily: MONO, fontSize: 13, fontWeight: isToday ? 700 : 500,
                  color: isToday ? "#0B0A08" : "#C4BFB3",
                  background: isToday ? "#4ADE80" : "transparent",
                  borderRadius: "50%", width: 28, height: 28,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "4px auto 0",
                }}>
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* All-day birthday row */}
        {weekBirthdays.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "48px repeat(7, 1fr)", borderBottom: "1px solid rgba(61,58,48,0.08)", background: "rgba(255,183,77,0.02)" }}>
            <div style={{ fontFamily: MONO, fontSize: 7, color: "#FFB74D", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "4px 6px 4px 0" }}>
              🎂
            </div>
            {weekDays.map((day, i) => {
              const dayBirthdays = weekBirthdays.filter((b) => b.dia_aniversario === day.getDate() && b.mes_aniversario === day.getMonth() + 1);
              return (
                <div key={i} style={{ padding: "4px 3px", minHeight: 22, borderLeft: "0.5px solid rgba(61,58,48,0.06)" }}>
                  {dayBirthdays.map((b) => {
                    const firstName = b.name.split(" ")[0];
                    const phoneClean = (b as unknown as { phone?: string }).phone?.replace(/\D/g, "") || "";
                    const waLink = phoneClean ? `https://wa.me/55${phoneClean}?text=${encodeURIComponent(`Feliz aniversário, ${firstName}! 🎂`)}` : null;
                    return (
                      <div key={`${b.id}-${b.tipo}`}
                        title={`${b.name} (${b.tipo === "client" ? "Cliente" : b.tipo === "broker" ? "Corretor" : "Equipe"})${phoneClean ? " — Clique para WhatsApp" : ""}`}
                        onClick={(e) => { e.stopPropagation(); if (waLink) window.open(waLink, "_blank"); }}
                        style={{
                          background: "rgba(255,183,77,0.12)",
                          borderLeft: "2px solid #FFB74D",
                          borderRadius: 3,
                          padding: "2px 5px",
                          marginBottom: 2,
                          fontSize: 8.5,
                          fontWeight: 600,
                          color: "#FFB74D",
                          cursor: waLink ? "pointer" : "default",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                        🎂 {firstName}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Hours + events grid */}
        <div style={{ display: "grid", gridTemplateColumns: "48px repeat(7, 1fr)", position: "relative" }}>
          {/* Hours column */}
          <div>
            {hours.map((hour) => (
              <div key={hour} style={{ height: 56, display: "flex", alignItems: "flex-start", justifyContent: "flex-end", padding: "4px 8px 0 0", borderTop: "1px solid rgba(42,40,34,0.15)" }}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: "#706B5F", letterSpacing: "0.02em" }}>
                  {String(hour).padStart(2, "0")}h
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, dayIdx) => {
            const dayStr = day.toISOString().slice(0, 10);
            const dayActivities = weekActivities.filter((a) => a.activity_date === dayStr);
            const isToday = isSameDay(day, new Date());
            return (
              <div key={dayIdx} style={{ position: "relative", borderLeft: "0.5px solid rgba(61,58,48,0.06)", background: isToday ? "rgba(74,222,128,0.015)" : "transparent" }}>
                {hours.map((hour) => (
                  <div key={hour}
                    onClick={() => onSlotClick && onSlotClick(dayStr, `${String(hour).padStart(2, "0")}:00`)}
                    style={{ height: 56, borderBottom: "0.5px solid rgba(61,58,48,0.06)", cursor: onSlotClick ? "pointer" : "default", transition: "background 100ms ease" }}
                    onMouseEnter={(e) => { if (onSlotClick) (e.currentTarget as HTMLDivElement).style.background = "rgba(74,222,128,0.03)"; }}
                    onMouseLeave={(e) => { if (onSlotClick) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                  />
                ))}
                {layoutOverlappingEvents(dayActivities, 56, 8, 19).filter((pe) => !pe.hidden).map((pe) => {
                  const activity = pe.activity;
                  const colors = ACTIVITY_COLORS[activity.type] || ACTIVITY_COLORS.other;
                  const widthPct = 100 / pe.totalColumns;
                  const leftPct = pe.column * widthPct;
                  const contactInfo = activity.contact_name ? ` · Com: ${activity.contact_name}` : activity.clients?.name ? ` · Cliente: ${activity.clients.name}` : "";
                  const tooltip = `${activity.title}\n${activity.start_time?.slice(0, 5)}${activity.duration_minutes ? ` (${activity.duration_minutes}min)` : ""}${contactInfo}`;
                  return (
                    <div key={activity.id} title={tooltip}
                      onClick={(e) => { e.stopPropagation(); onEventClick && onEventClick(activity.id); }}
                      onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.15)"; e.currentTarget.style.zIndex = "5"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; e.currentTarget.style.zIndex = "2"; }}
                      style={{
                      position: "absolute",
                      top: pe.top,
                      left: `calc(${leftPct}% + 2px)`,
                      width: `calc(${widthPct}% - 3px)`,
                      height: pe.height,
                      background: `linear-gradient(180deg, ${colors.bg}, rgba(22,21,15,0.85))`,
                      borderTop: "none", borderRight: "none", borderBottom: "none",
                      borderLeft: `3px solid ${colors.color}`,
                      borderRadius: "2px 6px 6px 2px",
                      padding: "4px 6px",
                      overflow: "hidden",
                      cursor: "pointer",
                      zIndex: 2,
                      transition: "filter 0.15s",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                    }}>
                      <div style={{ fontSize: pe.totalColumns > 1 ? 10 : 11, fontWeight: 600, color: "#FAF9F6", lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {activity.title || activity.contact_name || activity.clients?.name || "Atividade"}
                      </div>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: colors.color, opacity: 0.9, marginTop: 2, fontWeight: 600 }}>
                        {activity.start_time?.slice(0, 5)}
                      </div>
                      {pe.extraCount ? (
                        <div style={{
                          position: "absolute", bottom: 2, right: 4,
                          fontFamily: MONO, fontSize: 8,
                          background: "rgba(74,222,128,0.15)", color: "#4ADE80",
                          padding: "1px 4px", borderRadius: 3, fontWeight: 700,
                        }}>+{pe.extraCount}</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
