import { describe, it, expect } from "vitest";
import { briefingFreshness } from "../briefingFreshness";

const NOW = Date.parse("2026-07-21T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const H = 60 * 60 * 1000;
const MIN = 60 * 1000;

describe("briefingFreshness — frescor do briefing IA (>48h = desatualizado)", () => {
  it("recém-gerado (2h) não é stale e mostra 'há 2h'", () => {
    expect(briefingFreshness(ago(2 * H), NOW)).toEqual({ isStale: false, relative: "há 2h" });
  });

  it("30 min → 'há 30 min', não stale", () => {
    expect(briefingFreshness(ago(30 * MIN), NOW)).toEqual({ isStale: false, relative: "há 30 min" });
  });

  it("menos de 1 min → 'agora'", () => {
    expect(briefingFreshness(ago(10_000), NOW).relative).toBe("agora");
  });

  it("24h → 'ontem'", () => {
    expect(briefingFreshness(ago(24 * H), NOW).relative).toBe("ontem");
  });

  it("47h ainda não é stale", () => {
    expect(briefingFreshness(ago(47 * H), NOW).isStale).toBe(false);
  });

  it("49h é stale e mostra 'há 2 dias'", () => {
    expect(briefingFreshness(ago(49 * H), NOW)).toEqual({ isStale: true, relative: "há 2 dias" });
  });

  it("timestamp inválido → stale com relative '—'", () => {
    expect(briefingFreshness("not-a-date", NOW)).toEqual({ isStale: true, relative: "—" });
  });
});
