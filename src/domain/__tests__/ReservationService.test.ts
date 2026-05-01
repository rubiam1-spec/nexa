import { describe, it, expect } from "vitest";
import { ReservationService } from "../reserva/ReservationService";
import { ReservationStatus } from "../reserva/ReservationStatus";
import type { ReservationRequest } from "../../shared/types/reservationRequest";
import type { Reservation } from "../../shared/types/reservation";

function makeReq(status: ReservationRequest["status"]): ReservationRequest {
  return {
    id: "req-1", negotiationId: "neg-1", proposalId: "prop-1",
    accountId: "acc-1", developmentId: "dev-1", unitId: "unit-1",
    status, requestedBy: "user-1", createdAt: new Date(), updatedAt: new Date(),
  };
}

function makeRes(status: Reservation["status"]): Reservation {
  return {
    id: "res-1", reservationRequestId: "req-1", negotiationId: "neg-1",
    accountId: "acc-1", developmentId: "dev-1", unitId: "unit-1",
    status, startedAt: new Date(), expiresAt: new Date(Date.now() + 72 * 3600000),
    createdAt: new Date(), updatedAt: new Date(),
  };
}

describe("ReservationStatus — constantes", () => {
  it("define 7 estados", () => {
    expect(Object.values(ReservationStatus)).toHaveLength(7);
  });
});

describe("ReservationService — Solicitações", () => {
  describe("podeAprovarSolicitacao", () => {
    it("REQUESTED pode aprovar", () => expect(ReservationService.podeAprovarSolicitacao(makeReq("REQUESTED"))).toBe(true));
    it("APPROVED NÃO pode", () => expect(ReservationService.podeAprovarSolicitacao(makeReq("APPROVED"))).toBe(false));
    it("REJECTED NÃO pode", () => expect(ReservationService.podeAprovarSolicitacao(makeReq("REJECTED"))).toBe(false));
  });

  describe("podeRecusarSolicitacao", () => {
    it("REQUESTED pode recusar", () => expect(ReservationService.podeRecusarSolicitacao(makeReq("REQUESTED"))).toBe(true));
    it("APPROVED NÃO pode", () => expect(ReservationService.podeRecusarSolicitacao(makeReq("APPROVED"))).toBe(false));
  });

  describe("podeCancelarSolicitacao", () => {
    it("REQUESTED pode cancelar", () => expect(ReservationService.podeCancelarSolicitacao(makeReq("REQUESTED"))).toBe(true));
    it("ACTIVE NÃO pode cancelar solicitação", () => expect(ReservationService.podeCancelarSolicitacao(makeReq("ACTIVE"))).toBe(false));
  });

  describe("alterarStatusSolicitacao", () => {
    it("muda status sem mutar", () => {
      const r = makeReq("REQUESTED");
      const u = ReservationService.alterarStatusSolicitacao(r, "APPROVED");
      expect(u.status).toBe("APPROVED");
      expect(r.status).toBe("REQUESTED");
    });
  });
});

describe("ReservationService — Reservas", () => {
  describe("podeCancelarReserva", () => {
    it("ACTIVE pode cancelar", () => expect(ReservationService.podeCancelarReserva(makeRes("ACTIVE"))).toBe(true));
    it("CANCELLED NÃO pode", () => expect(ReservationService.podeCancelarReserva(makeRes("CANCELLED"))).toBe(false));
    it("CONVERTED NÃO pode", () => expect(ReservationService.podeCancelarReserva(makeRes("CONVERTED"))).toBe(false));
    it("EXPIRED NÃO pode", () => expect(ReservationService.podeCancelarReserva(makeRes("EXPIRED"))).toBe(false));
  });

  describe("podeExpirarReserva", () => {
    it("ACTIVE pode expirar", () => expect(ReservationService.podeExpirarReserva(makeRes("ACTIVE"))).toBe(true));
    it("EXPIRED NÃO pode", () => expect(ReservationService.podeExpirarReserva(makeRes("EXPIRED"))).toBe(false));
  });

  describe("alterarStatusReserva", () => {
    it("muda status sem mutar", () => {
      const r = makeRes("ACTIVE");
      const u = ReservationService.alterarStatusReserva(r, "CANCELLED");
      expect(u.status).toBe("CANCELLED");
      expect(r.status).toBe("ACTIVE");
    });
  });
});
