// Date/time utilities with explicit BRT (America/Sao_Paulo) timezone handling
// Use these instead of native `new Date().toISOString().slice(0, 10)` for anything date-sensitive.

const TZ = "America/Sao_Paulo";

const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
});

const FULL_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const ISO_PARTS_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toDate(input: string | Date | null | undefined): Date | null {
  if (!input) return null;
  const d = typeof input === "string" ? new Date(input) : input;
  return isNaN(d.getTime()) ? null : d;
}

export function formatDateBRT(input: string | Date | null | undefined): string {
  const d = toDate(input);
  return d ? DATE_FORMATTER.format(d) : "—";
}

export function formatTimeBRT(input: string | Date | null | undefined): string {
  const d = toDate(input);
  return d ? TIME_FORMATTER.format(d) : "—";
}

export function formatDateTimeBRT(input: string | Date | null | undefined): string {
  const d = toDate(input);
  return d ? FULL_FORMATTER.format(d) : "—";
}

/**
 * Returns today's date as "YYYY-MM-DD" using BRT timezone.
 * Use this instead of `new Date().toISOString().slice(0, 10)` which is UTC-biased.
 */
export function getTodayDateStringBRT(): string {
  return ISO_PARTS_FORMATTER.format(new Date());
}

/**
 * Converts a Date to "YYYY-MM-DD" in BRT timezone.
 */
export function toDateStringBRT(date: Date): string {
  return ISO_PARTS_FORMATTER.format(date);
}

/** Short date: "13/abr" (day + abbreviated month) */
export function formatDateShortBRT(input: string | Date | null | undefined): string {
  const d = toDate(input);
  return d ? d.toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "short" }).replace(".", "") : "—";
}

/** Weekday long: "domingo, 13 de abril" */
export function formatWeekdayLongBRT(): string {
  return new Date().toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
}

/** Month name: "abril" */
export function formatMonthBRT(input?: string | Date | null): string {
  const d = input ? toDate(input) : new Date();
  return d ? d.toLocaleDateString("pt-BR", { timeZone: TZ, month: "long" }) : "—";
}

/** Weekday short date: "seg, 13 abr" */
export function formatWeekdayShortBRT(input: string | Date | null | undefined): string {
  const d = toDate(input);
  return d ? d.toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).replace(".", "") : "—";
}

/** Long date: "13 de abril de 2026" */
export function formatDateLongBRT(input: string | Date | null | undefined): string {
  const d = toDate(input);
  return d ? d.toLocaleDateString("pt-BR", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" }) : "—";
}

/** Weekday + long date: "domingo, 13 de abril de 2026" */
export function formatWeekdayDateLongBRT(input: string | Date | null | undefined): string {
  const d = toDate(input);
  return d ? d.toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "—";
}

/** Month + year: "abril de 2026" */
export function formatMonthYearBRT(input?: string | Date | null): string {
  const d = input ? toDate(input) : new Date();
  return d ? d.toLocaleDateString("pt-BR", { timeZone: TZ, month: "long", year: "numeric" }) : "—";
}

/** Today short uppercase: "13 ABR" */
export function formatTodayShortUpperBRT(): string {
  return new Date().toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "short" }).replace(".", "").toUpperCase();
}
