import { describe, it, expect } from "vitest";
import {
  decideInitialActivityStatus,
  toActivityMomentBRT,
} from "../atividade/ActivityScheduling";

// Âncora fixa para os testes. Equivale a 18/abr/2026 10:00:00 em BRT.
const NOW = new Date("2026-04-18T10:00:00-03:00");

describe("toActivityMomentBRT", () => {
  it("start_time null → assume 00:00 do dia no fuso BRT", () => {
    const m = toActivityMomentBRT("2026-04-18", null);
    // 00:00 BRT = 03:00 UTC
    expect(m.toISOString()).toBe("2026-04-18T03:00:00.000Z");
  });

  it("aceita 'HH:MM' sem segundos", () => {
    const m = toActivityMomentBRT("2026-04-18", "11:00");
    // 11:00 BRT = 14:00 UTC
    expect(m.toISOString()).toBe("2026-04-18T14:00:00.000Z");
  });

  it("aceita 'HH:MM:SS' com segundos", () => {
    const m = toActivityMomentBRT("2026-04-18", "11:00:00");
    expect(m.toISOString()).toBe("2026-04-18T14:00:00.000Z");
  });
});

describe("decideInitialActivityStatus", () => {
  it("instante 1 minuto no futuro → 'scheduled'", () => {
    const m = new Date(NOW.getTime() + 60_000);
    expect(decideInitialActivityStatus(m, NOW)).toBe("scheduled");
  });

  it("instante 1 minuto no passado → 'completed'", () => {
    const m = new Date(NOW.getTime() - 60_000);
    expect(decideInitialActivityStatus(m, NOW)).toBe("completed");
  });

  it("mesmo instante → 'completed' (não é futuro estrito)", () => {
    const m = new Date(NOW.getTime());
    expect(decideInitialActivityStatus(m, NOW)).toBe("completed");
  });

  it("dia futuro com start_time null → 'scheduled'", () => {
    const m = toActivityMomentBRT("2026-04-19", null);
    expect(decideInitialActivityStatus(m, NOW)).toBe("scheduled");
  });

  it("dia passado com start_time null → 'completed'", () => {
    const m = toActivityMomentBRT("2026-04-17", null);
    expect(decideInitialActivityStatus(m, NOW)).toBe("completed");
  });

  it("cenário real do bug reportado: hoje 11:00 vs agora 09:41 → 'scheduled'", () => {
    const agora = new Date("2026-04-18T09:41:00-03:00");
    const m = toActivityMomentBRT("2026-04-18", "11:00:00");
    expect(decideInitialActivityStatus(m, agora)).toBe("scheduled");
  });

  it("não depende de segundos/millis diferentes para flapar — decisão é só ordem relativa", () => {
    const agora = new Date("2026-04-18T10:00:00.500-03:00");
    const futuro = new Date("2026-04-18T10:00:01.000-03:00");
    const passado = new Date("2026-04-18T10:00:00.000-03:00");
    expect(decideInitialActivityStatus(futuro, agora)).toBe("scheduled");
    expect(decideInitialActivityStatus(passado, agora)).toBe("completed");
  });
});
