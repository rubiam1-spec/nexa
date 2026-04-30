import { useState, useEffect } from "react";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { formatDateBRT } from "../../../shared/utils/dateUtils";

// ── Tokens (match CentralPage) ──
const T = {
  carbon: "var(--surface-raised)",
  stone: "var(--border-default)",
  chalk: "var(--text-primary)",
  fog: "var(--text-muted)",
  slate: "var(--text-disabled)",
  sprout: "var(--interactive-primary)",
  ink: "var(--surface-base)",
};
const MONO = "var(--font-mono)";
const SANS = "'Outfit', sans-serif";

interface WeeklyPlan {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string | null;
  week_start: string;
  week_end: string;
  publisher: { name: string } | null;
}

interface WeeklyPlanCardProps {
  accountId: string;
  developmentId: string;
}

export default function WeeklyPlanCard({ accountId, developmentId }: WeeklyPlanCardProps) {
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountId || !supabase) { setLoading(false); return; }
    const today = new Date().toISOString().split("T")[0];
    supabase
      .from("weekly_plans")
      .select("id, title, description, file_url, file_name, week_start, week_end, publisher:profiles!published_by(name)")
      .eq("account_id", accountId)
      .eq("development_id", developmentId)
      .eq("status", "published")
      .lte("week_start", today)
      .gte("week_end", today)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setPlan(data as WeeklyPlan | null);
        setLoading(false);
      });
  }, [accountId, developmentId]);

  if (loading || !plan) return null;

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = plan.file_url;
    a.download = plan.file_name ?? "plano-semanal.pdf";
    a.click();
  };

  return (
    <div style={{
      padding: 18,
      marginBottom: 16,
      background: T.carbon,
      border: `1px solid ${T.stone}`,
      borderLeft: `3px solid ${T.sprout}`,
      borderRadius: 12,
    }}>
      {/* Label */}
      <div style={{
        fontFamily: MONO, fontSize: 9, color: T.sprout,
        letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6,
      }}>
        Plano da Semana
      </div>

      {/* Title */}
      <div style={{
        fontFamily: SANS, fontSize: 15, fontWeight: 600,
        color: T.chalk, marginBottom: plan.description ? 4 : 6,
      }}>
        {plan.title}
      </div>

      {/* Description */}
      {plan.description && (
        <div style={{ fontFamily: SANS, fontSize: 12, color: T.fog, marginBottom: 6, lineHeight: 1.5 }}>
          {plan.description}
        </div>
      )}

      {/* Meta */}
      <div style={{ fontFamily: MONO, fontSize: 10, color: T.slate, marginBottom: 12 }}>
        {formatDateBRT(plan.week_start)} a {formatDateBRT(plan.week_end)}
        {plan.publisher?.name ? ` · ${plan.publisher.name.split(" ")[0]}` : ""}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => window.open(plan.file_url, "_blank")}
          style={{
            padding: "8px 16px", borderRadius: 8,
            background: T.sprout, color: T.ink,
            fontFamily: SANS, fontWeight: 600, fontSize: 12,
            border: "none", cursor: "pointer",
          }}
        >
          Visualizar PDF
        </button>
        <button
          onClick={handleDownload}
          style={{
            padding: "8px 16px", borderRadius: 8,
            border: `1px solid ${T.stone}`,
            background: "transparent",
            color: T.fog,
            fontFamily: SANS, fontWeight: 600, fontSize: 12,
            cursor: "pointer",
          }}
        >
          Baixar
        </button>
      </div>
    </div>
  );
}
