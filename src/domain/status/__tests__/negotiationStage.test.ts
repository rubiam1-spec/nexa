import { describe, it, expect } from "vitest";
import { deriveNegotiationStage } from "../negotiationStage";
import { NegotiationStatus } from "../negotiation";
import { ProposalStatus } from "../proposal";
import { ReservationStatus } from "../reservation";
import { SaleStatus } from "../sale";

const empty = { proposals: [], reservations: [], sales: [] } as const;

describe("deriveNegotiationStage — regra de estágio (Fase A do Funil)", () => {
  describe("base sem marco", () => {
    it("OPEN sem filhos permanece OPEN (nunca auto-promove)", () => {
      expect(deriveNegotiationStage(NegotiationStatus.OPEN, { ...empty })).toBe(
        NegotiationStatus.OPEN,
      );
    });

    it("IN_PROGRESS sem filhos permanece IN_PROGRESS", () => {
      expect(
        deriveNegotiationStage(NegotiationStatus.IN_PROGRESS, { ...empty }),
      ).toBe(NegotiationStatus.IN_PROGRESS);
    });
  });

  describe("proposta aberta → PROPOSAL", () => {
    for (const p of [
      ProposalStatus.DRAFT,
      ProposalStatus.SENT,
      ProposalStatus.UNDER_ANALYSIS,
      ProposalStatus.COUNTER_PROPOSAL,
    ]) {
      it(`proposta ${p} promove IN_PROGRESS → PROPOSAL`, () => {
        expect(
          deriveNegotiationStage(NegotiationStatus.IN_PROGRESS, {
            ...empty,
            proposals: [p],
          }),
        ).toBe(NegotiationStatus.PROPOSAL);
      });
    }

    it("promove a partir de OPEN também (marco existe)", () => {
      expect(
        deriveNegotiationStage(NegotiationStatus.OPEN, {
          ...empty,
          proposals: [ProposalStatus.SENT],
        }),
      ).toBe(NegotiationStatus.PROPOSAL);
    });

    it("proposta FECHADA (accepted/rejected/expired) NÃO conta como aberta", () => {
      for (const closed of [
        ProposalStatus.ACCEPTED,
        ProposalStatus.REJECTED,
        ProposalStatus.EXPIRED,
      ]) {
        expect(
          deriveNegotiationStage(NegotiationStatus.IN_PROGRESS, {
            ...empty,
            proposals: [closed],
          }),
        ).toBe(NegotiationStatus.IN_PROGRESS);
      }
    });
  });

  describe("reserva ATIVA → RESERVATION", () => {
    it("reserva active promove → RESERVATION", () => {
      expect(
        deriveNegotiationStage(NegotiationStatus.IN_PROGRESS, {
          ...empty,
          reservations: [ReservationStatus.ACTIVE],
        }),
      ).toBe(NegotiationStatus.RESERVATION);
    });

    it("reserva ativa vence proposta aberta (mais avançado)", () => {
      expect(
        deriveNegotiationStage(NegotiationStatus.IN_PROGRESS, {
          ...empty,
          proposals: [ProposalStatus.UNDER_ANALYSIS],
          reservations: [ReservationStatus.ACTIVE],
        }),
      ).toBe(NegotiationStatus.RESERVATION);
    });

    it("reserva NÃO-ativa (cancelled/expired/converted/requested) não promove", () => {
      for (const r of [
        ReservationStatus.CANCELLED,
        ReservationStatus.EXPIRED,
        ReservationStatus.CONVERTED,
        ReservationStatus.REQUESTED,
        ReservationStatus.APPROVED,
      ]) {
        expect(
          deriveNegotiationStage(NegotiationStatus.IN_PROGRESS, {
            ...empty,
            reservations: [r],
          }),
        ).toBe(NegotiationStatus.IN_PROGRESS);
      }
    });
  });

  describe("venda não-cancelada → WON", () => {
    for (const s of [
      SaleStatus.CREATED,
      SaleStatus.AWAITING_DOCUMENTS,
      SaleStatus.AWAITING_CONTRACT,
      SaleStatus.AWAITING_PAYMENT,
      SaleStatus.COMPLETED,
    ]) {
      it(`venda ${s} → WON`, () => {
        expect(
          deriveNegotiationStage(NegotiationStatus.IN_PROGRESS, {
            ...empty,
            sales: [s],
          }),
        ).toBe(NegotiationStatus.WON);
      });
    }

    it("venda vence reserva ativa e proposta aberta", () => {
      expect(
        deriveNegotiationStage(NegotiationStatus.RESERVATION, {
          proposals: [ProposalStatus.ACCEPTED],
          reservations: [ReservationStatus.ACTIVE],
          sales: [SaleStatus.AWAITING_DOCUMENTS],
        }),
      ).toBe(NegotiationStatus.WON);
    });

    it("venda CANCELADA não conta: cai para o próximo marco (reserva ativa)", () => {
      expect(
        deriveNegotiationStage(NegotiationStatus.WON, {
          ...empty,
          reservations: [ReservationStatus.ACTIVE],
          sales: [SaleStatus.CANCELLED],
        }),
      ).toBe(NegotiationStatus.RESERVATION);
    });

    it("venda cancelada + reserva convertida + proposta aceita → IN_PROGRESS", () => {
      // Caso concreto flagueado: nenhum marco ATIVO restante → regride à base.
      expect(
        deriveNegotiationStage(NegotiationStatus.WON, {
          proposals: [ProposalStatus.ACCEPTED],
          reservations: [ReservationStatus.CONVERTED],
          sales: [SaleStatus.CANCELLED],
        }),
      ).toBe(NegotiationStatus.IN_PROGRESS);
    });
  });

  describe("terminais LOST/CANCELLED nunca são sobrescritos", () => {
    for (const terminal of [
      NegotiationStatus.LOST,
      NegotiationStatus.CANCELLED,
    ]) {
      it(`${terminal} preservado mesmo com venda/reserva/proposta ativas`, () => {
        expect(
          deriveNegotiationStage(terminal, {
            proposals: [ProposalStatus.UNDER_ANALYSIS],
            reservations: [ReservationStatus.ACTIVE],
            sales: [SaleStatus.AWAITING_PAYMENT],
          }),
        ).toBe(terminal);
      });

      it(`${terminal} preservado sem filhos`, () => {
        expect(deriveNegotiationStage(terminal, { ...empty })).toBe(terminal);
      });
    }
  });

  describe("regressão entre marcos", () => {
    it("RESERVATION com reserva cancelada mas proposta aberta → PROPOSAL", () => {
      expect(
        deriveNegotiationStage(NegotiationStatus.RESERVATION, {
          ...empty,
          proposals: [ProposalStatus.UNDER_ANALYSIS],
          reservations: [ReservationStatus.CANCELLED],
        }),
      ).toBe(NegotiationStatus.PROPOSAL);
    });

    it("PROPOSAL com proposta rejeitada e nada mais → IN_PROGRESS (não OPEN)", () => {
      expect(
        deriveNegotiationStage(NegotiationStatus.PROPOSAL, {
          ...empty,
          proposals: [ProposalStatus.REJECTED],
        }),
      ).toBe(NegotiationStatus.IN_PROGRESS);
    });

    it("RESERVATION com tudo terminal → IN_PROGRESS", () => {
      expect(
        deriveNegotiationStage(NegotiationStatus.RESERVATION, {
          proposals: [ProposalStatus.REJECTED],
          reservations: [ReservationStatus.EXPIRED],
          sales: [SaleStatus.CANCELLED],
        }),
      ).toBe(NegotiationStatus.IN_PROGRESS);
    });
  });

  describe("idempotência (mesmo estado de entrada e saída)", () => {
    it("já PROPOSAL com proposta aberta → PROPOSAL", () => {
      expect(
        deriveNegotiationStage(NegotiationStatus.PROPOSAL, {
          ...empty,
          proposals: [ProposalStatus.SENT],
        }),
      ).toBe(NegotiationStatus.PROPOSAL);
    });

    it("já WON com venda ativa → WON", () => {
      expect(
        deriveNegotiationStage(NegotiationStatus.WON, {
          ...empty,
          sales: [SaleStatus.COMPLETED],
        }),
      ).toBe(NegotiationStatus.WON);
    });
  });
});
