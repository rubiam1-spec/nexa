// Parsing de planilha via SheetJS, no browser. Detecta a linha de cabeçalho real
// (não assume linha 1) e ignora linhas de título/logo/total e linhas vazias.
import * as XLSX from "xlsx";
import type { ParsedSheet } from "./types";

const HEADER_SCAN_ROWS = 25;

export function listSheets(data: ArrayBuffer): string[] {
  const wb = XLSX.read(data, { type: "array" });
  return wb.SheetNames;
}

function nonEmptyTextCells(row: unknown[]): number {
  return row.filter((c) => c != null && String(c).trim() !== "").length;
}

// Heurística: linha de cabeçalho = a que tem mais células-texto não vazias dentro
// das primeiras linhas, com pelo menos uma linha de dados abaixo.
function detectHeaderRow(matrix: unknown[][]): number {
  let bestIdx = 0;
  let bestScore = -1;
  const scanLimit = Math.min(HEADER_SCAN_ROWS, matrix.length);
  for (let i = 0; i < scanLimit; i++) {
    const count = nonEmptyTextCells(matrix[i]);
    const hasDataBelow = matrix.slice(i + 1).some((r) => nonEmptyTextCells(r) > 0);
    if (count > bestScore && hasDataBelow) {
      bestScore = count;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function parseSheet(data: ArrayBuffer, sheetName?: string): ParsedSheet {
  const wb = XLSX.read(data, { type: "array" });
  const name = sheetName && wb.SheetNames.includes(sheetName) ? sheetName : wb.SheetNames[0];
  const ws = wb.Sheets[name];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    blankrows: false,
    defval: "",
  }) as unknown as unknown[][];

  if (!matrix.length) {
    return {
      sheetNames: wb.SheetNames,
      sheetName: name,
      headers: [],
      rows: [],
      headerRowIndex: 0,
      totalRows: 0,
      totalCols: 0,
    };
  }

  const headerRowIndex = detectHeaderRow(matrix);
  const rawHeaders = (matrix[headerRowIndex] ?? []).map((h, i) => {
    const label = String(h ?? "").trim();
    return label || `Coluna ${i + 1}`;
  });

  const rows: Record<string, string>[] = [];
  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const cells = matrix[r] ?? [];
    if (nonEmptyTextCells(cells) === 0) continue; // separadoras vazias
    const obj: Record<string, string> = {};
    rawHeaders.forEach((h, i) => {
      obj[h] = String(cells[i] ?? "").trim();
    });
    rows.push(obj);
  }

  return {
    sheetNames: wb.SheetNames,
    sheetName: name,
    headers: rawHeaders,
    rows,
    headerRowIndex,
    totalRows: rows.length,
    totalCols: rawHeaders.length,
  };
}
