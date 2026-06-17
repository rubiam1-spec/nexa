// Normalização de texto compartilhada (acentos, espaços, caixa).

// Range de marcas diacríticas combinantes (U+0300–U+036F), construído via string
// para não embutir caracteres combinantes crus no código-fonte.
const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

export function stripAccents(value: string): string {
  return (value ?? "").normalize("NFD").replace(DIACRITICS, "");
}

// Normaliza para comparação: sem acento, minúsculo, espaços colapsados.
export function normalizeName(value: string): string {
  return stripAccents((value ?? "").trim().replace(/\s+/g, " ")).toLowerCase();
}

export function levenshtein(a: string, b: string): number {
  const s = a ?? "";
  const t = b ?? "";
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  let prev = new Array<number>(t.length + 1);
  let curr = new Array<number>(t.length + 1);
  for (let j = 0; j <= t.length; j++) prev[j] = j;
  for (let i = 1; i <= s.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[t.length];
}

// 0..1 (1 = idêntico) sobre nomes normalizados.
export function similarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na && !nb) return 1;
  const max = Math.max(na.length, nb.length) || 1;
  return 1 - levenshtein(na, nb) / max;
}
