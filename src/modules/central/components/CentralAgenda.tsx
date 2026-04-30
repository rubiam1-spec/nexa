import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  profile_id: string | null;
  profiles?: { name: string } | null;
  clients?: { name: string } | null;
}

interface CentralAgendaProps {
  accountId: string | null;
  role: string | null;
  userId: string | null;
  isManager?: boolean;
}

const MONO = "var(--font-mono)";
const DAY_LETTERS = ["S", "T", "Q", "Q", "S", "S", "D"]; // seg ter qua qui sex sáb dom

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function CentralAgenda({ accountId, role, userId, isManager }: CentralAgendaProps) {
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);
  const weekStart = useMemo(() => getWeekStart(today), [today]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  }), [weekStart]);

  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [activities, setActivities] = useState<Activity[]>([]);

  const isConsultantOrBroker = role === "commercial_consultant" || role === "broker";

  // Fetch week activities (reuses the same table/permission logic used elsewhere)
  useEffect(() => {
    if (!supabase || !accountId) return;
    const startStr = weekStart.toISOString().slice(0, 10);
    const endDate = new Date(weekStart);
    endDate.setDate(endDate.getDate() + 7);
    const endStr = endDate.toISOString().slice(0, 10);
    let mounted = true;
    (async () => {
      try {
        let query = supabase!
          .from("activities")
          .select("id, type, title, activity_date, start_time, duration_minutes, contact_name, profile_id, clients(name), profiles!activities_profile_id_fkey(name)")
          .eq("account_id", accountId)
          .gte("activity_date", startStr)
          .lt("activity_date", endStr);
        // consultant/broker sees only their own
        if (isConsultantOrBroker && userId) query = query.eq("profile_id", userId);
        const { data } = await query;
        if (mounted) setActivities((data ?? []) as unknown as Activity[]);
      } catch { /* table may not exist / permission */ }
    })();
    return () => { mounted = false; };
  }, [accountId, weekStart, isConsultantOrBroker, userId]);

  // Count per day
  const activityCountByDay = useMemo(() => weekDays.map((day) => {
    const dayStr = day.toISOString().slice(0, 10);
    return activities.filter((a) => a.activity_date === dayStr).length;
  }), [weekDays, activities]);

  const dayActivities = useMemo(() => {
    const dayStr = selectedDay.toISOString().slice(0, 10);
    return activities
      .filter((a) => a.activity_date === dayStr)
      .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
  }, [selectedDay, activities]);

  return (
    <div style={{ background: "linear-gradient(168deg, rgba(34,33,28,0.45), rgba(18,17,14,0.15))", borderRadius: 12, border: "1px solid rgba(61,58,48,0.08)", overflow: "hidden", marginBottom: 16 }}>
      {/* Header */}
      <div style={{ padding: "14px 18px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, color: "#5C5647", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          {isManager ? "AGENDA DA EQUIPE" : "MINHA AGENDA"}
        </div>
        <div onClick={() => navigate("/atividades?view=calendar")} style={{ fontSize: 10, color: "#4ADE80", cursor: "pointer", fontWeight: 600, transition: "opacity 150ms" }}>
          Ver completa →
        </div>
      </div>

      {/* Week strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "0 12px 12px", gap: 4 }}>
        {weekDays.map((day, i) => {
          const isToday = isSameDay(day, today);
          const isSelected = isSameDay(day, selectedDay);
          const hasActivities = activityCountByDay[i] > 0;
          return (
            <div key={i} onClick={() => setSelectedDay(day)} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 3, cursor: "pointer", padding: "6px 0",
              borderRadius: 8,
              background: isSelected && !isToday ? "rgba(61,58,48,0.2)" : isSelected && isToday ? "rgba(74,222,128,0.1)" : "transparent",
              transition: "all 100ms ease",
            }}>
              <span style={{ fontFamily: MONO, fontSize: 7.5, color: isToday ? "#4ADE80" : "#3D3A30", letterSpacing: "0.05em" }}>
                {DAY_LETTERS[i]}
              </span>
              <div style={{
                width: 26, height: 26, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: isToday ? 700 : 500,
                color: isToday ? "#0B0A08" : isSelected ? "#E8E5DE" : "#5C5647",
                background: isToday ? "#4ADE80" : "transparent",
              }}>
                {day.getDate()}
              </div>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: hasActivities ? (isToday ? "#4ADE80" : "#5C5647") : "transparent" }} />
            </div>
          );
        })}
      </div>

      {/* Day activities list */}
      <div style={{ padding: "10px 18px 16px", borderTop: "1px solid rgba(61,58,48,0.06)" }}>
        {dayActivities.length > 0 ? (
          <>
            {dayActivities.slice(0, 3).map((activity, i) => {
              const colors = ACTIVITY_COLORS[activity.type] || ACTIVITY_COLORS.other;
              const subtitle = activity.contact_name || activity.clients?.name || activity.profiles?.name || "";
              return (
                <div key={activity.id}
                  onClick={() => navigate(`/atividades?view=calendar&focus=${activity.id}`)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 6px",
                    borderBottom: i < Math.min(dayActivities.length, 3) - 1 ? "1px solid rgba(61,58,48,0.04)" : "none",
                    cursor: "pointer", transition: "background 100ms ease",
                    borderRadius: 6,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(74,222,128,0.03)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                >
                  <span style={{ fontFamily: MONO, fontSize: 10, color: activity.start_time ? "#5C5647" : "#3D3A30", width: 36, textAlign: "right", flexShrink: 0 }}>
                    {activity.start_time?.slice(0, 5) || "s/ hora"}
                  </span>
                  <div style={{ width: 2.5, height: 24, borderRadius: 2, background: colors.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#E8E5DE", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {activity.title || "Atividade"}
                    </div>
                    {subtitle && <div style={{ fontSize: 10, color: "#5C5647" }}>{subtitle}</div>}
                  </div>
                </div>
              );
            })}
            {dayActivities.length > 3 && (
              <div onClick={() => navigate("/atividades?view=calendar")} style={{ fontSize: 10, color: "#706B5F", textAlign: "center", padding: "6px 0", fontWeight: 500, cursor: "pointer" }}>
                e mais {dayActivities.length - 3} atividades →
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: "14px 0 4px", textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#5C5647", marginBottom: 10 }}>Nenhuma atividade agendada</div>
            <button type="button"
              onClick={() => navigate(`/atividades?view=calendar&date=${selectedDay.toISOString().slice(0, 10)}`)}
              style={{
                padding: "6px 14px", fontSize: 11, fontWeight: 600,
                background: "rgba(74,222,128,0.08)",
                border: "1px solid rgba(74,222,128,0.2)",
                borderRadius: 8, color: "#4ADE80",
                cursor: "pointer", transition: "all 150ms ease",
              }}>
              + Agendar atividade
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
