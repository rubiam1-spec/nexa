import { SaleService } from "../../domain/venda/SaleService";
import { SaleStatus } from "../../domain/venda/SaleStatus";
import type { Sale } from "../../shared/types/sale";
import { InvalidSaleTransitionError } from "./errors/InvalidSaleTransitionError";

export function concluirVenda(sale: Sale) {
  if (!SaleService.podeConcluir(sale)) {
    throw new InvalidSaleTransitionError(
      "A venda nao pode ser concluida a partir do status atual.",
    );
  }

  return SaleService.alterarStatus(sale, SaleStatus.COMPLETED);
}
