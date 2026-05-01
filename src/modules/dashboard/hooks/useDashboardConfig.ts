import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { getWidgetsPadrao, type WidgetId } from "../config/widgets";

export function useDashboardConfig(
  userId: string | null,
  accountId: string | null,
  developmentId: string | null,
  role: string | null,
) {
  const [widgetsAtivos, setWidgetsAtivos] = useState<WidgetId[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [configId, setConfigId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !accountId || !developmentId || !role) {
      setIsLoading(false);
      return;
    }

    async function loadConfig() {
      if (!supabase) {
        setWidgetsAtivos(getWidgetsPadrao(role!));
        setIsLoading(false);
        return;
      }

      try {
        const { data } = await supabase
          .from("dashboard_configs")
          .select("id, widgets")
          .eq("user_id", userId)
          .eq("development_id", developmentId)
          .maybeSingle();

        if (data) {
          setConfigId(data.id);
          setWidgetsAtivos(data.widgets as WidgetId[]);
        } else {
          setWidgetsAtivos(getWidgetsPadrao(role!));
        }
      } catch {
        setWidgetsAtivos(getWidgetsPadrao(role!));
      }
      setIsLoading(false);
    }

    void loadConfig();
  }, [userId, accountId, developmentId, role]);

  const salvarConfig = useCallback(async (novosWidgets: WidgetId[]) => {
    if (!userId || !accountId || !developmentId || !supabase) return;

    const payload = {
      user_id: userId,
      account_id: accountId,
      development_id: developmentId,
      widgets: novosWidgets,
      updated_at: new Date().toISOString(),
    };

    try {
      if (configId) {
        await supabase.from("dashboard_configs").update(payload).eq("id", configId);
      } else {
        const { data } = await supabase.from("dashboard_configs").insert(payload).select("id").single();
        if (data) setConfigId(data.id);
      }
    } catch {
      // Silently fail — config is non-critical
    }

    setWidgetsAtivos(novosWidgets);
  }, [userId, accountId, developmentId, configId]);

  const toggleWidget = useCallback((id: WidgetId) => {
    const novos = widgetsAtivos.includes(id) ? widgetsAtivos.filter((w) => w !== id) : [...widgetsAtivos, id];
    void salvarConfig(novos);
  }, [widgetsAtivos, salvarConfig]);

  const resetarPadrao = useCallback(() => {
    if (!role) return;
    void salvarConfig(getWidgetsPadrao(role));
  }, [role, salvarConfig]);

  return { widgetsAtivos, isLoading, toggleWidget, resetarPadrao };
}
