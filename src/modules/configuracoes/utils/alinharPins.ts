export interface PinComMetadata {
  id: string;
  unitId: string;
  xPct: number;
  yPct: number;
  quadra: string;
  lote: string;
}

export interface PinAlinhado {
  unitId: string;
  xPct: number;
  yPct: number;
}

// Calibrated regions for Vivendas do Bosque
const VIVENDAS_REGIONS: Record<string, { xMin: number; xMax: number; yMin: number; yMax: number }> = {
  "1": { xMin: 10, xMax: 18, yMin: 22, yMax: 95 },
  "2": { xMin: 19, xMax: 28, yMin: 20, yMax: 95 },
  "3": { xMin: 29, xMax: 38, yMin: 18, yMax: 95 },
  "4": { xMin: 39, xMax: 48, yMin: 16, yMax: 95 },
  "5": { xMin: 49, xMax: 58, yMin: 50, yMax: 95 },
  "6": { xMin: 60, xMax: 75, yMin: 48, yMax: 65 },
  "7": { xMin: 60, xMax: 82, yMin: 66, yMax: 80 },
  "8": { xMin: 60, xMax: 82, yMin: 81, yMax: 95 },
};

function getGenericRegions(quadraKeys: string[]): Record<string, { xMin: number; xMax: number; yMin: number; yMax: number }> {
  const count = quadraKeys.length;
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const margin = 15;
  const usableW = 100 - 2 * margin;
  const usableH = 100 - 2 * margin;
  const regions: Record<string, { xMin: number; xMax: number; yMin: number; yMax: number }> = {};
  quadraKeys.forEach((q, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cw = usableW / cols;
    const ch = usableH / rows;
    regions[q] = { xMin: margin + col * cw + 1, xMax: margin + (col + 1) * cw - 1, yMin: margin + row * ch + 1, yMax: margin + (row + 1) * ch - 1 };
  });
  return regions;
}

export function posicionarAutomaticamente(units: { id: string; quadra: string; lote: string }[]): PinAlinhado[] {
  const grupos: Record<string, { id: string; quadra: string; lote: string }[]> = {};
  for (const u of units) {
    if (!grupos[u.quadra]) grupos[u.quadra] = [];
    grupos[u.quadra].push(u);
  }

  Object.values(grupos).forEach((g) => g.sort((a, b) => {
    const na = parseInt(a.lote), nb = parseInt(b.lote);
    return !isNaN(na) && !isNaN(nb) ? na - nb : a.lote.localeCompare(b.lote);
  }));

  const quadraKeys = Object.keys(grupos).sort((a, b) => parseInt(a) - parseInt(b));

  // Use Vivendas regions if 8 quadras, otherwise generic
  const hasVivendasLayout = quadraKeys.length <= 8 && quadraKeys.every((k) => VIVENDAS_REGIONS[k]);
  const regions = hasVivendasLayout ? VIVENDAS_REGIONS : getGenericRegions(quadraKeys);

  const result: PinAlinhado[] = [];

  quadraKeys.forEach((quadra) => {
    const g = grupos[quadra];
    const region = regions[quadra];

    const w = region.xMax - region.xMin;
    const h = region.yMax - region.yMin;
    const n = g.length;

    const aspect = w / h;
    let cols = Math.max(1, Math.ceil(Math.sqrt(n * aspect)));
    const rows = Math.max(1, Math.ceil(n / cols));
    while (cols * rows < n) cols++;

    const xStep = w / (cols + 1);
    const yStep = h / (rows + 1);

    g.forEach((u, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      result.push({
        unitId: u.id,
        xPct: Math.round((region.xMin + xStep * (col + 1)) * 100) / 100,
        yPct: Math.round((region.yMin + yStep * (row + 1)) * 100) / 100,
      });
    });
  });

  return result;
}

export function alinharPorGrade(pins: PinComMetadata[]): PinAlinhado[] {
  const grupos: Record<string, PinComMetadata[]> = {};
  for (const pin of pins) {
    if (!grupos[pin.quadra]) grupos[pin.quadra] = [];
    grupos[pin.quadra].push(pin);
  }

  const resultado: PinAlinhado[] = [];

  for (const quadra in grupos) {
    const g = grupos[quadra];
    if (g.length < 2) {
      resultado.push(...g.map((p) => ({ unitId: p.unitId, xPct: p.xPct, yPct: p.yPct })));
      continue;
    }

    const xs = g.map((p) => p.xPct);
    const ys = g.map((p) => p.yPct);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const largura = maxX - minX;
    const altura = maxY - minY;
    const horiz = largura > altura;

    const ordenados = [...g].sort((a, b) => {
      const na = parseInt(a.lote), nb = parseInt(b.lote);
      return !isNaN(na) && !isNaN(nb) ? na - nb : a.lote.localeCompare(b.lote);
    });

    const n = ordenados.length;

    if (horiz) {
      const yMed = ys.reduce((a, b) => a + b, 0) / n;
      ordenados.forEach((pin, i) => {
        resultado.push({
          unitId: pin.unitId,
          xPct: Math.round((n > 1 ? minX + (largura / (n - 1)) * i : (minX + maxX) / 2) * 100) / 100,
          yPct: Math.round(yMed * 100) / 100,
        });
      });
    } else {
      const xMed = xs.reduce((a, b) => a + b, 0) / n;
      ordenados.forEach((pin, i) => {
        resultado.push({
          unitId: pin.unitId,
          xPct: Math.round(xMed * 100) / 100,
          yPct: Math.round((n > 1 ? minY + (altura / (n - 1)) * i : (minY + maxY) / 2) * 100) / 100,
        });
      });
    }
  }

  return resultado;
}
