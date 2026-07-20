import { describe, it, expect } from "vitest";
import { compactBRL, vgvOrDash, percent, valueOrDash, coverageLabel, ymLabel, dayMonthLabel, rangeLabel } from "../format";

describe("NexaViz format — honestidade e pt-BR", () => {
  it("compactBRL: compacta e usa vírgula; null/NaN → —", () => {
    expect(compactBRL(1_200_000)).toBe("R$ 1,2M");
    expect(compactBRL(45_000)).toBe("R$ 45k");
    expect(compactBRL(null)).toBe("—");
    expect(compactBRL(Number.NaN)).toBe("—");
  });

  it("vgvOrDash: 0/ausente NUNCA vira R$ 0 → —", () => {
    expect(vgvOrDash(0)).toBe("—");
    expect(vgvOrDash(null)).toBe("—");
    expect(vgvOrDash(500_000)).toBe("R$ 500k");
  });

  it("percent: fração → % pt-BR; null → —", () => {
    expect(percent(0.25)).toBe("25%");
    expect(percent(0.333, 1)).toBe("33,3%");
    expect(percent(null)).toBe("—");
  });

  it("valueOrDash: aplica fmt só quando conhecido", () => {
    expect(valueOrDash(3, (n) => `${n}d`)).toBe("3d");
    expect(valueOrDash(null, (n) => `${n}d`)).toBe("—");
  });

  it("coverageLabel", () => {
    expect(coverageLabel(4, 7)).toBe("4 de 7 com valor");
  });

  it("ymLabel: índice de mês absoluto → mmm/yy", () => {
    // 2026*12 + 6 = julho/26 (mês 6 = jul, base 0)
    expect(ymLabel(2026 * 12 + 6)).toBe("jul/26");
    expect(ymLabel(2025 * 12 + 0)).toBe("jan/25");
  });

  it("dayMonthLabel e rangeLabel", () => {
    expect(dayMonthLabel("2026-07-18T00:00:00Z")).toBe("18 jul");
    const start = Date.UTC(2026, 5, 18), end = Date.UTC(2026, 6, 18);
    expect(rangeLabel(start, end)).toBe("18 jun – 18 jul");
  });
});
