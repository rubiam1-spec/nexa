// Dedupe de corretores — propõe fusões; o usuário confirma, nunca automático no commit.
import type { BrokerCandidate } from "./types";
import { normalizeName, similarity } from "./text";

const FUZZY_THRESHOLD = 0.86;

export type BrokerMatch = {
  raw: string; // nome como aparece na planilha
  normalized: string;
  count: number; // ocorrências no arquivo
  existingId: string | null; // corretor existente casado
  existingName: string | null;
  confidence: number; // 0..1 (1 = match exato)
  suggestion: "existing" | "fuzzy" | "new";
  mergeWith: string[]; // outros nomes do arquivo sugeridos para fundir
};

function isAutonomo(normalized: string): boolean {
  return normalized === "autonomo" || normalized === "autonoma";
}

// rawNames: todos os nomes de corretor das linhas (com repetição).
export function dedupeBrokers(rawNames: Array<string | null>, existing: BrokerCandidate[]): BrokerMatch[] {
  // distinct por nome normalizado, preservando a primeira grafia e contando ocorrências
  const distinct = new Map<string, { raw: string; count: number }>();
  for (const name of rawNames) {
    const raw = (name ?? "").trim();
    if (!raw) continue;
    const key = normalizeName(raw);
    const cur = distinct.get(key);
    if (cur) cur.count += 1;
    else distinct.set(key, { raw, count: 1 });
  }

  const matches: BrokerMatch[] = [];
  for (const [normalized, { raw, count }] of distinct) {
    let existingId: string | null = null;
    let existingName: string | null = null;
    let confidence = 0;
    let suggestion: BrokerMatch["suggestion"] = "new";

    // 1) match exato normalizado contra brokers da conta
    const exact = existing.find((b) => normalizeName(b.name) === normalized);
    if (exact) {
      existingId = exact.id;
      existingName = exact.name;
      confidence = 1;
      suggestion = "existing";
    } else {
      // 2) fuzzy contra brokers da conta
      let best: { b: BrokerCandidate; sim: number } | null = null;
      for (const b of existing) {
        const sim = similarity(raw, b.name);
        if (!best || sim > best.sim) best = { b, sim };
      }
      if (best && best.sim >= FUZZY_THRESHOLD) {
        existingId = best.b.id;
        existingName = best.b.name;
        confidence = best.sim;
        suggestion = "fuzzy";
      }
    }

    matches.push({ raw, normalized, count, existingId, existingName, confidence, suggestion, mergeWith: [] });
  }

  // 3) sugerir fusões in-file entre nomes novos muito parecidos (não autônomos)
  for (let i = 0; i < matches.length; i++) {
    for (let j = i + 1; j < matches.length; j++) {
      const a = matches[i];
      const b = matches[j];
      if (a.suggestion === "existing" || b.suggestion === "existing") continue;
      if (isAutonomo(a.normalized) || isAutonomo(b.normalized)) continue;
      if (similarity(a.raw, b.raw) >= 0.9) {
        a.mergeWith.push(b.raw);
        b.mergeWith.push(a.raw);
      }
    }
  }

  // mais frequentes primeiro
  return matches.sort((x, y) => y.count - x.count);
}
