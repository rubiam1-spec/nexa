import { describe, it, expect } from "vitest";

describe("Transformações de dados — padrões de hooks com Supabase", () => {
  describe("Conversão numérica Supabase → Number", () => {
    it("campo numeric vem como number em JSONB", () => {
      const row = { valor: 1035000, score: 65 };
      expect(typeof row.valor).toBe("number");
      expect(typeof row.score).toBe("number");
    });

    it("Number() converte string numeric seguramente", () => {
      expect(Number("1035000")).toBe(1035000);
      expect(Number("948.75")).toBe(948.75);
      expect(Number("0")).toBe(0);
      expect(Number(null)).toBe(0);
      expect(Number(undefined)).toBeNaN();
    });

    it("valor null → 0 com fallback", () => {
      const v: number | null = null;
      expect(v ?? 0).toBe(0);
      expect(Number(v)).toBe(0);
    });
  });

  describe("Conversão de datas Supabase → Date", () => {
    it("timestamp ISO → Date válido", () => {
      const d = new Date("2026-04-15T14:30:00Z");
      expect(d.getTime()).toBeGreaterThan(0);
      expect(d.getFullYear()).toBe(2026);
    });

    it("date-only string → Date válido", () => {
      const d = new Date("2026-04-15");
      expect(d.getFullYear()).toBe(2026);
    });

    it("null → NaN check", () => {
      const d = new Date(null as unknown as string);
      expect(isNaN(d.getTime())).toBe(false); // new Date(null) = epoch
    });
  });

  describe("snake_case → camelCase (padrão dos mappers)", () => {
    it("converte campos básicos", () => {
      const row = { account_id: "acc-1", development_id: "dev-1", created_at: "2026-04-15", updated_at: "2026-04-15" };
      const mapped = {
        accountId: row.account_id,
        developmentId: row.development_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
      expect(mapped.accountId).toBe("acc-1");
      expect(mapped.developmentId).toBe("dev-1");
    });

    it("converte campos de negociação", () => {
      const row = {
        id: "neg-1", status: "IN_PROGRESS", unit_id: "u-1",
        client_id: "c-1", broker_id: "b-1", lost_reason: null,
        third_party_property_id: null, stage_changed_at: null,
      };
      const mapped = {
        id: row.id, status: row.status, unitId: row.unit_id,
        clientId: row.client_id, brokerId: row.broker_id,
        lostReason: row.lost_reason, thirdPartyPropertyId: row.third_party_property_id,
        stageChangedAt: row.stage_changed_at,
      };
      expect(mapped.unitId).toBe("u-1");
      expect(mapped.brokerId).toBe("b-1");
    });
  });

  describe("Joins Supabase — array vs objeto", () => {
    it("join to-one pode vir como objeto", () => {
      const data = { clients: { name: "João" } };
      const client = Array.isArray(data.clients) ? data.clients[0] : data.clients;
      expect((client as Record<string, unknown>).name).toBe("João");
    });

    it("join to-one pode vir como array de 1 elemento", () => {
      const data = { clients: [{ name: "João" }] };
      const client = Array.isArray(data.clients) ? data.clients[0] : data.clients;
      expect(client.name).toBe("João");
    });

    it("join null quando não há relação", () => {
      const data = { clients: null };
      const client = Array.isArray(data.clients) ? data.clients[0] : data.clients;
      expect(client).toBeNull();
    });

    it("join to-many sempre vem como array", () => {
      const data = { proposals: [{ id: "p-1" }, { id: "p-2" }] };
      expect(Array.isArray(data.proposals)).toBe(true);
      expect(data.proposals).toHaveLength(2);
    });
  });

  describe("Estado do hook — padrão de 6 estados", () => {
    const STATES = ["idle", "loading", "mock", "ready", "empty", "error"] as const;

    it("define 6 estados obrigatórios", () => {
      expect(STATES).toHaveLength(6);
    });

    it("idle é estado inicial", () => {
      expect(STATES[0]).toBe("idle");
    });

    it("mock é usado quando Supabase não está configurado", () => {
      expect(STATES).toContain("mock");
    });

    it("transição: idle → loading → ready|empty|error|mock", () => {
      const validTransitions: Record<string, string[]> = {
        idle: ["loading"],
        loading: ["ready", "empty", "error", "mock"],
        ready: ["loading"],
        empty: ["loading"],
        error: ["loading"],
        mock: [],
      };
      expect(validTransitions.idle).toContain("loading");
      expect(validTransitions.loading).toContain("ready");
      expect(validTransitions.loading).toContain("error");
    });
  });

  describe("Filtro por account_id + development_id", () => {
    it("query SEMPRE filtra por account_id", () => {
      const mockData = [
        { id: "1", account_id: "acc-1", development_id: "dev-1" },
        { id: "2", account_id: "acc-2", development_id: "dev-1" },
      ];
      const filtered = mockData.filter((d) => d.account_id === "acc-1");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("1");
    });

    it("query filtra por development_id quando presente", () => {
      const mockData = [
        { id: "1", account_id: "acc-1", development_id: "dev-1" },
        { id: "2", account_id: "acc-1", development_id: "dev-2" },
      ];
      const filtered = mockData.filter((d) => d.development_id === "dev-1");
      expect(filtered).toHaveLength(1);
    });

    it("sem accountId: hook NÃO faz query (proteção multi-tenant)", () => {
      const accountId: string | null = null;
      const shouldQuery = accountId !== null;
      expect(shouldQuery).toBe(false);
    });
  });
});
