// Casamento de unidade por (quadra, lote). Uma negociação = uma unidade.
import type { RankedOption, UnitCandidate } from "./types";

export type QuadraLote = {
  quadra: string | null;
  lote: string | null;
  extraLotes: string[]; // lotes adicionais → flag "múltiplos lotes / revisar"
};

const SOLD_STATUSES = new Set(["VENDIDO", "VENDIDA", "SOLD"]);

function stripZeros(v: string): string {
  const s = v.replace(/^0+/, "");
  return s === "" ? "0" : s;
}

// "Q7 - L8/L5" → quadra 7, lote 8, extras [5]. Também "Quadra 7 Lote 8", "7/8".
export function parseQuadraLote(raw: string): QuadraLote {
  const s = (raw ?? "").toUpperCase().trim();
  if (!s) return { quadra: null, lote: null, extraLotes: [] };

  let quadra: string | null = null;
  const qm = s.match(/Q(?:UADRA|D)?\.?\s*0*(\d+)/);
  if (qm) quadra = stripZeros(qm[1]);

  const loteMatches = [...s.matchAll(/L(?:OTE|T)?\.?\s*0*(\d+)/g)].map((m) => stripZeros(m[1]));

  // fallback "7/8" ou "7-8" sem letras
  if (!quadra && loteMatches.length === 0) {
    const f = s.match(/^\s*0*(\d+)\s*[/\-]\s*0*(\d+)/);
    if (f) {
      return { quadra: stripZeros(f[1]), lote: stripZeros(f[2]), extraLotes: [] };
    }
  }

  const lote = loteMatches[0] ?? null;
  const extraLotes = loteMatches.slice(1);
  return { quadra, lote, extraLotes };
}

export type UnitMatch = {
  unit: UnitCandidate | null;
  sold: boolean;
};

export function matchUnit(
  quadra: string | null,
  lote: string | null,
  units: UnitCandidate[],
): UnitMatch {
  if (!quadra || !lote) return { unit: null, sold: false };
  const q = stripZeros(quadra);
  const l = stripZeros(lote);
  const unit =
    units.find((u) => stripZeros(u.quadra ?? "") === q && stripZeros(u.lote ?? "") === l) ?? null;
  const sold = !!unit && SOLD_STATUSES.has((unit.status ?? "").toUpperCase());
  return { unit, sold };
}

// Opções ranqueadas para o combobox de unidade: proximidade por quadra (mesma quadra)
// e por número de lote. Sugestão no topo quando há quadra igual.
export function rankUnitOptions(
  quadra: string | null,
  lote: string | null,
  units: UnitCandidate[],
): RankedOption[] {
  const q = quadra ? stripZeros(quadra) : null;
  const l = lote ? Number(stripZeros(lote)) : null;
  return units
    .map((u) => {
      const uq = stripZeros(u.quadra ?? "");
      const ul = Number(stripZeros(u.lote ?? ""));
      let score = 0;
      if (q && uq === q) score += 0.6;
      if (l != null && Number.isFinite(ul)) score += Math.max(0, 0.4 - Math.min(0.4, Math.abs(ul - l) * 0.05));
      return { u, score };
    })
    .sort((x, y) => y.score - x.score)
    .map(({ u, score }) => ({
      id: u.id,
      label: `Q${u.quadra} · L${u.lote}`,
      secondary: u.status ? u.status : undefined,
      group: score >= 0.6 ? "Sugestão" : "Unidades",
      confidence: score >= 0.6 ? Math.min(1, score) : undefined,
    }));
}
