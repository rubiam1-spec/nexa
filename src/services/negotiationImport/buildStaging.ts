// Orquestrador puro: planilha parseada + mapeamento + decisões → linhas de staging.
// Nada é gravado aqui. A UI roda isto para REVISÃO; o commit usa toCommitRows().
import type {
  BrokerCandidate,
  BrokerDecision,
  ClientCandidate,
  ColumnMapping,
  CommitRow,
  NegotiationStatus,
  NexaField,
  ParsedSheet,
  RowFlag,
  StagingRow,
  StatusMapping,
  UnitCandidate,
} from "./types";
import { mapStatus } from "./statusMapping";
import { correctYear, dominantYear, parseDateCell, toIsoDate } from "./dates";
import { detectPermuta } from "./permuta";
import { matchUnit, parseQuadraLote } from "./units";
import { hasProbableClientMatch } from "./clients";
import { normalizeName } from "./text";

export type BuildStagingInput = {
  parsed: ParsedSheet;
  mapping: ColumnMapping;
  existingBrokers: BrokerCandidate[];
  units: UnitCandidate[];
  clients?: ClientCandidate[];
  statusOverrides?: Record<string, NegotiationStatus>; // rawStatus(upper) -> override
  brokerDecisions?: Record<string, BrokerDecision>; // normalizedRaw -> decisão
};

// Coleta valores por campo (vários headers podem mapear para o mesmo campo).
function fieldValues(row: Record<string, string>, mapping: ColumnMapping): Record<NexaField, string[]> {
  const out = {} as Record<NexaField, string[]>;
  for (const [header, field] of Object.entries(mapping)) {
    if (field === "ignorar") continue;
    const val = (row[header] ?? "").trim();
    if (!val) continue;
    (out[field] ??= []).push(val);
  }
  return out;
}

function first(values: string[] | undefined): string | null {
  return values && values.length ? values[0] : null;
}

export type DistinctStatus = StatusMapping & { raw: string; count: number };

// Lista de status distintos (para a etapa de de-para editável).
export function getDistinctStatuses(parsed: ParsedSheet, mapping: ColumnMapping): DistinctStatus[] {
  const counts = new Map<string, { raw: string; count: number }>();
  for (const row of parsed.rows) {
    const fv = fieldValues(row, mapping);
    const raw = (first(fv.status) ?? "").trim();
    const key = raw.toUpperCase();
    const cur = counts.get(key);
    if (cur) cur.count += 1;
    else counts.set(key, { raw, count: 1 });
  }
  return [...counts.values()]
    .map(({ raw, count }) => ({ raw, count, ...mapStatus(raw) }))
    .sort((a, b) => b.count - a.count);
}

// Todos os nomes de corretor (com repetição) — alimenta dedupeBrokers.
export function getBrokerRawNames(parsed: ParsedSheet, mapping: ColumnMapping): Array<string | null> {
  return parsed.rows.map((row) => first(fieldValues(row, mapping).corretor));
}

export function buildStaging(input: BuildStagingInput): StagingRow[] {
  const { parsed, mapping, units, clients = [], statusOverrides = {}, brokerDecisions = {} } = input;

  // pré-passada: datas brutas para descobrir o ano dominante
  const parsedDates = parsed.rows.map((row) => {
    const fv = fieldValues(row, mapping);
    return parseDateCell(first(fv.data) ?? "");
  });
  const mode = dominantYear(parsedDates.map((p) => p.date));

  return parsed.rows.map((row, i) => {
    const fv = fieldValues(row, mapping);
    const flags: RowFlag[] = [];

    const clientName = first(fv.cliente);
    const clientPhone = first(fv.telefone);
    const clientCpf = first(fv.cpf);
    const observacao = fv.observacao ? fv.observacao.join(" · ") : null;
    const brokerNameRaw = first(fv.corretor);
    const brokerageName = first(fv.imobiliaria);
    const rawStatus = (first(fv.status) ?? "").trim();
    const rawDate = (first(fv.data) ?? "").trim();

    if (!clientName) flags.push("sem_cliente");

    // status: de-para + override do usuário
    const mapped = mapStatus(rawStatus);
    const status: NegotiationStatus = statusOverrides[rawStatus.toUpperCase()] ?? mapped.status;
    const statusClass: StagingRow["statusClass"] =
      status === "WON" || status === "LOST" || status === "CANCELLED" ? "arquivada" : "ativa";
    if (mapped.revisar) flags.push("status_revisar");

    // data: correção de ano + flag sem data
    const pd = parsedDates[i];
    let createdAt: string | null = null;
    if (!pd.date) {
      flags.push("sem_data");
    } else if (mode) {
      const { date, corrected } = correctYear(pd.date, mode);
      createdAt = toIsoDate(date);
      if (corrected) flags.push("ano_corrigido");
    } else {
      createdAt = toIsoDate(pd.date);
    }

    // permuta: status + observação + cliente
    const permuta = detectPermuta(rawStatus, observacao, clientName);
    if (permuta) flags.push("permuta");

    // unidade: casa por quadra/lote
    const ql = parseQuadraLote(first(fv.quadra_lote) ?? "");
    const { unit, sold } = matchUnit(ql.quadra, ql.lote, units);
    if (ql.extraLotes.length > 0) flags.push("multiplos_lotes");
    if (ql.quadra && ql.lote && !unit) flags.push("unidade_nao_encontrada");
    if (sold) flags.push("unidade_vendida");

    // corretor: aplica decisão do usuário (confirmada na etapa 3)
    const decision: BrokerDecision | undefined = brokerNameRaw
      ? brokerDecisions[normalizeName(brokerNameRaw)]
      : undefined;
    const brokerId = decision?.brokerId ?? null;
    const brokerName = decision?.brokerName ?? brokerNameRaw;
    const brokerageId = decision?.brokerageId ?? null;
    const resolvedBrokerageName = decision?.brokerageName ?? brokerageName;
    if (!brokerName) flags.push("sem_corretor");

    // cliente: vínculo a contato existente só é oferecido se houver provável duplicata
    const clientLinkSuggested = clients.length > 0 && hasProbableClientMatch(clientName, clients);

    return {
      index: i + 1,
      clientName,
      clientPhone,
      clientCpf,
      clientId: null,
      clientLinkSuggested,
      brokerNameRaw,
      brokerName,
      brokerId,
      brokerageName: resolvedBrokerageName,
      brokerageId,
      quadra: ql.quadra,
      lote: ql.lote,
      unitId: unit?.id ?? null,
      status,
      statusClass,
      temperature: null,
      permuta,
      createdAt,
      rawStatus,
      rawDate,
      observacao,
      flags,
      approved: true,
    };
  });
}

// StagingRow[] aprovadas → payload enxuto para a RPC.
export function toCommitRows(rows: StagingRow[]): CommitRow[] {
  return rows
    .filter((r) => r.approved)
    .map((r) => ({
      client_id: r.clientId,
      client_name: r.clientName,
      client_phone: r.clientPhone,
      client_cpf: r.clientCpf,
      broker_id: r.brokerId,
      broker_name: r.brokerId ? null : r.brokerName,
      brokerage_id: r.brokerageId,
      brokerage_name: r.brokerageName,
      unit_id: r.unitId,
      status: r.status,
      temperature: r.temperature,
      permuta: r.permuta,
      created_at: r.createdAt,
    }));
}
