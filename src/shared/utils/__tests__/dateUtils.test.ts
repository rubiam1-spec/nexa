import { describe, it, expect } from "vitest";
import {
  formatDateBRT,
  formatTimeBRT,
  formatDateTimeBRT,
  formatDateShortBRT,
  formatDateLongBRT,
  formatMonthBRT,
  formatMonthYearBRT,
  toDateStringBRT,
} from "../dateUtils";

describe("dateUtils — formatadores BRT", () => {
  describe("formatDateBRT", () => {
    it("formata ISO date → DD/MM/YYYY", () => {
      const result = formatDateBRT("2026-04-15T12:00:00Z");
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(result).toContain("2026");
    });
    it("retorna — para null", () => {
      expect(formatDateBRT(null)).toBe("—");
    });
    it("retorna — para undefined", () => {
      expect(formatDateBRT(undefined)).toBe("—");
    });
    it("retorna — para string inválida", () => {
      expect(formatDateBRT("not-a-date")).toBe("—");
    });
    it("aceita objeto Date", () => {
      const result = formatDateBRT(new Date(2026, 3, 15));
      expect(result).toContain("15");
    });
  });

  describe("formatTimeBRT", () => {
    it("formata horário de datetime", () => {
      const result = formatTimeBRT("2026-04-15T14:30:00Z");
      expect(result).toMatch(/\d{2}:\d{2}/);
    });
    it("retorna — para null", () => {
      expect(formatTimeBRT(null)).toBe("—");
    });
  });

  describe("formatDateTimeBRT", () => {
    it("formata data e hora completa", () => {
      const result = formatDateTimeBRT("2026-04-15T14:30:00Z");
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(result).toMatch(/\d{2}:\d{2}/);
    });
    it("retorna — para null", () => {
      expect(formatDateTimeBRT(null)).toBe("—");
    });
  });

  describe("formatDateShortBRT", () => {
    it("formata data curta com mês abreviado", () => {
      const result = formatDateShortBRT("2026-04-15T12:00:00Z");
      expect(result).toContain("15");
      expect(result.toLowerCase()).toContain("abr");
    });
    it("retorna — para null", () => {
      expect(formatDateShortBRT(null)).toBe("—");
    });
  });

  describe("formatDateLongBRT", () => {
    it("formata data longa", () => {
      const result = formatDateLongBRT("2026-04-15T12:00:00Z");
      expect(result).toContain("15");
      expect(result.toLowerCase()).toContain("abril");
      expect(result).toContain("2026");
    });
    it("retorna — para null", () => {
      expect(formatDateLongBRT(null)).toBe("—");
    });
  });

  describe("formatMonthBRT", () => {
    it("retorna nome do mês em português", () => {
      const result = formatMonthBRT("2026-04-15T12:00:00Z");
      expect(result.toLowerCase()).toBe("abril");
    });
    it("retorna — para string inválida", () => {
      expect(formatMonthBRT("invalid")).toBe("—");
    });
  });

  describe("formatMonthYearBRT", () => {
    it("formata mês e ano: abril de 2026", () => {
      const result = formatMonthYearBRT("2026-04-15T12:00:00Z");
      expect(result.toLowerCase()).toContain("abril");
      expect(result).toContain("2026");
    });
  });

  describe("toDateStringBRT", () => {
    it("converte Date para YYYY-MM-DD", () => {
      const result = toDateStringBRT(new Date(2026, 3, 15, 12, 0, 0));
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result).toContain("2026");
    });
  });
});
