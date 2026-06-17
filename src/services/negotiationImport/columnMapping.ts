// Auto-detecção de colunas planilha → campo NEXA por sinônimos.
import type { ColumnMapping, NexaField } from "./types";
import { normalizeName } from "./text";

const SYNONYMS: Record<Exclude<NexaField, "ignorar">, string[]> = {
  cliente: ["cliente", "comprador", "nome", "proponente", "interessado", "lead"],
  corretor: ["corretor", "vendedor", "consultor", "responsavel", "captador"],
  imobiliaria: ["imobiliaria", "imob", "parceiro", "imobiliaria parceira"],
  status: ["status", "situacao", "etapa", "estagio", "fase", "andamento"],
  quadra_lote: ["quadra", "lote", "unidade", "ql", "quadra/lote", "qd", "lt", "lote/quadra"],
  data: ["data", "semana", "periodo", "dt", "data contato", "ultimo contato"],
  observacao: ["obs", "observacao", "observacoes", "nota", "notas", "comentario", "comentarios", "detalhe"],
  telefone: ["telefone", "fone", "celular", "whatsapp", "contato", "tel"],
  cpf: ["cpf", "documento", "doc"],
};

// Ordem de prioridade: campos mais específicos primeiro evita "nome" capturar tudo.
const FIELD_ORDER: Array<Exclude<NexaField, "ignorar">> = [
  "cpf",
  "telefone",
  "imobiliaria",
  "corretor",
  "quadra_lote",
  "status",
  "data",
  "observacao",
  "cliente",
];

export function detectField(header: string): NexaField {
  const n = normalizeName(header);
  if (!n) return "ignorar";
  for (const field of FIELD_ORDER) {
    const syns = SYNONYMS[field];
    if (syns.some((s) => n === normalizeName(s))) return field;
  }
  for (const field of FIELD_ORDER) {
    const syns = SYNONYMS[field];
    if (syns.some((s) => n.includes(normalizeName(s)))) return field;
  }
  return "ignorar";
}

export function autoMapColumns(headers: string[]): ColumnMapping {
  const map: ColumnMapping = {};
  for (const h of headers) map[h] = detectField(h);
  return map;
}
