// R1 · FASE 1 — testes dos helpers PUROS da fundação fluida.
import { describe, it, expect } from "vitest";
import { fluidGrid } from "../fluidGrid";
import { clampSize, fluidCoeffs, fluidText, fluidSpace } from "../clampSize";

describe("fluidGrid", () => {
  it("auto-fit por padrão, com guarda min(100%,…) contra overflow", () => {
    expect(fluidGrid(300)).toBe("repeat(auto-fit, minmax(min(100%, 300px), 1fr))");
  });
  it("auto-fill mantém trilhas vazias (evita card único esticado)", () => {
    expect(fluidGrid(280, "fill")).toBe("repeat(auto-fill, minmax(min(100%, 280px), 1fr))");
  });
  it("substitui o mínimo em px", () => {
    expect(fluidGrid(360)).toContain("360px");
    expect(fluidGrid(190)).toContain("minmax(min(100%, 190px), 1fr)");
  });
});

// Avalia a expressão preferida "Nvw ± Mpx" numa dada largura de viewport (px).
function evalPref(clampStr: string, viewportPx: number): number {
  const m = clampStr.match(/^clamp\(([\d.]+)px, (-?[\d.]+)vw ([+-]) ([\d.]+)px, ([\d.]+)px\)$/);
  if (!m) throw new Error("formato inesperado: " + clampStr);
  const lo = parseFloat(m[1]);
  const slopeVw = parseFloat(m[2]);
  const sign = m[3] === "+" ? 1 : -1;
  const intercept = sign * parseFloat(m[4]);
  const hi = parseFloat(m[5]);
  const raw = (slopeVw / 100) * viewportPx + intercept;
  return Math.min(hi, Math.max(lo, raw)); // aplica o clamp
}

describe("clampSize", () => {
  it("min === max colapsa para constante em px (sem vw)", () => {
    expect(clampSize(16, 16)).toBe("16px");
  });

  it("interpola: atinge minPx no minVw e maxPx no maxVw", () => {
    const c = clampSize(13, 15, { minVw: 360, maxVw: 1280 });
    expect(evalPref(c, 360)).toBeCloseTo(13, 4); // extremo inferior
    expect(evalPref(c, 1280)).toBeCloseTo(15, 4); // extremo superior
    // meio do caminho ~ média
    expect(evalPref(c, 820)).toBeCloseTo(14, 1);
  });

  it("trava nos extremos fora da faixa (clamp real)", () => {
    const c = clampSize(13, 15, { minVw: 360, maxVw: 1280 });
    expect(evalPref(c, 200)).toBeCloseTo(13, 4); // abaixo do minVw → trava no min
    expect(evalPref(c, 1600)).toBeCloseTo(15, 4); // acima do maxVw → trava no max
  });

  it("é monotônica crescente ao longo da banda tablet (768→1180)", () => {
    const c = clampSize(20, 28);
    const at768 = evalPref(c, 768);
    const at1024 = evalPref(c, 1024);
    const at1180 = evalPref(c, 1180);
    expect(at1024).toBeGreaterThanOrEqual(at768);
    expect(at1180).toBeGreaterThanOrEqual(at1024);
  });

  it("lo/hi normalizados mesmo se min>max", () => {
    const c = clampSize(24, 16); // invertido
    expect(c.startsWith("clamp(16px,")).toBe(true);
    expect(c.endsWith(", 24px)")).toBe(true);
  });

  it("fluidCoeffs: reta correta (slope e intercepto)", () => {
    const { slopeVw, interceptPx } = fluidCoeffs(10, 20, { minVw: 100, maxVw: 200 });
    // slope = (20-10)/(200-100) = 0.1 px/px → 10 vw; intercept = 10 - 0.1*100 = 0
    expect(slopeVw).toBeCloseTo(10, 6);
    expect(interceptPx).toBeCloseTo(0, 6);
  });

  it("presets são clamps válidos e crescentes", () => {
    for (const c of [fluidText.sm, fluidText.base, fluidText.lg, fluidText.xl, fluidText.display, fluidSpace.sm, fluidSpace.md, fluidSpace.lg]) {
      expect(c.startsWith("clamp(")).toBe(true);
      expect(c).toContain("vw");
      expect(evalPref(c, 1280)).toBeGreaterThanOrEqual(evalPref(c, 360));
    }
  });
});
