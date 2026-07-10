import { describe, it, expect } from "vitest";
import { splitLeadColumns } from "../leadColumns";
import { LeadQualificationStatus as S, isLeadActive, type LeadQualificationStatus } from "../../../domain/status/leadQualification";
import type { LeadView } from "../useLeads";

// LeadView mínimo (só qualification importa para as colunas).
const lv = (q: LeadQualificationStatus, id: string): LeadView =>
  ({ client: { id } as LeadView["client"], qualification: q, semaphore: { level: "green", label: "" }, isAssignee: false, canWork: true }) as LeadView;

const SAMPLE: LeadView[] = [
  lv(S.NEW, "1"), lv(S.NEW, "2"),
  lv(S.IN_SERVICE, "3"),
  lv(S.QUALIFIED, "4"), lv(S.QUALIFIED, "5"),
  lv(S.CONVERTED, "6"), lv(S.DISCARDED, "7"),
];

describe("splitLeadColumns — colunas do Kanban coerentes com /leads (L1.8)", () => {
  it("novos = NEW; atendimento = IN_SERVICE + QUALIFIED", () => {
    const { novos, atendimento } = splitLeadColumns(SAMPLE);
    expect(novos.map((l) => l.client.id)).toEqual(["1", "2"]);
    expect(atendimento.map((l) => l.client.id)).toEqual(["3", "4", "5"]);
  });

  it("COERÊNCIA: novos + atendimento = exatamente os leads ATIVOS (o 'Ativos' de /leads)", () => {
    const { novos, atendimento } = splitLeadColumns(SAMPLE);
    const ativos = SAMPLE.filter((l) => isLeadActive(l.qualification));
    expect(novos.length + atendimento.length).toBe(ativos.length);
    // sem sobreposição e sem incluir terminais (converted/discarded)
    const ids = new Set([...novos, ...atendimento].map((l) => l.client.id));
    expect(ids.has("6")).toBe(false); // convertido não entra nas colunas
    expect(ids.has("7")).toBe(false); // descartado não entra
  });

  it("lista vazia → colunas vazias", () => {
    expect(splitLeadColumns([])).toEqual({ novos: [], atendimento: [] });
  });
});
