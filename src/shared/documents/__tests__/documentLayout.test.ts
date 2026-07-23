// v3 · testes de layout puro (validade absoluta, carência 0/6m, accent ≤3).
import { describe, it, expect } from "vitest";
import { formatValidadeAbsoluta, carenciaText, planAccentCountP1 } from "../documentLayout";

describe("formatValidadeAbsoluta — validade ABSOLUTA, sem travessão", () => {
  it("soma as horas e formata ATÉ DD/MM/AAAA HH:MM", () => {
    const s = formatValidadeAbsoluta("2026-07-30T10:00:00", 48);
    expect(s).toMatch(/^VÁLIDA POR 48H · ATÉ \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    expect(s).not.toContain("—"); // zero travessão
  });
  it("horas customizadas", () => {
    expect(formatValidadeAbsoluta("2026-07-30T10:00:00", 24)).toContain("VÁLIDA POR 24H");
  });
});

describe("carenciaText — 0 vs 6 meses", () => {
  it("0 ou ausente → null (não inventa linha)", () => {
    expect(carenciaText("2026-07-30T12:00:00", 0)).toBeNull();
    expect(carenciaText("2026-07-30T12:00:00", null)).toBeNull();
  });
  it("6 meses → 1ª parcela no mês+6, com rótulo do mês", () => {
    const c = carenciaText("2026-07-15T12:00:00", 6)!;
    expect(c.monthLabel).toBe("janeiro/2027"); // jul + 6 = jan/2027
    expect(c.text).toBe("1ª parcela em janeiro/2027 · 6 meses de carência");
    expect(c.text).not.toContain("—");
  });
});

describe("planAccentCountP1 — guarda accent ≤3 com QUALQUER tema", () => {
  it("mínimo = 1 (só a overline · 01)", () => {
    expect(planAccentCountP1({})).toBe(1);
  });
  it("com carência e slogan = 3 (nunca 4)", () => {
    expect(planAccentCountP1({ carenciaMeses: 6, hasSlogan: true })).toBe(3);
  });
  it("todas as combinações ≤ 3", () => {
    for (const carenciaMeses of [0, 6]) {
      for (const hasSlogan of [false, true]) {
        expect(planAccentCountP1({ carenciaMeses, hasSlogan })).toBeLessThanOrEqual(3);
      }
    }
  });
});
