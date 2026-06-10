// Registry dos campos da Etapa 2: cada chave do catálogo (kind.fields) mapeia
// a um controle (toque-primeiro) + rótulo + se é avançado + onde grava.

export type FieldControl =
  | "text"
  | "textarea"
  | "client"
  | "broker"
  | "negotiation"
  | "development"
  | "unit"
  | "datetime"
  | "duration"
  | "team"
  | "outcome"
  | "nextstep"
  | "checklist"
  | "currency"
  | "channel"
  | "attachment";

export interface FieldDef {
  control: FieldControl;
  label: string;
  advanced?: boolean; // recolhido sob "+ mais opções"
  autofocus?: boolean; // texto principal (demanda/título)
  toTitle?: boolean; // grava em activities.title
  defaultSelf?: boolean; // pré-seleciona usuário atual (responsáveis)
  detailsKey?: string; // grava em activities.details.<key>
}

export const FIELD_DEFS: Record<string, FieldDef> = {
  demanda: { control: "text", label: "Demanda", autofocus: true, toTitle: true },
  titulo: { control: "text", label: "Título", autofocus: true, toTitle: true },
  cliente: { control: "client", label: "Cliente" },
  corretor: { control: "broker", label: "Corretor" },
  negociacao: { control: "negotiation", label: "Negociação" },
  empreendimento: { control: "development", label: "Empreendimento" },
  unidade: { control: "unit", label: "Unidade" },
  data_hora: { control: "datetime", label: "Data e hora" },
  prazo: { control: "datetime", label: "Prazo" },
  duracao: { control: "duration", label: "Duração" },
  participantes: { control: "team", label: "Com quem" },
  responsaveis: { control: "team", label: "Responsável(is)", defaultSelf: true },
  resultado: { control: "outcome", label: "Resultado" },
  proximo_passo: { control: "nextstep", label: "Próximo passo" },
  subtarefas: { control: "checklist", label: "Subtarefas" },
  valor: { control: "currency", label: "Valor", advanced: true, detailsKey: "valor" },
  canal: { control: "channel", label: "Canal", detailsKey: "canal" },
  referencia: { control: "text", label: "Referência", detailsKey: "referencia" },
  local: { control: "text", label: "Local", detailsKey: "local" },
  observacoes: { control: "textarea", label: "Observações", advanced: true, detailsKey: "observacoes" },
  anexo: { control: "attachment", label: "Anexo", advanced: true },
};

export function fieldDef(key: string): FieldDef {
  return FIELD_DEFS[key] ?? { control: "text", label: key };
}

// Data padrão por base_type (offset em dias) — defaults inteligentes.
export function defaultOffsetDays(baseType: string): number {
  if (baseType === "follow_up") return 2;
  if (["visit_broker", "visit_client", "visit_development", "phone_call", "meeting_internal", "meeting_external", "training"].includes(baseType)) return 1;
  return 1; // operacional/orçamento/outros
}
