import { describe, it, expect } from "vitest";
import {
  buildStaleDigest,
  shouldSuppressStale,
  STALE_COOLDOWN_DAYS,
  type StaleNegotiation,
} from "../staleDigest";

const DAY = 86_400_000;
const NOW = new Date("2026-07-11T12:00:00Z").getTime();
const daysAgo = (d: number) => new Date(NOW - d * DAY).toISOString();

describe("buildStaleDigest — UMA notificação consolidada (fim da rajada)", () => {
  it("consolida N e aponta a mais antiga com assunto", () => {
    const negs: StaleNegotiation[] = [
      { id: "n1", updatedAt: daysAgo(3), clientName: "Ana", quadra: 1, lote: 2 },
      { id: "n2", updatedAt: daysAgo(9), clientName: "Bruno", quadra: 4, lote: 14 },
      { id: "n3", updatedAt: daysAgo(5), clientName: "Carla" },
    ];
    const d = buildStaleDigest(negs, NOW)!;
    expect(d.count).toBe(3);
    expect(d.oldestDays).toBe(9);
    expect(d.message).toBe("3 negociações paradas — a mais antiga há 9d (Bruno · Q4·L14).");
  });

  it("singular quando há 1", () => {
    const d = buildStaleDigest([{ id: "n1", updatedAt: daysAgo(2), clientName: "Ana" }], NOW)!;
    expect(d.message).toBe("1 negociação parada — a mais antiga há 2d (Ana).");
  });

  it("a mais antiga sem cliente e sem unidade cai no código da negociação (nunca '()')", () => {
    const d = buildStaleDigest([{ id: "abcdef123456", updatedAt: daysAgo(12), clientName: null }], NOW)!;
    expect(d.message).toBe("1 negociação parada — a mais antiga há 12d (Negociação #abcdef12).");
    expect(d.message).not.toMatch(/\(\s*\)/);
  });

  it("lista vazia → null (nada a notificar)", () => {
    expect(buildStaleDigest([], NOW)).toBeNull();
  });
});

describe("shouldSuppressStale — não recriar enquanto não lido + cooldown 7d", () => {
  it("sem histórico → não suprime (cria)", () => {
    expect(shouldSuppressStale(null, NOW)).toBe(false);
  });
  it("existe NÃO LIDO → suprime (fim da metralhadora)", () => {
    expect(shouldSuppressStale({ read: false, created_at: daysAgo(30) }, NOW)).toBe(true);
  });
  it("lido mas dentro do cooldown (6 dias) → suprime", () => {
    expect(shouldSuppressStale({ read: true, created_at: daysAgo(6) }, NOW)).toBe(true);
  });
  it("lido e além do cooldown (8 dias) → não suprime (pode re-notificar)", () => {
    expect(shouldSuppressStale({ read: true, created_at: daysAgo(8) }, NOW)).toBe(false);
  });
  it("cooldown é de 7 dias (constante documentada)", () => {
    expect(STALE_COOLDOWN_DAYS).toBe(7);
    expect(shouldSuppressStale({ read: true, created_at: daysAgo(7.01) }, NOW)).toBe(false);
    expect(shouldSuppressStale({ read: true, created_at: daysAgo(6.99) }, NOW)).toBe(true);
  });
});
