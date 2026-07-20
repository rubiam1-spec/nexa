// De-para determinístico de status → enum NEXA. A ORDEM IMPORTA.
import type { NegotiationStatus, StatusClass, StatusMapping } from "./types";

const ARCHIVED: NegotiationStatus[] = ["WON", "LOST", "CANCELLED"];

// Membros exatos do enum — usados para a checagem de IDENTIDADE (prioridade 1).
const ENUM_MEMBERS: NegotiationStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "PROPOSAL",
  "RESERVATION",
  "WON",
  "LOST",
  "CANCELLED",
];
const ENUM_SET = new Set<string>(ENUM_MEMBERS);

function classOf(status: NegotiationStatus): StatusClass {
  return ARCHIVED.includes(status) ? "arquivada" : "ativa";
}

export function mapStatus(raw: string): StatusMapping {
  const v = (raw ?? "").toUpperCase().trim();
  const has = (s: string) => v.includes(s);

  // 1) IDENTIDADE: o valor JÁ é exatamente um membro do enum (OPEN, IN_PROGRESS,
  //    PROPOSAL, RESERVATION, WON, LOST, CANCELLED) → auto-mapeia para ele mesmo,
  //    com confiança alta e SEM badge "a revisar". (Corrige o bug do dogfood em que
  //    valores canônicos caíam no default OPEN.)
  if (ENUM_SET.has(v)) {
    return { status: v as NegotiationStatus, classe: classOf(v as NegotiationStatus), revisar: false };
  }

  let status: NegotiationStatus;
  let revisar = false;

  // 2) Sinônimos PT-BR e termos de planilha (específicos/terminais primeiro).
  if (has("CANCELAD")) {
    // cancelado / cancelada
    status = "CANCELLED";
  } else if (has("PERDID")) {
    // perdido / perdida
    status = "LOST";
  } else if (
    (has("VENDA EFETIVADA") || has("EFETIVAD") || has("VENDID") || has("GANH")) &&
    !has("NÃO") &&
    !has("NAO")
  ) {
    // vendido / vendida / ganho / ganha / venda efetivada
    status = "WON";
  } else if (has("FECHAMENTO")) {
    status = "WON";
    revisar = true;
  } else if (has("CONTRA") || has("PROPOSTA")) {
    // contraproposta / proposta
    status = "PROPOSAL";
  } else if (has("RESERV")) {
    // reserva / reservado / reservada
    status = "RESERVATION";
  } else if (has("STANDBY")) {
    status = "IN_PROGRESS";
    revisar = true;
  } else if (has("NÃO ATENDIDO") || has("NAO ATENDIDO")) {
    status = "OPEN";
    revisar = true;
  } else if (
    has("EM ANDAMENTO") ||
    has("NEGOCI") || // em negociação / negociando / negociacao
    has("AGUARDANDO") ||
    has("VISITA AGENDADA")
  ) {
    status = "IN_PROGRESS";
  } else if (has("EM ABERTO") || has("ABERT") || has("NOVO") || has("NOVA")) {
    // aberto / em aberto / novo — sinônimo reconhecido de OPEN (sem revisar).
    status = "OPEN";
  } else if (v === "" || v === "---" || has("NÃO INFORMADO") || has("NAO INFORMADO")) {
    status = "OPEN";
    revisar = true;
  } else {
    // 3) Nada casou → default seguro + badge "a revisar".
    status = "OPEN";
    revisar = true;
  }

  return { status, classe: classOf(status), revisar };
}
