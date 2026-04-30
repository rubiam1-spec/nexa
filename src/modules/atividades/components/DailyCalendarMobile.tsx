import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ACTIVITY_COLORS } from "../../../shared/utils/activityColors";
import { formatWeekdayDateLongBRT, getTodayDateStringBRT, toDateStringBRT } from "../../../shared/utils/dateUtils";

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

interface DailyCalendarMobileProps {
  activities: Activity[];
  onSlotClick?: (date: string, time: string) => void;
  onEventClick?: (activityId: string) => void;
}

const MONO = "var(--font-mono)";
const TYPE_LABEL: Record<string, string> = {
  visit_client: "Visita",
  visit_broker: "Visita",
  visit_development: "Visita",
  meeting_external: "Reunião",
  meeting_internal: "Reunião",
  follow_up: "Follow-up",
  training: "Treinamento",
  phone_call: "Ligação",
  other: "Atividade",
};

const LEGEND = [
  { label: "Visita", color: ACTIVITY_COLORS.visit_client.color },
  { label: "Reunião", color: ACTIVITY_COLORS.meeting_external.color },
  { label: "Follow-up", color: ACTIVITY_COLORS.follow_up.color },
  { label: "Treinamento", color: ACTIVITY_COLORS.training.color },
] as const;

function addDaysBRT(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return toDateStringBRT(dt);
}

function minutesFromStart(time: string | null, startHour: number): number {
  if (!time) return 0;
  const [h, m] = time.split(":").map((v) => parseInt(v, 10) || 0);
  return (h - startHour) * 60 + m;
}

function formatActivityTime(time: string | null): string {
  if (!time) return "—";
  return time.slice(0, 5);
}

