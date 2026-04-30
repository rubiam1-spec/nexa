import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../../infra/supabase/supabaseClient";

export interface MapaPin {
  id: string;
  unitId: string;
  xPct: number;
  yPct: number;
}

export function useMapaPins(developmentId: string | null) {
  const [pins, setPins] = useState<MapaPin[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!developmentId || !supabase) { setPins([]); return; }
    setIsLoading(true);
    supabase
      .from("unit_map_pins")
      .select("id, unit_id, x_pct, y_pct")
      .eq("development_id", developmentId)
      .then(({ data }) => {
        setPins((data ?? []).map((p: { id: string; unit_id: string; x_pct: number; y_pct: number }) => ({
          id: p.id, unitId: p.unit_id, xPct: Number(p.x_pct), yPct: Number(p.y_pct),
        })));
        setIsLoading(false);
      });
  }, [developmentId]);

  const salvarPin = useCallback(async (pin: { unitId: string; xPct: number; yPct: number; developmentId: string; accountId: string }) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("unit_map_pins")
      .upsert({ unit_id: pin.unitId, development_id: pin.developmentId, account_id: pin.accountId, x_pct: pin.xPct, y_pct: pin.yPct, updated_at: new Date().toISOString() }, { onConflict: "development_id,unit_id" })
      .select("id, unit_id, x_pct, y_pct")
      .single();
    if (data && !error) {
      const novo: MapaPin = { id: data.id, unitId: data.unit_id, xPct: Number(data.x_pct), yPct: Number(data.y_pct) };
      setPins((prev) => { const exists = prev.find((p) => p.unitId === pin.unitId); return exists ? prev.map((p) => p.unitId === pin.unitId ? novo : p) : [...prev, novo]; });
    }
  }, []);

  const removerPin = useCallback(async (unitId: string) => {
    if (!supabase || !developmentId) return;
    await supabase.from("unit_map_pins").delete().eq("unit_id", unitId).eq("development_id", developmentId);
    setPins((prev) => prev.filter((p) => p.unitId !== unitId));
  }, [developmentId]);

  return { pins, isLoading, salvarPin, removerPin };
}
