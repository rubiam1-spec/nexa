import { describe, it, expect } from "vitest";
import { bulkBlockReasonLabel, bulkStatusErrorLabel } from "../bulkStatusReason";

describe("bulkStatusReason — mapa PT-BR (fonte única)", () => {
  it("traduz as 7 razões de bloqueio", () => {
    expect(bulkBlockReasonLabel("active_reservation")).toBe("Reserva ativa — trate pela reserva");
    expect(bulkBlockReasonLabel("sale_recorded")).toBe("Venda registrada — trate pela venda");
    expect(bulkBlockReasonLabel("live_negotiation")).toBe("Negociação viva — trate pela negociação");
    expect(bulkBlockReasonLabel("won_negotiation_linked")).toBe("Vinculada a negociação vendida — ajuste pela negociação para manter a consistência");
    expect(bulkBlockReasonLabel("already_in_status")).toBe("Já está neste status");
    expect(bulkBlockReasonLabel("forbidden")).toBe("Sem permissão para esta unidade");
    expect(bulkBlockReasonLabel("not_found")).toBe("Unidade não encontrada");
  });

  it("razão desconhecida cai no próprio código (sem quebrar)", () => {
    expect(bulkBlockReasonLabel("weird_reason")).toBe("weird_reason");
  });

  it("traduz as exceptions do RPC", () => {
    expect(bulkStatusErrorLabel("reason_required")).toBe("Informe um motivo (mínimo 5 caracteres).");
    expect(bulkStatusErrorLabel("invalid_batch_size")).toBe("Seleção acima do limite de 200 unidades.");
    expect(bulkStatusErrorLabel("invalid_status")).toBe("Status de destino inválido.");
    expect(bulkStatusErrorLabel("not_authenticated")).toBe("Sessão expirada. Faça login novamente.");
    expect(bulkStatusErrorLabel("algo inesperado")).toBe("Não foi possível alterar o status. Tente novamente.");
  });
});