export default function DailyCalendarMobile({ activities, onSlotClick, onEventClick }: DailyCalendarMobileProps) {
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayDateStringBRT());
  const [showLegend, setShowLegend] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const dayStartHour = 8;
  const dayEndHour = 20;
  const pxPerHour = 56;

  const dayActivities = useMemo(
    () => activities.filter((a) => a.activity_date === selectedDate).sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? "")),
    [activities, selectedDate],
  );

  const goToday = () => setSelectedDate(getTodayDateStringBRT());
  const prevDay = () => setSelectedDate((d) => addDaysBRT(d, -1));
  const nextDay = () => setSelectedDate((d) => addDaysBRT(d, 1));

  // Formatação pt-BR "domingo, 20 de abril de 2026" — reaproveita helper global
  // mas o helper não aceita data arbitrária; monto aqui via toLocaleDateString.
  const selectedDateLabel = useMemo(() => {
    const [y, m, d] = selectedDate.split("-").map((v) => parseInt(v, 10));
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" });
  }, [selectedDate]);

  const isToday = selectedDate === getTodayDateStringBRT();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header: seletor de data */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "4px 0",
        }}
      >
        <button
          type="button"
          onClick={prevDay}
          aria-label="Dia anterior"
          style={navButtonStyle}
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => setShowDatePicker(true)}
          aria-label="Selecionar data"
          style={{
            flex: 1,
            minHeight: 44,
            border: "1px solid var(--border-default)",
            background: "transparent",
            color: "var(--text-secondary)",
            borderRadius: 10,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            padding: "0 12px",
            textAlign: "center",
            textTransform: "capitalize",
          }}
        >
          {selectedDateLabel}
        </button>
        <button
          type="button"
          onClick={nextDay}
          aria-label="Próximo dia"
          style={navButtonStyle}
        >
          ›
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        {!isToday ? (
          <button
            type="button"
            onClick={goToday}
            style={{
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--interactive-primary)",
              background: "transparent",
              border: "none",
              padding: "6px 0",
              cursor: "pointer",
            }}
          >
            › Hoje
          </button>
        ) : (
          <span style={{ fontFamily: MONO, fontSize: 10, color: "var(--text-disabled)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            HOJE
          </span>
        )}
        <button
          type="button"
          onClick={() => setShowLegend((v) => !v)}
          style={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            background: "transparent",
            border: `1px solid var(--border-default)`,
            borderRadius: 8,
            padding: "6px 10px",
            minHeight: 32,
            cursor: "pointer",
          }}
        >
          Legenda {showLegend ? "▴" : "▾"}
        </button>
      </div>

      {showLegend ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            padding: "10px 12px",
            background: "var(--surface-raised)",
            border: "1px solid var(--border-default)",
            borderRadius: 10,
          }}
        >
          {LEGEND.map((l) => (
            <span
              key={l.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                color: "var(--text-muted)",
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      ) : null}

      {/* Timeline 08h-20h */}
      <div
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          padding: "8px 0",
          position: "relative",
        }}
      >
        {Array.from({ length: dayEndHour - dayStartHour }, (_, i) => dayStartHour + i).map((hour) => {
          const hourActs = dayActivities.filter((a) => {
            if (!a.start_time) return false;
            const [h] = a.start_time.split(":").map((v) => parseInt(v, 10) || 0);
            return h === hour;
          });
          return (
            <div
              key={hour}
              onClick={() => onSlotClick && onSlotClick(selectedDate, `${String(hour).padStart(2, "0")}:00`)}
              style={{
                display: "flex",
                alignItems: "stretch",
                borderTop: hour === dayStartHour ? "none" : "1px solid var(--border-default)",
                minHeight: pxPerHour,
                cursor: onSlotClick ? "pointer" : "default",
              }}
            >
              <div
                style={{
                  width: 52,
                  flexShrink: 0,
                  padding: "8px 8px 8px 14px",
                  fontFamily: MONO,
                  fontSize: 10,
                  color: "var(--text-disabled)",
                  letterSpacing: "0.06em",
                }}
              >
                {String(hour).padStart(2, "0")}:00
              </div>
              <div style={{ flex: 1, padding: "6px 12px 6px 4px", display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                {hourActs.map((a) => {
                  const cs = ACTIVITY_COLORS[a.type] ?? ACTIVITY_COLORS.other;
                  const color = cs.color;
                  const bgColor = cs.bg;
                  const offsetMin = minutesFromStart(a.start_time, hour);
                  return (
                    <div
                      key={a.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick && onEventClick(a.id);
                      }}
                      style={{
                        borderLeft: `3px solid ${color}`,
                        background: bgColor,
                        padding: "8px 10px",
                        borderRadius: 8,
                        cursor: onEventClick ? "pointer" : "default",
                        marginLeft: offsetMin > 30 ? 16 : 0,
                        minHeight: 44,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color, letterSpacing: "0.04em" }}>
                          {formatActivityTime(a.start_time)}
                        </span>
                        <span style={{ fontFamily: MONO, fontSize: 9, color: "var(--text-disabled)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                          {TYPE_LABEL[a.type] ?? "Atividade"}
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.title}
                      </div>
                      {(a.contact_name || a.clients?.name) ? (
                        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {a.contact_name ?? a.clients?.name}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {dayActivities.length === 0 ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              fontSize: 12,
              color: "var(--text-disabled)",
              fontFamily: MONO,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Sem atividades neste dia
          </div>
        ) : null}
      </div>

      {showDatePicker
        ? createPortal(
            <DatePickerSheet
              selectedDate={selectedDate}
              onSelect={(d) => {
                setSelectedDate(d);
                setShowDatePicker(false);
              }}
              onClose={() => setShowDatePicker(false)}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

const navButtonStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 10,
  border: "1px solid var(--border-default)",
  background: "transparent",
  color: "var(--text-secondary)",
  fontSize: 20,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

// ── Bottom sheet com mini calendário para pular para qualquer dia ──

function DatePickerSheet({
  selectedDate,
  onSelect,
  onClose,
}: {
  selectedDate: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  const today = getTodayDateStringBRT();
  const [viewMonth, setViewMonth] = useState(() => {
    const [y, m] = selectedDate.split("-").map((v) => parseInt(v, 10));
    return { year: y, month: m };
  });

  const daysInMonth = new Date(viewMonth.year, viewMonth.month, 0).getDate();
  const firstWeekday = new Date(Date.UTC(viewMonth.year, viewMonth.month - 1, 1, 12, 0, 0)).getUTCDay();
  // ISO: começa na segunda. 0=Dom => coloca no fim.
  const firstOffset = (firstWeekday + 6) % 7;
  const cells: Array<{ day: number | null; dateStr: string | null }> = [];
  for (let i = 0; i < firstOffset; i++) cells.push({ day: null, dateStr: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${viewMonth.year}-${String(viewMonth.month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, dateStr });
  }

  const prevMonth = () => setViewMonth((p) => (p.month === 1 ? { year: p.year - 1, month: 12 } : { year: p.year, month: p.month - 1 }));
  const nextMonth = () => setViewMonth((p) => (p.month === 12 ? { year: p.year + 1, month: 1 } : { year: p.year, month: p.month + 1 }));

  const monthLabel = new Date(Date.UTC(viewMonth.year, viewMonth.month - 1, 1, 12, 0, 0)).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(11,10,8,0.6)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", zIndex: 2000 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Selecionar data"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 2010,
          background: "var(--surface-raised)",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingBottom: "env(safe-area-inset-bottom)",
          animation: "slideUpSheet 300ms cubic-bezier(0.16,1,0.3,1) both",
          boxShadow: "0 -8px 24px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border-strong)" }} />
        </div>
        <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button type="button" onClick={prevMonth} aria-label="Mês anterior" style={navButtonStyle}>‹</button>
          <span
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 15,
              fontWeight: 700,
              color: "var(--text-primary)",
              textTransform: "capitalize",
            }}
          >
            {monthLabel}
          </span>
          <button type="button" onClick={nextMonth} aria-label="Próximo mês" style={navButtonStyle}>›</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, padding: "0 12px 8px" }}>
          {["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"].map((d) => (
            <div
              key={d}
              style={{
                textAlign: "center",
                fontFamily: MONO,
                fontSize: 9,
                color: "var(--text-disabled)",
                letterSpacing: "0.1em",
                padding: "4px 0",
              }}
            >
              {d}
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, padding: "0 12px 16px" }}>
          {cells.map((c, i) => {
            if (!c.day || !c.dateStr) return <div key={i} />;
            const isSelected = c.dateStr === selectedDate;
            const isCurrentDay = c.dateStr === today;
            return (
              <button
                key={c.dateStr}
                type="button"
                onClick={() => onSelect(c.dateStr!)}
                style={{
                  minHeight: 40,
                  borderRadius: 8,
                  border: isCurrentDay && !isSelected ? `1px solid var(--interactive-primary)` : "1px solid transparent",
                  background: isSelected ? "var(--interactive-primary)" : "transparent",
                  color: isSelected ? "var(--interactive-on-primary)" : "var(--text-primary)",
                  fontFamily: MONO,
                  fontSize: 12,
                  fontWeight: isSelected ? 700 : 500,
                  cursor: "pointer",
                }}
              >
                {c.day}
              </button>
            );
          })}
        </div>

        <div style={{ padding: "8px 16px 16px", borderTop: "1px solid var(--border-default)" }}>
          <button
            type="button"
            onClick={() => onSelect(today)}
            style={{
              width: "100%",
              minHeight: 44,
              borderRadius: 10,
              border: "none",
              background: "transparent",
              color: "var(--interactive-primary)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Ir para hoje ({formatWeekdayDateLongBRT(new Date())})
          </button>
        </div>
      </div>
    </>
  );
}
