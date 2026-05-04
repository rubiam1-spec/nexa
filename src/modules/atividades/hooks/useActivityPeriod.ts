import { useCallback, useEffect, useState } from "react";

export type DateMode = "activity_date" | "created_at";
export type Period = "today" | "week" | "month" | "quarter" | "all";

export type ActivityPeriodState = {
  dateMode: DateMode;
  setDateMode: (m: DateMode) => void;
  period: Period;
  setPeriod: (p: Period) => void;
  dateColumn: DateMode;
  startDate: string;
  endDate: string;
  periodLabel: string;
  dateModeLabel: string;
};

const STORAGE_KEY = "nexa.atividades.period.preferences";

const PERIOD_LABEL: Record<Period, string> = {
  today: "Hoje",
  week: "Esta semana",
  month: "Este mês",
  quarter: "Este trimestre",
  all: "Todo o período",
};

const DATE_MODE_LABEL: Record<DateMode, string> = {
  activity_date: "Data da atividade",
  created_at: "Data do registro",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function computeStartDate(period: Period): string {
  const now = new Date();
  if (period === "today") return isoDate(now);
  if (period === "week") {
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const start = new Date(now);
    start.setDate(now.getDate() + diff);
    return isoDate(start);
  }
  if (period === "month") {
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  }
  if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    return `${now.getFullYear()}-${pad(q * 3 + 1)}-01`;
  }
  return "1970-01-01";
}

function computeEndDate(): string {
  return isoDate(new Date());
}

type Stored = { dateMode?: DateMode; period?: Period };

function loadStored(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Stored;
  } catch {
    return {};
  }
}

function persist(state: Stored): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function useActivityPeriod(defaults?: { dateMode?: DateMode; period?: Period }): ActivityPeriodState {
  const [dateMode, setDateModeState] = useState<DateMode>(() => {
    const stored = loadStored();
    return stored.dateMode ?? defaults?.dateMode ?? "activity_date";
  });
  const [period, setPeriodState] = useState<Period>(() => {
    const stored = loadStored();
    return stored.period ?? defaults?.period ?? "month";
  });

  useEffect(() => {
    persist({ dateMode, period });
  }, [dateMode, period]);

  const setDateMode = useCallback((m: DateMode) => setDateModeState(m), []);
  const setPeriod = useCallback((p: Period) => setPeriodState(p), []);

  return {
    dateMode,
    setDateMode,
    period,
    setPeriod,
    dateColumn: dateMode,
    startDate: computeStartDate(period),
    endDate: computeEndDate(),
    periodLabel: PERIOD_LABEL[period],
    dateModeLabel: DATE_MODE_LABEL[dateMode],
  };
}
