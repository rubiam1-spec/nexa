import { SaleStatus, type SaleStatus as SaleStatusType } from "./SaleStatus";

export function getSaleStatusLabel(status: SaleStatusType) {
  switch (status) {
    case SaleStatus.CREATED:
      return "Criada";
    case SaleStatus.AWAITING_DOCUMENTS:
      return "Aguardando Documentação";
    case SaleStatus.AWAITING_CONTRACT:
      return "Aguardando Contrato";
    case SaleStatus.AWAITING_PAYMENT:
      return "Aguardando Pagamento";
    case SaleStatus.COMPLETED:
      return "Concluída";
    case SaleStatus.CANCELLED:
      return "Cancelada";
    default:
      return status;
  }
}
