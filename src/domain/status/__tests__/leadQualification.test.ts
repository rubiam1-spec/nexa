import { describe, it, expect } from "vitest";
import {
  LeadQualificationStatus as S,
  LeadQualificationDbStatus,
  fromLeadQualificationDb,
  toLeadQualificationDb,
  canTransition,
  assertLeadTransition,
  isLeadActive,
  LEAD_ACTIVE_STATUSES,
} from "../leadQualification";
import { firstResponseSemaphore } from "../leadSemaphore";

describe("leadQualification — vocabulário e transições (Leads L1)", () => {
  it("NEW mapeia para 'unqualified' (valor existente, zero migração)", () => {
    expect(LeadQualificationDbStatus[S.NEW]).toBe("unqualified");
    expect(toLeadQualificationDb(S.NEW)).toBe("unqualified");
    expect(fromLeadQualificationDb("unqualified")).toBe(S.NEW);
  });

  it("from banco tolerante: null/desconhecido → NEW", () => {
    expect(fromLeadQualificationDb(null)).toBe(S.NEW);
    expect(fromLeadQualificationDb("")).toBe(S.NEW);
    expect(fromLeadQualificationDb("xpto")).toBe(S.NEW);
    expect(fromLeadQualificationDb("in_service")).toBe(S.IN_SERVICE);
    expect(fromLeadQualificationDb("qualified")).toBe(S.QUALIFIED);
    expect(fromLeadQualificationDb("converted")).toBe(S.CONVERTED);
    expect(fromLeadQualificationDb("discarded")).toBe(S.DISCARDED);
  });

  it("ativos = NEW, IN_SERVICE, QUALIFIED", () => {
    expect(LEAD_ACTIVE_STATUSES).toEqual([S.NEW, S.IN_SERVICE, S.QUALIFIED]);
    expect(isLeadActive(S.NEW)).toBe(true);
    expect(isLeadActive(S.CONVERTED)).toBe(false);
    expect(isLeadActive(S.DISCARDED)).toBe(false);
  });

  it("transições válidas do ciclo canônico", () => {
    expect(canTransition(S.NEW, S.IN_SERVICE)).toBe(true);
    expect(canTransition(S.IN_SERVICE, S.QUALIFIED)).toBe(true);
    expect(canTransition(S.QUALIFIED, S.CONVERTED)).toBe(true);
    expect(canTransition(S.QUALIFIED, S.DISCARDED)).toBe(true);
  });

  it("converter e descartar disponíveis em qualquer estágio ativo", () => {
    for (const from of [S.NEW, S.IN_SERVICE, S.QUALIFIED]) {
      expect(canTransition(from, S.CONVERTED)).toBe(true);
      expect(canTransition(from, S.DISCARDED)).toBe(true);
    }
  });

  it("transições inválidas: retrocesso e sair de terminal", () => {
    expect(canTransition(S.QUALIFIED, S.NEW)).toBe(false);
    expect(canTransition(S.IN_SERVICE, S.NEW)).toBe(false);
    expect(canTransition(S.CONVERTED, S.IN_SERVICE)).toBe(false);
    expect(canTransition(S.DISCARDED, S.NEW)).toBe(false);
    expect(() => assertLeadTransition(S.CONVERTED, S.NEW)).toThrow(/inválida/);
    expect(() => assertLeadTransition(S.NEW, S.QUALIFIED)).toThrow(); // pula IN_SERVICE
  });
});

describe("firstResponseSemaphore — SLA de primeira resposta (Leads L1)", () => {
  const NOW = new Date("2026-07-09T12:00:00Z").getTime();
  const ago = (mins: number) => new Date(NOW - mins * 60_000).toISOString();

  it("verde < 30min", () => {
    expect(firstResponseSemaphore(ago(10), false, NOW).level).toBe("green");
    expect(firstResponseSemaphore(ago(29), false, NOW).level).toBe("green");
  });
  it("âmbar entre 30min e 2h", () => {
    expect(firstResponseSemaphore(ago(45), false, NOW).level).toBe("amber");
    expect(firstResponseSemaphore(ago(119), false, NOW).level).toBe("amber");
  });
  it("vermelho >= 2h", () => {
    expect(firstResponseSemaphore(ago(120), false, NOW).level).toBe("red");
    expect(firstResponseSemaphore(ago(600), false, NOW).level).toBe("red");
  });
  it("lead atendido não pisca", () => {
    const s = firstResponseSemaphore(ago(600), true, NOW);
    expect(s.level).toBe("attended");
    expect(s.label).toBe("Atendido");
  });
});
