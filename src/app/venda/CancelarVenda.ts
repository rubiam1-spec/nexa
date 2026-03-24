import { SaleService } from "../../domain/venda/SaleService";
import { SaleStatus } from "../../domain/venda/SaleStatus";
import type { Sale } from "../../shared/types/sale";
import { InvalidSaleTransitionError } from "./errors/InvalidSaleTransitionError";

export function cancelarVenda(sale: Sale) {
  if (!SaleService.podeCancelar(sale)) {
    throw new InvalidSaleTransitionError(
      "A venda nao pode ser cancelada a partir do status atual.",
    );
  }

  return SaleService.alterarStatus(sale, SaleStatus.CANCELLED);
}
