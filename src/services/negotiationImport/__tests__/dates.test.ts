import { describe, it, expect } from "vitest";
import { parseDateCell, toIsoDate } from "../dates";
import { buildStaging } from "../buildStaging";
import type { ParsedSheet } from "../types";

const iso = (s: string) => toIsoDate(parseDateCell(s).date);

describe("parseDateCell — anos de 4 dígitos nunca reinterpretados", () => {
  it("ISO com ano de 4 dígitos", () => {
    expect(iso("2024-09-12")).toBe("2024-09-12");
    expect(parseDateCell("2024-09-12").year4).toBe(true);
    expect(iso("2025-03-15")).toBe("2025-03-15");
  });

  it("dd/mm/yyyy (4 dígitos)", () => {
    expect(iso("12/09/2024")).toBe("2024-09-12");
    expect(parseDateCell("12/09/2024").year4).toBe(true);
  });

  it("dd/mm/yy (2 dígitos) → 20yy, ano ambíguo", () => {
    expect(iso("12/09/24")).toBe("2024-09-12");
    expect(parseDateCell("12/09/24").year4).toBe(false);
  });

  it("inválida / vazia → null", () => {
    expect(parseDateCell("").date).toBeNull();
    expect(parseDateCell("---").date).toBeNull();
    expect(parseDateCell("não informado").date).toBeNull();
    expect(parseDateCell("xyz").date).toBeNull();
  });
});

describe("buildStaging — correção de ano NÃO toca data de 4 dígitos (fix +1 ano)", () => {
  function sheet(datas: string[]): ParsedSheet {
    return {
      sheetNames: ["s"], sheetName: "s", headers: ["cliente", "data"],
      rows: datas.map((d, i) => ({ cliente: `C${i}`, data: d })),
      headerRowIndex: 0, totalRows: datas.length, totalCols: 2,
    };
  }
  const mapping = { cliente: "cliente" as const, data: "data" as const };

  it("num lote dominado por 2025, a data 2024 (4 dígitos) permanece 2024", () => {
    const rows = buildStaging({ parsed: sheet(["2025-01-10", "2025-02-20", "2025-05-05", "2024-09-12"]), mapping, existingBrokers: [], units: [] });
    const r2024 = rows[3];
    expect(r2024.createdAt).toBe("2024-09-12"); // NÃO virou 2025
    expect(r2024.flags).not.toContain("ano_corrigido");
  });

  it("ano de 2 dígitos ambíguo ainda pode ser corrigido ao dominante", () => {
    // '12/09/24' (year4=false) num lote 2025 é passível de correção.
    const rows = buildStaging({ parsed: sheet(["2025-01-10", "2025-02-20", "2025-05-05", "12/09/24"]), mapping, existingBrokers: [], units: [] });
    expect(rows[3].createdAt).toBe("2025-09-12");
    expect(rows[3].flags).toContain("ano_corrigido");
  });
});
