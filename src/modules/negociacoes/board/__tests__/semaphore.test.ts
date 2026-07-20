import { describe, it, expect } from "vitest";
import { semaphoreOf } from "../semaphore";

const NOW = new Date("2026-07-09T12:00:00Z").getTime();
const T = 7; // threshold dias

describe("semaphoreOf — situação do card (Fase B)", () => {
  it("verde: próxima ação agendada no futuro", () => {
    const s = semaphoreOf({ nextActionAt: "2026-07-15T00:00:00Z" }, T, NOW);
    expect(s.level).toBe("green");
    expect(s.label).toContain("15/07");
  });

  it("usa follow_up_at quando next_action_at é nulo", () => {
    const s = semaphoreOf({ nextActionAt: null, followUpAt: "2026-07-20T00:00:00Z" }, T, NOW);
    expect(s.level).toBe("green");
    expect(s.label).toContain("20/07");
  });

  it("vermelho: ação agendada no passado (atrasada)", () => {
    const s = semaphoreOf({ nextActionAt: "2026-07-01T00:00:00Z" }, T, NOW);
    expect(s.level).toBe("red");
    expect(s.label).toBe("Ação atrasada");
  });

  it("âmbar: sem próxima ação e dentro do limite de parada", () => {
    const s = semaphoreOf({ lastActivityAt: "2026-07-06T00:00:00Z" }, T, NOW);
    expect(s.level).toBe("amber");
    expect(s.label).toBe("Sem próxima ação");
  });

  it("vermelho: parada além do limite", () => {
    const s = semaphoreOf({ lastActivityAt: "2026-06-20T00:00:00Z" }, T, NOW);
    expect(s.level).toBe("red");
    expect(s.label).toMatch(/^Parada há \d+d$/);
  });

  it("vermelho: prazo de reserva ATIVA vencido tem prioridade", () => {
    const s = semaphoreOf(
      { reservaAtiva: true, reservaExpiresAt: "2026-07-01T00:00:00Z", nextActionAt: "2026-07-15T00:00:00Z" },
      T, NOW,
    );
    expect(s.level).toBe("red");
    expect(s.label).toBe("Prazo vencido");
  });

  it("prazo vencido de reserva NÃO-ativa não conta", () => {
    const s = semaphoreOf(
      { reservaAtiva: false, reservaExpiresAt: "2026-07-01T00:00:00Z", nextActionAt: "2026-07-15T00:00:00Z" },
      T, NOW,
    );
    expect(s.level).toBe("green");
  });

  it("sem base temporal alguma: degrada para âmbar (não inventa)", () => {
    const s = semaphoreOf({}, T, NOW);
    expect(s.level).toBe("amber");
    expect(s.label).toBe("Sem próxima ação");
  });

  // Etapa 0c — coerência de estado (só quando `status` é informado).
  describe("coerência por status (c)", () => {
    it("WON/LOST/CANCELLED nunca são alerta → neutral", () => {
      expect(semaphoreOf({ status: "WON", lastActivityAt: "2026-05-01T00:00:00Z" }, T, NOW))
        .toEqual({ level: "neutral", label: "Concluída" });
      expect(semaphoreOf({ status: "LOST" }, T, NOW).level).toBe("neutral");
      expect(semaphoreOf({ status: "CANCELLED" }, T, NOW).level).toBe("neutral");
    });

    it("'Sem próxima ação' vale em status vivo COM dono", () => {
      const s = semaphoreOf({ status: "IN_PROGRESS", ownerProfileId: "u1" }, T, NOW);
      expect(s).toEqual({ level: "amber", label: "Sem próxima ação" });
    });

    it("'Sem próxima ação' vale em status vivo COM atividade (mesmo sem dono)", () => {
      const s = semaphoreOf({ status: "OPEN", lastActivityAt: "2026-07-06T00:00:00Z" }, T, NOW);
      expect(s.level).toBe("amber");
    });

    it("status vivo SEM dono e SEM atividade não nag → neutral", () => {
      const s = semaphoreOf({ status: "OPEN" }, T, NOW);
      expect(s.level).toBe("neutral");
      expect(s.label).toBe("—");
    });

    it("chamada legada (sem status) mantém âmbar 'Sem próxima ação'", () => {
      expect(semaphoreOf({}, T, NOW)).toEqual({ level: "amber", label: "Sem próxima ação" });
    });
  });
});
