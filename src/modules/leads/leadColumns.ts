// L1.8 — Split das colunas de lead do Kanban, PURO e testável. Fonte única =
// useLeads (mesma de /leads). Coerência por construção: novos + atendimento cobrem
// exatamente os leads ATIVOS (o "Ativos" de /leads).
import type { LeadView } from "./useLeads";
import { LeadQualificationStatus as S } from "../../domain/status/leadQualification";

export function splitLeadColumns(leads: LeadView[]): { novos: LeadView[]; atendimento: LeadView[] } {
  return {
    novos: leads.filter((l) => l.qualification === S.NEW),
    atendimento: leads.filter((l) => l.qualification === S.IN_SERVICE || l.qualification === S.QUALIFIED),
  };
}
