// N3-UI · testes de exibição do score (faixas, breakdown, null, badge).
import { describe, it, expect } from "vitest";
import { scoreBand, showScoreBadge, scoreBreakdownRows, SCORE_FACTORS } from "../scoreDisplay";

describe("scoreBand — faixas", () => {
  it("≥70 alta · 40–69 média · <40 baixa · null = sem avaliação", () => {
    expect(scoreBand(70)).toBe("high");
    expect(scoreBand(100)).toBe("high");
    expect(scoreBand(69)).toBe("mid");
    expect(scoreBand(40)).toBe("mid");
    expect(scoreBand(39)).toBe("low");
    expect(scoreBand(0)).toBe("low");
    expect(scoreBand(null)).toBe("none");
    expect(scoreBand(undefined)).toBe("none");
  });
});

describe("showScoreBadge — só ≥40 (não polui <40)", () => {
  it("badge aparece na alta e média, some na baixa e sem avaliação", () => {
    expect(showScoreBadge(70)).toBe(true);
    expect(showScoreBadge(40)).toBe(true);
    expect(showScoreBadge(39)).toBe(false);
    expect(showScoreBadge(null)).toBe(false);
  });
});

describe("scoreBreakdownRows — 5 fatores, ordem, clamp, ausente=0", () => {
  it("caso Gisele (soma 70) mapeia rótulos e máximos certos", () => {
    const rows = scoreBreakdownRows({ recencia_toque: 22, temperatura: 20, progresso: 15, engajamento: 8, followup: 5 });
    expect(rows.map((r) => [r.label, r.value, r.max])).toEqual([
      ["Recência do toque", 22, 30],
      ["Temperatura", 20, 20],
      ["Progresso na jornada", 15, 20],
      ["Engajamento comercial", 8, 15],
      ["Follow-up", 5, 15],
    ]);
    expect(rows.reduce((s, r) => s + r.value, 0)).toBe(70);
  });
  it("pct proporcional ao máximo", () => {
    const rows = scoreBreakdownRows({ recencia_toque: 15 });
    expect(rows[0].pct).toBe(0.5); // 15/30
    expect(rows[1].pct).toBe(0); // temperatura ausente → 0
  });
  it("clampa acima do máximo e ignora negativo/lixo", () => {
    const rows = scoreBreakdownRows({ temperatura: 999, progresso: -5, engajamento: "x" as unknown as number });
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    expect(byKey.temperatura).toBe(20); // clamp no máx
    expect(byKey.progresso).toBe(0); // negativo → 0
    expect(byKey.engajamento).toBe(0); // NaN → 0
  });
  it("breakdown null → todos 0, mas as 5 linhas existem", () => {
    const rows = scoreBreakdownRows(null);
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.value === 0)).toBe(true);
    expect(rows.map((r) => r.key)).toEqual(SCORE_FACTORS.map((f) => f.key));
  });
});
