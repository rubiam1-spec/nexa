import { SaleService } from "../../domain/venda/SaleService";
import { SaleStatus } from "../../domain/venda/SaleStatus";
import type { Sale } from "../../shared/types/sale";
import { InvalidSaleTransitionError } from "./errors/InvalidSaleTransitionError";

export function avancarVendaParaPagamento(sale: Sale) {
  if (!SaleService.podeAvancarParaPagamento(sale)) {
    throw new InvalidSaleTransitionError(
      "A venda nao pode avancar para pagamento a partir do status atual.",
    );
  }

  return SaleService.alterarStatus(sale, SaleStatus.AWAITING_PAYMENT);
}
