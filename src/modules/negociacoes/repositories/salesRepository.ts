import type { Sale } from "../../../shared/types/sale";
import { salesMock } from "../mocks/salesMock";

export function getSalesByNegotiation(negotiationId: string) {
  return salesMock
    .filter((sale) => sale.negotiationId === negotiationId)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

export function getSales(accountId: string, developmentId: string) {
  return salesMock
    .filter(
      (sale) =>
        sale.accountId === accountId && sale.developmentId === developmentId,
    )
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

export function createSale(input: {
  negotiationId: string;
  reservationId: string;
  proposalId: string;
  accountId: string;
  developmentId: string;
  unitId: string;
  amount: number;
  status: Sale["status"];
  createdBy: string | null;
}) {
  const sale: Sale = {
    id: `sale_${crypto.randomUUID()}`,
    negotiationId: input.negotiationId,
    reservationId: input.reservationId,
    proposalId: input.proposalId,
    accountId: input.accountId,
    developmentId: input.developmentId,
    unitId: input.unitId,
    amount: input.amount,
    status: input.status,
    createdBy: input.createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  salesMock.unshift(sale);

  return sale;
}

export function updateSaleStatus(
  saleId: string,
  status: Sale["status"],
) {
  const sale = salesMock.find((item) => item.id === saleId);

  if (!sale) {
    throw new Error("Sale not found in mock repository.");
  }

  sale.status = status;
  sale.updatedAt = new Date();

  return sale;
}
