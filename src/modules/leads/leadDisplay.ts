// Config de EXIBIÇÃO dos estágios de lead (labels/cores canônicos). Cores alinhadas
// ao Brand Book v7 / paleta do funil. Vocabulário de status vem de domain/status.
import { LeadQualificationStatus, type LeadQualificationStatus as S } from "../../domain/status/leadQualification";
import type { LeadSemaphoreLevel } from "../../domain/status/leadSemaphore";

export const LEAD_STAGE_META: Record<S, { label: string; color: string; soft: string }> = {
  [LeadQualificationStatus.NEW]: { label: "Novo", color: "#7DA7F4", soft: "rgba(125,167,244,0.12)" },
  [LeadQualificationStatus.IN_SERVICE]: { label: "Em atendimento", color: "#E8B45A", soft: "rgba(232,180,90,0.12)" },
  [LeadQualificationStatus.QUALIFIED]: { label: "Qualificado", color: "#4ADE80", soft: "rgba(74,222,128,0.12)" },
  [LeadQualificationStatus.CONVERTED]: { label: "Convertido", color: "#34D399", soft: "rgba(52,211,153,0.12)" },
  [LeadQualificationStatus.DISCARDED]: { label: "Descartado", color: "#706B5F", soft: "rgba(112,107,95,0.12)" },
};

export const SEMAPHORE_COLOR: Record<LeadSemaphoreLevel, string> = {
  green: "#4ADE80",
  amber: "#E8B45A",
  red: "#F87171",
  attended: "#706B5F",
};
