import { describe, it, expect, vi } from "vitest";
import { simulationTimelineItems } from "../timelineMerge";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { listSimulationsByClient } from "../../../infra/repositories/pipelineSimulationsSupabaseRepository";

describe("simulationTimelineItems — marco 'Simulação criada · <valor>'", () => {
  it("mapeia valor, autor e created_at (para merge/ordenação)", () => {
    const items = simulationTimelineItems(
      [{ id: "s1", valorTotal: 862500, createdBy: "u1", createdAt: "2026-07-22T15:00:00Z" }],
      (v) => `R$ ${(v / 1000).toFixed(1)}k`,
      (uid) => (uid === "u1" ? "Edilene" : null),
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "sim-s1",
      title: "Simulação criada · R$ 862.5k",
      performed_at: "2026-07-22T15:00:00Z",
      profiles: { name: "Edilene" },
      type: "simulation",
    });
  });

  it("autor desconhecido → profiles null", () => {
    const items = simulationTimelineItems(
      [{ id: "s2", valorTotal: 100, createdBy: null, createdAt: "2026-01-01T00:00:00Z" }],
      (v) => `${v}`,
      () => null,
    );
    expect(items[0].profiles).toBeNull();
  });

  it("lista vazia → []", () => {
    expect(simulationTimelineItems([], (v) => `${v}`, () => null)).toEqual([]);
  });
});

describe("listSimulationsByClient — filtra por client_id + status ativa", () => {
  it("consulta pipeline_simulations com os filtros certos", async () => {
    const eq = vi.fn().mockReturnThis();
    const chain: Record<string, unknown> = {
      select: vi.fn().mockReturnThis(),
      eq,
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const fromSpy = vi.mocked(supabase!.from).mockReturnValueOnce(chain as never);

    await listSimulationsByClient("cli-1");

    expect(fromSpy).toHaveBeenCalledWith("pipeline_simulations");
    expect(eq).toHaveBeenCalledWith("client_id", "cli-1");
    expect(eq).toHaveBeenCalledWith("status", "ativa");
  });
});
