// N2 · testes do toque canônico (lastTouch).
import { describe, it, expect } from "vitest";
import { computeLastTouch, activityTouchMs, resolveLastTouch } from "../lastTouch";

const NOW = new Date("2026-07-30T12:00:00Z").getTime();

describe("activityTouchMs — só CONCLUÍDA conta, clampada em now", () => {
  it("completed → momento por activity_date (+start_time ou 12:00)", () => {
    const ms = activityTouchMs({ status: "completed", activityDate: "2026-07-20", startTime: "09:30" }, NOW);
    expect(ms).toBe(new Date("2026-07-20T09:30:00").getTime());
  });
  it("completed sem start_time → 12:00", () => {
    const ms = activityTouchMs({ status: "completed", activityDate: "2026-07-20" }, NOW);
    expect(ms).toBe(new Date("2026-07-20T12:00:00").getTime());
  });
  it("scheduled/pendente → null (NÃO conta)", () => {
    expect(activityTouchMs({ status: "scheduled", activityDate: "2026-07-20" }, NOW)).toBeNull();
    expect(activityTouchMs({ status: "skipped", activityDate: "2026-07-20" }, NOW)).toBeNull();
  });
  it("completed no futuro → clampada em now (não inventa futuro)", () => {
    const ms = activityTouchMs({ status: "completed", activityDate: "2027-01-01", startTime: "10:00" }, NOW);
    expect(ms).toBe(NOW);
  });
});

describe("computeLastTouch — max(interações, atividades concluídas)", () => {
  it("atividade CONCLUÍDA conta como toque", () => {
    const iso = computeLastTouch([], [{ status: "completed", activityDate: "2026-07-25" }], NOW);
    expect(iso).toBe(new Date("2026-07-25T12:00:00").toISOString());
  });
  it("atividade PENDENTE não move nada", () => {
    const iso = computeLastTouch(
      [{ performedAt: "2026-07-10T08:00:00Z" }],
      [{ status: "scheduled", activityDate: "2026-07-28" }],
      NOW,
    );
    expect(iso).toBe("2026-07-10T08:00:00.000Z"); // a pendente de 28 é ignorada
  });
  it("pega o MAIS RECENTE entre interação e atividade concluída", () => {
    const iso = computeLastTouch(
      [{ performedAt: "2026-07-10T08:00:00Z" }],
      [{ status: "completed", activityDate: "2026-07-26", startTime: "15:00" }],
      NOW,
    );
    expect(iso).toBe(new Date("2026-07-26T15:00:00").toISOString());
  });
  it("interação mais recente que a atividade → vence", () => {
    const iso = computeLastTouch(
      [{ performedAt: "2026-07-28T20:00:00Z" }],
      [{ status: "completed", activityDate: "2026-07-26" }],
      NOW,
    );
    expect(iso).toBe("2026-07-28T20:00:00.000Z");
  });
  it("sem toque → null", () => {
    expect(computeLastTouch([], [], NOW)).toBeNull();
    expect(computeLastTouch([{ performedAt: null }], [{ status: "scheduled", activityDate: "2026-07-20" }], NOW)).toBeNull();
  });
});

describe("resolveLastTouch — GREATEST(coluna, local), nunca retrocede", () => {
  it("coluna vazia → usa o local", () => {
    expect(resolveLastTouch(null, "2026-07-25T12:00:00.000Z")).toBe("2026-07-25T12:00:00.000Z");
  });
  it("local mais novo que a coluna → reflete na hora (local vence)", () => {
    expect(resolveLastTouch("2026-07-20T00:00:00Z", "2026-07-26T00:00:00.000Z")).toBe("2026-07-26T00:00:00.000Z");
  });
  it("coluna mais nova → mantém a coluna (não retrocede para o local antigo)", () => {
    expect(resolveLastTouch("2026-07-28T00:00:00Z", "2026-07-20T00:00:00.000Z")).toBe("2026-07-28T00:00:00Z");
  });
  it("local nulo → coluna", () => {
    expect(resolveLastTouch("2026-07-28T00:00:00Z", null)).toBe("2026-07-28T00:00:00Z");
  });
});
