// Parsing de datas: serial Excel, dd/mm/yyyy, intervalo semanal "dd/mm à dd/mm/yyyy".
// Correção de typo de ano (ex.: 2026/2027 num conjunto de 2025) feita em nível de lote.

export type ParsedDate = { date: Date | null; weekly: boolean };

// Excel serial epoch (1899-12-30 por causa do bug de ano bissexto de 1900).
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const DAY_MS = 86400000;

function normYear(y: string): number {
  const n = parseInt(y, 10);
  return n < 100 ? 2000 + n : n;
}

function makeDate(d: number, m: number, y: number): Date | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function parseExcelSerial(n: number): Date | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  const dt = new Date(EXCEL_EPOCH + Math.round(n) * DAY_MS);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function parseDateCell(raw: string): ParsedDate {
  const s = (raw ?? "").trim();
  if (!s || s === "---" || s === "-" || /^n[ãa]o informado$/i.test(s)) {
    return { date: null, weekly: false };
  }

  // Intervalo semanal: "dd/mm à dd/mm/yyyy" (ou a / - / –) → usar início da semana.
  const range = s.match(
    /^(\d{1,2})\/(\d{1,2})\s*(?:à|a|-|–|até)\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/i,
  );
  if (range) {
    const [, d1, m1, , , y] = range;
    if (y) return { date: makeDate(+d1, +m1, normYear(y)), weekly: true };
  }

  // dd/mm/yyyy ou dd/mm/yy
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return { date: makeDate(+d, +m, normYear(y)), weekly: false };
  }

  // Número puro → serial Excel.
  if (/^\d+(\.\d+)?$/.test(s)) {
    return { date: parseExcelSerial(parseFloat(s)), weekly: false };
  }

  // ISO / outros formatos reconhecidos pelo Date.
  const iso = new Date(s);
  return Number.isNaN(iso.getTime()) ? { date: null, weekly: false } : { date: iso, weekly: false };
}

// Ano dominante do conjunto (para corrigir outliers de digitação).
export function dominantYear(dates: (Date | null)[]): number | null {
  const counts = new Map<number, number>();
  for (const d of dates) {
    if (!d) continue;
    const y = d.getUTCFullYear();
    counts.set(y, (counts.get(y) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestC = 0;
  for (const [y, c] of counts) {
    if (c > bestC) {
      bestC = c;
      best = y;
    }
  }
  return best;
}

// Corrige o ano para o dominante quando o desvio é pequeno (<= 2 anos) e sinaliza.
export function correctYear(d: Date, mode: number): { date: Date; corrected: boolean } {
  const y = d.getUTCFullYear();
  if (y !== mode && Math.abs(y - mode) <= 2) {
    return {
      date: new Date(Date.UTC(mode, d.getUTCMonth(), d.getUTCDate())),
      corrected: true,
    };
  }
  return { date: d, corrected: false };
}

// ISO (YYYY-MM-DD) para backdate em created_at.
export function toIsoDate(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}
