import { parseDateHint } from "../../../domain/atividade/ActivityScheduling";
import type { ActivityKind } from "../../../infra/repositories/activityKindsRepository";

export interface QuickParsed {
  kind: ActivityKind | null;
  date?: string;
  time?: string;
  participant?: { id: string; name: string };
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Palavras-chave → key do catálogo. Ordem importa (mais específico primeiro).
const KEYWORD_RULES: { test: RegExp; key: string }[] = [
  { test: /\b(visita corretor|corretor)\b/, key: "visit_broker" },
  { test: /\b(ligar|ligacao|ligacoes|call)\b/, key: "phone_call" },
  { test: /\b(visita|cliente)\b/, key: "visit_client" },
  { test: /\b(follow-?up|follow|retomar)\b/, key: "follow_up" },
  { test: /\b(reuniao|meeting)\b/, key: "meeting_internal" },
  { test: /\b(treinamento|treino)\b/, key: "training" },
  { test: /\b(orcamento)\b/, key: "orcamento" },
  { test: /\b(relatorio)\b/, key: "relatorio" },
  { test: /\b(material|marketing|arte)\b/, key: "material_marketing" },
  { test: /\b(documento|contrato|documentacao)\b/, key: "documentacao" },
  { test: /\b(financeiro|boleto|pagamento)\b/, key: "financeiro" },
  { test: /\b(pos-?venda|posvenda)\b/, key: "posvenda" },
];

export function parseQuickCapture(
  text: string,
  kindsByKey: Record<string, ActivityKind>,
  teamProfiles: { id: string; name: string }[],
  now: Date = new Date(),
): QuickParsed {
  const result: QuickParsed = { kind: null };
  if (!text.trim()) return result;
  const n = norm(text);

  // Tipo por palavra-chave → kind (fallback 'other' = Tarefa geral).
  let key = "other";
  for (const rule of KEYWORD_RULES) {
    if (rule.test.test(n)) { key = rule.key; break; }
  }
  result.kind = kindsByKey[key] ?? kindsByKey.other ?? null;

  // Data/hora (reusa o parser heurístico existente).
  const hint = parseDateHint(text, now);
  if (hint.date) result.date = hint.date;
  if (hint.time) result.time = hint.time;

  // @pessoa → casa contra a equipe (case/acento-insensível, prefixo).
  const at = text.match(/@([\p{L}]+)/u);
  if (at) {
    const token = norm(at[1]);
    const found = teamProfiles.find(
      (p) => norm(p.name).split(/\s+/).some((w) => w.startsWith(token)) || norm(p.name).startsWith(token),
    );
    if (found) result.participant = { id: found.id, name: found.name };
  }

  return result;
}
