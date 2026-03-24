import type { Sale } from "../../shared/types/sale";
import { SaleStatus } from "./SaleStatus";

export class SaleService {
  static podeAvancarParaDocumentos(sale: Sale) {
    return sale.status === SaleStatus.CREATED;
  }

  static podeAvancarParaContrato(sale: Sale) {
    return sale.status === SaleStatus.AWAITING_DOCUMENTS;
  }

  static podeAvancarParaPagamento(sale: Sale) {
    return sale.status === SaleStatus.AWAITING_CONTRACT;
  }

  static podeConcluir(sale: Sale) {
    return sale.status === SaleStatus.AWAITING_PAYMENT;
  }

  static podeCancelar(sale: Sale) {
    return (
      sale.status === SaleStatus.CREATED ||
      sale.status === SaleStatus.AWAITING_DOCUMENTS ||
      sale.status === SaleStatus.AWAITING_CONTRACT ||
      sale.status === SaleStatus.AWAITING_PAYMENT
    );
  }

  static alterarStatus(sale: Sale, status: Sale["status"]): Sale {
    return {
      ...sale,
      status,
      updatedAt: new Date(),
    };
  }
}
