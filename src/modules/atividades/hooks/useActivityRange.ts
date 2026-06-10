import { useCallback, useEffect, useState } from "react";

// Filtro de período compartilhado (Quadro + Lista). Diferente de
// useActivityPeriod (que limita o fim a "hoje" para KPIs): aqui o range cobre
// o período INTEIRO, incluindo dias futuros — o Quadro é prospectivo.

export type RangePreset = "today" | "week" | "month" | "all" | "custom";

const STORAGE_KEY = "nexa.atividades.range";
const LABEL: Record<RangePreset, string> = {
  today: "Hoje",
  week: "Esta semana",
  month: "Este mês",
  all: "Tudo",
  custom: "Personalizado",
};

function pad(n: number) { return String(n).padStart(2, "0"); }
function iso(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export function computeRange(preset: RangePreset, customStart: string, customEnd: string): { start: string; end: string } {
  const now = new Date();
  if (preset === "today") return { start: iso(now), end: iso(now) };
  if (preset === "week") {
    const day = now.getDay();
    const monday = new Date(now); monday.setDate(now.getDate() + (day === 0 ? -6 : 1 - day));
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    return { start: iso(monday), end: iso(sunday) };
  }
  if (preset === "month") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: iso(first), end: iso(last) };
  }
  if (preset === "custom") return { start: customStart || "1970-01-01", end: customEnd || "2999-12-31" };
  return { start: "1970-01-01", end: "2999-12-31" }; // all
}

type Stored = { preset?: RangePreset; customStart?: string; customEnd?: string };

export function useActivityRange() {
  const [preset, setPresetState] = useState<RangePreset>(() => {
    try { return (JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Stored).preset ?? "month"; } catch { return "month"; }
  });
  const [customStart, setCustomStart] = useState<string>(() => {
    try { return (JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Stored).customStart ?? ""; } catch { return ""; }
  });
  const [customEnd, setCustomEnd] = useState<string>(() => {
    try { return (JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Stored).customEnd ?? ""; } catch { return ""; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ preset, customStart, customEnd })); } catch { /* ignore */ }
  }, [preset, customStart, customEnd]);

  const setPreset = useCallback((p: RangePreset) => setPresetState(p), []);
  const range = computeRange(preset, customStart, customEnd);
  const inRange = useCallback((date: string) => date >= range.start && date <= range.end, [range.start, range.end]);

  return { preset, setPreset, customStart, setCustomStart, customEnd, setCustomEnd, range, inRange, label: LABEL[preset], isAll: preset === "all" };
}
