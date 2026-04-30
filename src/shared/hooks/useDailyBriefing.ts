import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../infra/supabase/supabaseClient";

/**
 * Shape do banco varia: antigo = {icon, text}; atual = {title, priority}.
 * Aceitamos ambos — a UI lê title||text e priority||icon.
 */
export interface BriefingHighlight {
  title?: string;
  priority?: "critical" | "warning" | "info";
  // legado
  icon?: "alert" | "success" | "info" | "warning";
  text?: string;
}
export interface BriefingAction { priority: "urgent" | "high" | "medium"; action: string; reason: string }
export interface BriefingMetrics { health_score?: number; health_label?: "critica" | "atencao" | "boa" | "excelente"; risk_factors?: string[]; opportunities?: string[] }

export interface DailyBriefing {
  id: string;
  summary: string;
  highlights: BriefingHighlight[];
  actions: BriefingAction[];
  metrics: BriefingMetrics;
  briefing_date: string;
  tokens_used: number;
  created_at: string;
}

const EF_URL = "https://phpbsiyxwsbzeevqgixk.supabase.co/functions/v1/daily-briefing";

export function useDailyBriefing(accountId: string | null, developmentId: string | null) {
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBriefing = useCallback(async () => {
    if (!supabase || !accountId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("daily_briefings")
        .select("id, summary, highlights, actions, metrics, briefing_date, tokens_used, created_at")
        .eq("account_id", accountId)
        .order("briefing_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setBriefing({
          id: data.id as string,
          summary: data.summary as string,
          highlights: (data.highlights ?? []) as BriefingHighlight[],
          actions: (data.actions ?? []) as BriefingAction[],
          metrics: (data.metrics ?? { health_score: 0, health_label: "atencao" }) as BriefingMetrics,
          briefing_date: data.briefing_date as string,
          tokens_used: Number(data.tokens_used ?? 0),
          created_at: data.created_at as string,
        });
      }
    } catch (err) { console.error("Failed to load briefing:", err); }
    finally { setLoading(false); }
  }, [accountId]);

  const generateBriefing = useCallback(async () => {
    if (!accountId || !developmentId) return;
    setGenerating(true);
    setError(null);
    try {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const res = await fetch(EF_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ account_id: accountId, development_id: developmentId }),
      });
      const json = await res.json();
      if (json.success) {
        await loadBriefing();
      } else {
        setError(json.error || "Erro ao gerar briefing");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro de conexão");
    } finally { setGenerating(false); }
  }, [accountId, developmentId, loadBriefing]);

  useEffect(() => { void loadBriefing(); }, [loadBriefing]);

  return { briefing, loading, generating, error, generateBriefing };
}
