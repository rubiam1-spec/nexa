// Dedupe de corretores — propõe fusões; o usuário confirma, nunca automático no commit.
import type { BrokerCandidate, RankedOption } from "./types";
import { normalizeName, similarity } from "./text";

// Vínculo automático só para match exato/quase-idêntico (confiança altíssima).
const AUTO_THRESHOLD = 0.95;
// Abaixo disso ainda sugerimos vincular (a confirmar) para evitar criar duplicata;
// só vira "novo" quando nem isto é atingido contra os 257 existentes.
const SUGGEST_THRESHOLD = 0.62;
// limiar usado para destacar "Sugestões" no combobox de busca
const FUZZY_THRESHOLD = 0.86;

export type BrokerMatch = {
  raw: string; // nome como aparece na planilha
  normalized: string;
  count: number; // ocorrências no arquivo
  existingId: string | null; // corretor existente casado
  existingName: string | null;
  confidence: number; // 0..1 (1 = match exato)
  // existing = vínculo automático (exato/quase); fuzzy = a confirmar; new = sem candidato
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

    // melhor candidato existente (exato tem prioridade absoluta)
    const exact = existing.find((b) => normalizeName(b.name) === normalized);
    let best: { b: BrokerCandidate; sim: number } | null = null;
    for (const b of existing) {
      const sim = similarity(raw, b.name);
      if (!best || sim > best.sim) best = { b, sim };
    }

    if (exact) {
      existingId = exact.id;
      existingName = exact.name;
      confidence = 1;
      suggestion = "existing"; // vínculo automático
    } else if (best && best.sim >= AUTO_THRESHOLD) {
      existingId = best.b.id;
      existingName = best.b.name;
      confidence = best.sim;
      suggestion = "existing"; // quase-idêntico → vínculo automático
    } else if (best && best.sim >= SUGGEST_THRESHOLD) {
      existingId = best.b.id;
      existingName = best.b.name;
      confidence = best.sim;
      suggestion = "fuzzy"; // sugere vincular, mas o usuário confirma
    } else {
      suggestion = "new"; // sem correspondência razoável → criar novo (visível)
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

// Opções ranqueadas para o combobox de corretor: retorna SEMPRE a lista completa
// (filtragem por query é client-side no componente). "Sugestões" = alta similaridade
// com a grafia da linha; o resto vai para "Corretores". Ordenado por similaridade.
export function rankBrokerOptions(rawName: string, brokers: BrokerCandidate[]): RankedOption[] {
  return brokers
    .map((b) => ({ b, sim: similarity(rawName, b.name) }))
    .sort((x, y) => y.sim - x.sim)
    .map(({ b, sim }) => ({
      id: b.id,
      label: b.name,
      secondary: b.brokerageName ?? undefined,
      group: sim >= FUZZY_THRESHOLD ? "Sugestões" : "Corretores",
      confidence: sim >= FUZZY_THRESHOLD ? sim : undefined,
    }));
}
