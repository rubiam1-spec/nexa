import { SaleService } from "../../domain/venda/SaleService";
import { SaleStatus } from "../../domain/venda/SaleStatus";
import type { Sale } from "../../shared/types/sale";
import { InvalidSaleTransitionError } from "./errors/InvalidSaleTransitionError";

export function avancarVendaParaContrato(sale: Sale) {
  if (!SaleService.podeAvancarParaContrato(sale)) {
    throw new InvalidSaleTransitionError(
      "A venda nao pode avancar para contrato a partir do status atual.",
    );
  }

  return SaleService.alterarStatus(sale, SaleStatus.AWAITING_CONTRACT);
}
