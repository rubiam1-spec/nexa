// Documentos Temáveis v3 · documentTheme (domínio PURO). Anatomia é PRODUTO
// (fixa, no renderer); PELE é configuração (por conta, via account_document_themes).
// Sem linha da conta = tema NEUTRO NEXA (default em código). O renderer NUNCA
// tem hex de cliente hardcoded — tudo sai destes tokens.

export type DocumentFontPair = "nexa" | "bomm_editorial";

export type DocumentPalette = {
  pageBg: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  cardBg: string;
  cardBorder: string;
  divider: string;
};

export type DocumentTheme = DocumentPalette & {
  logoPrimary?: string | null;
  logoProduct?: string | null;
  slogan?: string | null;
  sloganAccentWord?: string | null;
  disclaimer: string;
  fontPair: DocumentFontPair;
};

// Linha crua de account_document_themes (palette jsonb + colunas).
export type DocumentThemeRow = {
  logo_primary_url?: string | null;
  logo_product_url?: string | null;
  palette?: Partial<DocumentPalette> | null;
  slogan?: string | null;
  slogan_accent_word?: string | null;
  disclaimer?: string | null;
  font_pair?: string | null;
};

// DEFAULT NEXA — neutro/sóbrio, sem slogan, disclaimer genérico, par 'nexa'.
export const DEFAULT_NEXA_THEME: DocumentTheme = {
  pageBg: "#FFFFFF",
  textPrimary: "#1A1A1A",
  textSecondary: "#454545",
  textMuted: "#8A8A8A",
  accent: "#2A2A2A", // neutro (não colorido) — pele sóbria por padrão
  cardBg: "#FAFAFA",
  cardBorder: "#E6E6E6",
  divider: "#ECECEC",
  logoPrimary: null,
  logoProduct: null,
  slogan: null,
  sloganAccentWord: null,
  disclaimer: "Simulação sem valor contratual. Valores sujeitos a confirmação e disponibilidade da unidade.",
  fontPair: "nexa",
};

const PALETTE_KEYS: (keyof DocumentPalette)[] = ["pageBg", "textPrimary", "textSecondary", "textMuted", "accent", "cardBg", "cardBorder", "divider"];

/** Resolve o tema: linha da conta MESCLADA sobre o DEFAULT NEXA. Merge PARCIAL —
 *  conta que define só `accent` mantém o resto neutro. Sem linha → neutro puro. */
export function resolveDocumentTheme(row: DocumentThemeRow | null | undefined): DocumentTheme {
  if (!row) return { ...DEFAULT_NEXA_THEME };
  const p = row.palette ?? {};
  const theme = { ...DEFAULT_NEXA_THEME };
  for (const k of PALETTE_KEYS) {
    const v = p[k];
    if (typeof v === "string" && v.trim() !== "") theme[k] = v;
  }
  theme.logoPrimary = row.logo_primary_url ?? null;
  theme.logoProduct = row.logo_product_url ?? null;
  theme.slogan = row.slogan && row.slogan.trim() !== "" ? row.slogan : null;
  theme.sloganAccentWord = row.slogan_accent_word && row.slogan_accent_word.trim() !== "" ? row.slogan_accent_word : null;
  theme.disclaimer = row.disclaimer && row.disclaimer.trim() !== "" ? row.disclaimer : DEFAULT_NEXA_THEME.disclaimer;
  theme.fontPair = row.font_pair === "bomm_editorial" ? "bomm_editorial" : "nexa";
  return theme;
}

// hex → [r,g,b] para jsPDF (setFillColor/setTextColor). Aceita #RGB e #RRGGBB.
export function hexToRgb(hex: string): [number, number, number] {
  const h = (hex || "").replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n) || full.length < 6) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Protocolo CP-AAAAMMDD-LxxQxx. Sem lote/quadra → 00. Re-emissão REUSA o
// protocolo já gravado na simulação (é o mesmo documento) — quem chama passa
// o existente quando houver.
function part2(v: string | number | null | undefined): string {
  const s = (v == null ? "" : String(v)).trim().toUpperCase();
  if (s === "") return "00";
  return s.padStart(2, "0").slice(-2);
}
export function buildProtocolo(dateIso: string, lote: string | number | null | undefined, quadra: string | number | null | undefined): string {
  const d = new Date(dateIso);
  const base = Number.isNaN(d.getTime()) ? new Date(0) : d;
  const ymd = `${base.getUTCFullYear()}${String(base.getUTCMonth() + 1).padStart(2, "0")}${String(base.getUTCDate()).padStart(2, "0")}`;
  return `CP-${ymd}-L${part2(lote)}Q${part2(quadra)}`;
}
