// Schema declarativo dos tipos de atividade — fonte ÚNICA de verdade para
// montar a grade (Etapa 1) e o formulário adaptado (Etapa 2). Ícones e cores
// continuam vindo dos mapas já existentes na página (reuso, sem duplicar JSX).

export type ActivityGroup = "comercial" | "interno" | "operacional";
export type ActivityBranch = "agendamento" | "confeccao";
export type ActivityNeed = "client" | "broker" | "development" | "team" | "assignee";

export interface ActivityTypeSchema {
  group: ActivityGroup;
  label: string;
  branch: ActivityBranch;
  needs: ActivityNeed[];
  autoLink: boolean; // busca negociações ativas ao escolher cliente/corretor
  usesTemplate: boolean; // duração + checklist sugeridos
}

export const ACTIVITY_TYPE_SCHEMA: Record<string, ActivityTypeSchema> = {
  // Comercial — agendamento, com auto-vínculo ao funil.
  visit_broker: { group: "comercial", label: "Visita corretor", branch: "agendamento", needs: ["broker"], autoLink: true, usesTemplate: true },
  visit_client: { group: "comercial", label: "Visita cliente", branch: "agendamento", needs: ["client"], autoLink: true, usesTemplate: true },
  visit_development: { group: "comercial", label: "Visita empreend.", branch: "agendamento", needs: ["development"], autoLink: true, usesTemplate: true },
  phone_call: { group: "comercial", label: "Ligação", branch: "agendamento", needs: ["client"], autoLink: true, usesTemplate: true },
  follow_up: { group: "comercial", label: "Follow-up", branch: "agendamento", needs: ["client"], autoLink: true, usesTemplate: true },
  // Interno — agendamento de equipe, sem auto-vínculo.
  meeting_internal: { group: "interno", label: "Reunião interna", branch: "agendamento", needs: ["team"], autoLink: false, usesTemplate: true },
  meeting_external: { group: "interno", label: "Reunião externa", branch: "agendamento", needs: ["team"], autoLink: false, usesTemplate: true },
  training: { group: "interno", label: "Treinamento", branch: "agendamento", needs: ["team"], autoLink: false, usesTemplate: true },
  // Operacional — confecção de demanda (responsável + prazo + subtarefas).
  operational: { group: "operacional", label: "Demanda operacional", branch: "confeccao", needs: ["assignee"], autoLink: false, usesTemplate: true },
  other: { group: "operacional", label: "Outro", branch: "agendamento", needs: [], autoLink: false, usesTemplate: true },
};

export const GROUP_ORDER: ActivityGroup[] = ["comercial", "interno", "operacional"];

export const GROUP_LABELS: Record<ActivityGroup, string> = {
  comercial: "Comercial",
  interno: "Interno",
  operacional: "Operacional",
};

export function typesByGroup(group: ActivityGroup): string[] {
  return Object.keys(ACTIVITY_TYPE_SCHEMA).filter((k) => ACTIVITY_TYPE_SCHEMA[k].group === group);
}
