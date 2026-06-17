// De-para determinístico de status → enum NEXA. A ORDEM IMPORTA.
import type { NegotiationStatus, StatusClass, StatusMapping } from "./types";

const ARCHIVED: NegotiationStatus[] = ["WON", "LOST", "CANCELLED"];

function classOf(status: NegotiationStatus): StatusClass {
  return ARCHIVED.includes(status) ? "arquivada" : "ativa";
}

export function mapStatus(raw: string): StatusMapping {
  const v = (raw ?? "").toUpperCase().trim();
  const has = (s: string) => v.includes(s);

  let status: NegotiationStatus;
  let revisar = false;

  if (has("CANCELAD")) {
    status = "CANCELLED";
  } else if ((has("VENDA EFETIVADA") || has("EFETIVAD")) && !has("NÃO") && !has("NAO")) {
    status = "WON";
  } else if (has("FECHAMENTO")) {
    status = "WON";
    revisar = true;
  } else if (has("PERDID")) {
    status = "LOST";
  } else if (has("CONTRA")) {
    status = "PROPOSAL";
  } else if (has("STANDBY")) {
    status = "IN_PROGRESS";
    revisar = true;
  } else if (has("NÃO ATENDIDO") || has("NAO ATENDIDO")) {
    status = "OPEN";
    revisar = true;
  } else if (
    has("EM ANDAMENTO") ||
    has("NEGOCIAÇÃO ATIVA") ||
    has("NEGOCIACAO ATIVA") ||
    has("AGUARDANDO") ||
    has("VISITA AGENDADA")
  ) {
    status = "IN_PROGRESS";
  } else if (v === "" || v === "---" || has("NÃO INFORMADO") || has("NAO INFORMADO")) {
    status = "OPEN";
    revisar = true;
  } else {
    status = "OPEN";
    revisar = true;
  }

  return { status, classe: classOf(status), revisar };
}
