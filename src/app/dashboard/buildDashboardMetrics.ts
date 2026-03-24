import { NegotiationStatus } from "../../domain/negociacao/NegotiationStatus";
import { ProposalStatus } from "../../domain/proposta/ProposalStatus";
import { ReservationStatus } from "../../domain/reserva/ReservationStatus";
import { SaleStatus } from "../../domain/venda/SaleStatus";
import { UnidadeStatus } from "../../domain/unidade/UnidadeStatus";
import type { Negotiation } from "../../shared/types/negotiation";
import type { Proposal } from "../../shared/types/proposal";
import type { Reservation } from "../../shared/types/reservation";
import type { ReservationRequest } from "../../shared/types/reservationRequest";
import type { Sale } from "../../shared/types/sale";
import type { Unidade } from "../../domain/unidade/Unidade";

export type DashboardMetrics = {
  negotiationsActive: number;
  proposalsByStatus: Record<Proposal["status"], number>;
  salesByStatus: Record<Sale["status"], number>;
  activeReservations: number;
  completedSales: number;
  unitsByStatus: Record<Unidade["status"], number>;
  vgv: {
    emNegociacao: number;
    reservado: number;
    vendido: number;
  };
  funnel: {
    negotiation: number;
    proposal: number;
    reservation: number;
    sale: number;
  };
  alerts: {
    expiredReservations: Reservation[];
    reservationsExpiringSoon: Reservation[];
    staleNegotiations: Negotiation[];
  };
};

export function buildDashboardMetrics(input: {
  negotiations: Negotiation[];
  proposals: Proposal[];
  reservationRequests: ReservationRequest[];
  reservations: Reservation[];
  sales: Sale[];
  units: Unidade[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const threeDaysFromNow = new Date(now);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const negotiationsActive = input.negotiations.filter(
    (negotiation) =>
      negotiation.status === NegotiationStatus.OPEN ||
      negotiation.status === NegotiationStatus.IN_PROGRESS,
  ).length;

  const proposalsByStatus: Record<Proposal["status"], number> = {
    [ProposalStatus.DRAFT]: 0,
    [ProposalStatus.SENT]: 0,
    [ProposalStatus.UNDER_ANALYSIS]: 0,
    [ProposalStatus.ACCEPTED]: 0,
    [ProposalStatus.REJECTED]: 0,
    [ProposalStatus.EXPIRED]: 0,
  };

  input.proposals.forEach((proposal) => {
    proposalsByStatus[proposal.status] += 1;
  });

  const salesByStatus: Record<Sale["status"], number> = {
    [SaleStatus.CREATED]: 0,
    [SaleStatus.AWAITING_DOCUMENTS]: 0,
    [SaleStatus.AWAITING_CONTRACT]: 0,
    [SaleStatus.AWAITING_PAYMENT]: 0,
    [SaleStatus.COMPLETED]: 0,
    [SaleStatus.CANCELLED]: 0,
  };

  input.sales.forEach((sale) => {
    salesByStatus[sale.status] += 1;
  });

  const activeReservations = input.reservations.filter(
    (reservation) => reservation.status === ReservationStatus.ACTIVE,
  ).length;

  const completedSales = input.sales.filter(
    (sale) => sale.status === SaleStatus.COMPLETED,
  ).length;

  const unitsByStatus: Record<Unidade["status"], number> = {
    [UnidadeStatus.DISPONIVEL]: 0,
    [UnidadeStatus.EM_NEGOCIACAO]: 0,
    [UnidadeStatus.RESERVADO]: 0,
    [UnidadeStatus.VENDIDO]: 0,
  };

  input.units.forEach((unit) => {
    unitsByStatus[unit.status] += 1;
  });

  const vgv = input.units.reduce(
    (accumulator, unit) => {
      if (unit.status === UnidadeStatus.EM_NEGOCIACAO) {
        accumulator.emNegociacao += unit.valor;
      }

      if (unit.status === UnidadeStatus.RESERVADO) {
        accumulator.reservado += unit.valor;
      }

      if (unit.status === UnidadeStatus.VENDIDO) {
        accumulator.vendido += unit.valor;
      }

      return accumulator;
    },
    {
      emNegociacao: 0,
      reservado: 0,
      vendido: 0,
    },
  );

  const funnel = {
    negotiation: negotiationsActive,
    proposal: input.proposals.filter((proposal) => {
      switch (proposal.status) {
        case ProposalStatus.DRAFT:
        case ProposalStatus.SENT:
        case ProposalStatus.UNDER_ANALYSIS:
        case ProposalStatus.ACCEPTED:
          return true;
        case ProposalStatus.REJECTED:
        case ProposalStatus.EXPIRED:
          return false;
      }
    }).length,
    reservation: activeReservations,
    sale: completedSales,
  };

  const alerts = {
    expiredReservations: input.reservations.filter(
      (reservation) => reservation.status === ReservationStatus.EXPIRED,
    ),
    reservationsExpiringSoon: input.reservations.filter(
      (reservation) =>
        reservation.status === ReservationStatus.ACTIVE &&
        reservation.expiresAt instanceof Date &&
        reservation.expiresAt >= now &&
        reservation.expiresAt <= threeDaysFromNow,
    ),
    staleNegotiations: input.negotiations.filter(
      (negotiation) =>
        (negotiation.status === NegotiationStatus.OPEN ||
          negotiation.status === NegotiationStatus.IN_PROGRESS) &&
        negotiation.updatedAt instanceof Date &&
        negotiation.updatedAt < sevenDaysAgo,
    ),
  };

  return {
    negotiationsActive,
    proposalsByStatus,
    salesByStatus,
    activeReservations,
    completedSales,
    unitsByStatus,
    vgv,
    funnel,
    alerts,
  } satisfies DashboardMetrics;
}
