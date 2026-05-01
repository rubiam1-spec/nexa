import { describe, it, expect } from "vitest";
import { SaleService } from "../venda/SaleService";
import { SaleStatus } from "../venda/SaleStatus";
import type { Sale } from "../../shared/types/sale";

function makeSale(status: Sale["status"]): Sale {
  return {
    id: "sale-1", negotiationId: "neg-1", reservationId: "res-1",
    proposalId: "prop-1", accountId: "acc-1", developmentId: "dev-1",
    unitId: "unit-1", amount: 1035000, status,
    createdBy: "user-1", createdAt: new Date(), updatedAt: new Date(),
  };
}

describe("SaleStatus — constantes", () => {
  it("define 6 estados", () => {
    expect(Object.values(SaleStatus)).toHaveLength(6);
  });
});

describe("SaleService — fluxo de documentação", () => {
  it("CREATED → pode avançar para documentos", () => {
    expect(SaleService.podeAvancarParaDocumentos(makeSale("CREATED"))).toBe(true);
  });
  it("AWAITING_DOCUMENTS → pode avançar para contrato", () => {
    expect(SaleService.podeAvancarParaContrato(makeSale("AWAITING_DOCUMENTS"))).toBe(true);
  });
  it("AWAITING_CONTRACT → pode avançar para pagamento", () => {
    expect(SaleService.podeAvancarParaPagamento(makeSale("AWAITING_CONTRACT"))).toBe(true);
  });
  it("AWAITING_PAYMENT → pode concluir", () => {
    expect(SaleService.podeConcluir(makeSale("AWAITING_PAYMENT"))).toBe(true);
  });

  it("CREATED NÃO pode concluir diretamente", () => {
    expect(SaleService.podeConcluir(makeSale("CREATED"))).toBe(false);
  });
  it("AWAITING_DOCUMENTS NÃO pode concluir", () => {
    expect(SaleService.podeConcluir(makeSale("AWAITING_DOCUMENTS"))).toBe(false);
  });
  it("COMPLETED NÃO pode avançar", () => {
    expect(SaleService.podeAvancarParaDocumentos(makeSale("COMPLETED"))).toBe(false);
    expect(SaleService.podeAvancarParaContrato(makeSale("COMPLETED"))).toBe(false);
    expect(SaleService.podeAvancarParaPagamento(makeSale("COMPLETED"))).toBe(false);
    expect(SaleService.podeConcluir(makeSale("COMPLETED"))).toBe(false);
  });
});

describe("SaleService — cancelamento", () => {
  it("CREATED pode cancelar", () => expect(SaleService.podeCancelar(makeSale("CREATED"))).toBe(true));
  it("AWAITING_DOCUMENTS pode cancelar", () => expect(SaleService.podeCancelar(makeSale("AWAITING_DOCUMENTS"))).toBe(true));
  it("AWAITING_CONTRACT pode cancelar", () => expect(SaleService.podeCancelar(makeSale("AWAITING_CONTRACT"))).toBe(true));
  it("AWAITING_PAYMENT pode cancelar", () => expect(SaleService.podeCancelar(makeSale("AWAITING_PAYMENT"))).toBe(true));
  it("COMPLETED NÃO pode cancelar", () => expect(SaleService.podeCancelar(makeSale("COMPLETED"))).toBe(false));
  it("CANCELLED NÃO pode cancelar", () => expect(SaleService.podeCancelar(makeSale("CANCELLED"))).toBe(false));
});

describe("SaleService — alterarStatus", () => {
  it("muda status sem mutar", () => {
    const s = makeSale("CREATED");
    const u = SaleService.alterarStatus(s, "AWAITING_DOCUMENTS");
    expect(u.status).toBe("AWAITING_DOCUMENTS");
    expect(s.status).toBe("CREATED");
  });
});

describe("Fluxo completo de venda", () => {
  it("CREATED → DOCS → CONTRATO → PAGAMENTO → COMPLETED", () => {
    let s = makeSale("CREATED");
    expect(SaleService.podeAvancarParaDocumentos(s)).toBe(true);
    s = SaleService.alterarStatus(s, "AWAITING_DOCUMENTS");
    expect(SaleService.podeAvancarParaContrato(s)).toBe(true);
    s = SaleService.alterarStatus(s, "AWAITING_CONTRACT");
    expect(SaleService.podeAvancarParaPagamento(s)).toBe(true);
    s = SaleService.alterarStatus(s, "AWAITING_PAYMENT");
    expect(SaleService.podeConcluir(s)).toBe(true);
    s = SaleService.alterarStatus(s, "COMPLETED");
    expect(SaleService.podeCancelar(s)).toBe(false);
  });
});
