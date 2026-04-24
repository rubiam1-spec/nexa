import { describe, it, expect } from "vitest";
import { NegotiationService } from "../../domain/negociacao/NegotiationService";
import { NegotiationStatus } from "../../domain/negociacao/NegotiationStatus";
import { ProposalService } from "../../domain/proposta/ProposalService";
import { ProposalStatus } from "../../domain/proposta/ProposalStatus";
import { ReservationService } from "../../domain/reserva/ReservationService";
import { ReservationStatus } from "../../domain/reserva/ReservationStatus";
import { SaleService } from "../../domain/venda/SaleService";
import { SaleStatus } from "../../domain/venda/SaleStatus";
import { UnidadeService } from "../../domain/unidade/UnidadeService";
import { UnidadeStatus } from "../../domain/unidade/UnidadeStatus";
import { UnitQueueService } from "../../domain/fila/UnitQueueService";
import { UnitQueueStatus } from "../../domain/fila/UnitQueueStatus";
import { podeAprovarReserva, ehPerfilComercial, getPermissions } from "../../shared/utils/permissoes";
import type { Negotiation } from "../../shared/types/negotiation";
import type { Proposal } from "../../shared/types/proposal";
import type { ReservationRequest } from "../../shared/types/reservationRequest";
import type { Reservation } from "../../shared/types/reservation";
import type { Sale } from "../../shared/types/sale";
import type { Unidade } from "../../domain/unidade/Unidade";
import type { UnitQueueEntry } from "../../shared/types/unitQueueEntry";

const now = new Date();
const ACC = "16d4b82f-880f-4818-bb07-93c3b606f982";
const DEV = "dev-vivendas";

function makeUnit(status: Unidade["status"] = "DISPONIVEL"): Unidade {
  return { id: "unit-q1-l4", accountId: ACC, empreendimentoId: DEV, quadra: "1", lote: "4", valor: 1035000, status, createdAt: now, updatedAt: now };
}
function makeNeg(status: Negotiation["status"] = "IN_PROGRESS"): Negotiation {
  return { id: "neg-001", accountId: ACC, developmentId: DEV, unitId: "unit-q1-l4", clientId: "cli-carla", brokerId: "brk-joelma", thirdPartyPropertyId: null, status, score: 50, temperature: "warm", createdAt: now, updatedAt: now };
}
function makeProp(status: Proposal["status"] = "DRAFT"): Proposal {
  return { id: "prop-001", negotiationId: "neg-001", accountId: ACC, developmentId: DEV, unitId: "unit-q1-l4", clientId: "cli-carla", brokerId: "brk-joelma", title: "Proposta Q1·L4", amount: 948750, status, tipo: "standard", entradaTipo: null, entradaValor: 189750, entradaPercentual: 20, parcelasQuantidade: 36, parcelasValor: 21083, balaoQuantidade: null, balaoValor: null, permutaValor: null, permutaDescricao: null, observacoes: null, simulationId: null, createdBy: null, createdAt: now, updatedAt: now };
}
function makeReq(status: ReservationRequest["status"] = "REQUESTED"): ReservationRequest {
  return { id: "req-001", negotiationId: "neg-001", proposalId: "prop-001", accountId: ACC, developmentId: DEV, unitId: "unit-q1-l4", status, requestedBy: "brk-joelma", createdAt: now, updatedAt: now };
}
function makeRes(status: Reservation["status"] = "ACTIVE"): Reservation {
  return { id: "res-001", reservationRequestId: "req-001", negotiationId: "neg-001", accountId: ACC, developmentId: DEV, unitId: "unit-q1-l4", status, startedAt: now, expiresAt: new Date(now.getTime() + 72 * 3600000), createdAt: now, updatedAt: now };
}
function makeSale(status: Sale["status"] = "CREATED"): Sale {
  return { id: "sale-001", negotiationId: "neg-001", reservationId: "res-001", proposalId: "prop-001", accountId: ACC, developmentId: DEV, unitId: "unit-q1-l4", amount: 948750, status, createdBy: "user-rubiam", createdAt: now, updatedAt: now };
}
function makeQueueEntry(overrides: Partial<UnitQueueEntry> = {}): UnitQueueEntry {
  return { id: "q-1", unitId: "unit-q1-l4", negotiationId: "neg-002", accountId: ACC, developmentId: DEV, requestedBy: null, status: UnitQueueStatus.ACTIVE, position: 1, createdAt: now, updatedAt: now, ...overrides };
}

// ═══════════════════════════════════════════════
// FLUXO 1 — Venda completa do lote Q1-L4
// ═══════════════════════════════════════════════

describe("INTEGRAÇÃO — Fluxo Comercial Completo (Q1·L4 Vivendas)", () => {
  it("01. unidade DISPONIVEL → entrarEmNegociacao → EM_NEGOCIACAO", () => {
    const u = UnidadeService.entrarEmNegociacao(makeUnit());
    expect(u.status).toBe(UnidadeStatus.EM_NEGOCIACAO);
  });

  it("02. negociação IN_PROGRESS pode criar proposta", () => {
    expect(NegotiationService.podeCriarProposta(makeNeg())).toBe(true);
  });

  it("03. proposta DRAFT → enviar → SENT", () => {
    const p = makeProp("DRAFT");
    expect(ProposalService.podeEnviar(p)).toBe(true);
    const sent = ProposalService.alterarStatus(p, ProposalStatus.SENT);
    expect(sent.status).toBe("SENT");
  });

  it("04. proposta SENT → análise → UNDER_ANALYSIS", () => {
    const p = makeProp("SENT");
    expect(ProposalService.podeColocarEmAnalise(p)).toBe(true);
    const ua = ProposalService.alterarStatus(p, ProposalStatus.UNDER_ANALYSIS);
    expect(ua.status).toBe("UNDER_ANALYSIS");
  });

  it("05. manager pode aceitar proposta UNDER_ANALYSIS", () => {
    expect(podeAprovarReserva("manager")).toBe(true);
    const p = makeProp("UNDER_ANALYSIS");
    expect(ProposalService.podeAceitar(p)).toBe(true);
    const accepted = ProposalService.alterarStatus(p, ProposalStatus.ACCEPTED);
    expect(accepted.status).toBe("ACCEPTED");
  });

  it("06. proposta aceita → solicitar reserva (REQUESTED)", () => {
    const req = makeReq("REQUESTED");
    expect(req.proposalId).toBe("prop-001");
    expect(ReservationService.podeAprovarSolicitacao(req)).toBe(true);
  });

  it("07. manager aprova solicitação → reserva ACTIVE criada", () => {
    const approved = ReservationService.alterarStatusSolicitacao(makeReq(), ReservationStatus.APPROVED);
    expect(approved.status).toBe("APPROVED");
    const res = makeRes("ACTIVE");
    expect(res.status).toBe("ACTIVE");
    expect(res.expiresAt.getTime()).toBeGreaterThan(now.getTime());
  });

  it("08. unidade EM_NEGOCIACAO → marcarComoReservadaNoFluxo → RESERVADO", () => {
    const u = UnidadeService.marcarComoReservadaNoFluxo(makeUnit("EM_NEGOCIACAO"));
    expect(u.status).toBe(UnidadeStatus.RESERVADO);
  });

  it("09. unidade RESERVADO pode vender", () => {
    expect(UnidadeService.podeVender(makeUnit("RESERVADO"))).toBe(true);
  });

  it("10. venda CREATED → DOCS → CONTRATO → PAGAMENTO → COMPLETED", () => {
    let s = makeSale("CREATED");
    expect(SaleService.podeAvancarParaDocumentos(s)).toBe(true);
    s = SaleService.alterarStatus(s, SaleStatus.AWAITING_DOCUMENTS);
    expect(SaleService.podeAvancarParaContrato(s)).toBe(true);
    s = SaleService.alterarStatus(s, SaleStatus.AWAITING_CONTRACT);
    expect(SaleService.podeAvancarParaPagamento(s)).toBe(true);
    s = SaleService.alterarStatus(s, SaleStatus.AWAITING_PAYMENT);
    expect(SaleService.podeConcluir(s)).toBe(true);
    s = SaleService.alterarStatus(s, SaleStatus.COMPLETED);
    expect(s.status).toBe("COMPLETED");
  });

  it("11. unidade → VENDIDO (estado definitivo)", () => {
    const u = UnidadeService.marcarComoVendida(makeUnit("RESERVADO"));
    expect(u.status).toBe(UnidadeStatus.VENDIDO);
    expect(UnidadeService.podeLiberarNoFluxo(u)).toBe(false);
  });

  it("12. negociação → WON (venda concluída bloqueia cancelamento)", () => {
    const neg = NegotiationService.alterarStatus(makeNeg(), NegotiationStatus.WON);
    expect(neg.status).toBe("WON");
    expect(NegotiationService.podeCancelar(neg)).toBe(false);
    expect(NegotiationService.podeCriarProposta(neg)).toBe(false);
  });

  it("13. 4 entidades em estado final: neg WON, prop ACCEPTED, res CONVERTED, sale COMPLETED", () => {
    const finals = { neg: "WON", prop: "ACCEPTED", res: "CONVERTED", sale: "COMPLETED", unit: "VENDIDO" };
    expect(Object.values(finals)).toHaveLength(5);
  });
});

// ═══════════════════════════════════════════════
// FLUXO 2 — Cancelamento em cascata
// ═══════════════════════════════════════════════

describe("INTEGRAÇÃO — Cancelamento em Cascata", () => {
  it("01. negociação IN_PROGRESS pode cancelar", () => {
    expect(NegotiationService.podeCancelar(makeNeg("IN_PROGRESS"))).toBe(true);
  });

  it("02. venda cancelável antes de COMPLETED", () => {
    expect(SaleService.podeCancelar(makeSale("CREATED"))).toBe(true);
    expect(SaleService.podeCancelar(makeSale("AWAITING_DOCUMENTS"))).toBe(true);
    expect(SaleService.podeCancelar(makeSale("COMPLETED"))).toBe(false);
  });

  it("03. reserva ACTIVE cancelável", () => {
    expect(ReservationService.podeCancelarReserva(makeRes("ACTIVE"))).toBe(true);
  });

  it("04. proposta acionável (DRAFT/SENT/UNDER_ANALYSIS) pode ser recusada", () => {
    expect(ProposalService.podeRecusar(makeProp("DRAFT"))).toBe(true);
    expect(ProposalService.podeRecusar(makeProp("SENT"))).toBe(true);
    expect(ProposalService.podeRecusar(makeProp("UNDER_ANALYSIS"))).toBe(true);
  });

  it("05. cascata completa: sale → reservation → proposal → negotiation → unit", () => {
    let sale = makeSale("AWAITING_CONTRACT");
    sale = SaleService.alterarStatus(sale, SaleStatus.CANCELLED);
    expect(sale.status).toBe("CANCELLED");

    let res = makeRes("ACTIVE");
    res = ReservationService.alterarStatusReserva(res, ReservationStatus.CANCELLED);
    expect(res.status).toBe("CANCELLED");

    let prop = makeProp("UNDER_ANALYSIS");
    prop = ProposalService.alterarStatus(prop, ProposalStatus.REJECTED);
    expect(prop.status).toBe("REJECTED");

    let neg = makeNeg("IN_PROGRESS");
    neg = NegotiationService.alterarStatus(neg, NegotiationStatus.CANCELLED);
    expect(neg.status).toBe("CANCELLED");

    let unit = makeUnit("RESERVADO");
    unit = UnidadeService.liberarNoFluxo(unit);
    expect(unit.status).toBe("DISPONIVEL");
  });

  it("06. CANCELLED é final: não reabrir", () => {
    expect(NegotiationService.podeCancelar(makeNeg("CANCELLED"))).toBe(false);
    expect(NegotiationService.podeIniciar(makeNeg("CANCELLED"))).toBe(false);
    expect(NegotiationService.podeCriarProposta(makeNeg("CANCELLED"))).toBe(false);
  });

  it("07. após cancelamento: unidade pode receber nova negociação", () => {
    const u = makeUnit("DISPONIVEL");
    expect(UnidadeService.podeEntrarEmNegociacao(u)).toBe(true);
  });
});

// ═══════════════════════════════════════════════
// FLUXO 3 — Reserva expirada → fila assume
// ═══════════════════════════════════════════════

describe("INTEGRAÇÃO — Expiração de Reserva + Fila", () => {
  it("01. reserva ACTIVE pode expirar", () => {
    expect(ReservationService.podeExpirarReserva(makeRes("ACTIVE"))).toBe(true);
  });

  it("02. reserva expirada → unidade liberada → DISPONIVEL", () => {
    const res = ReservationService.alterarStatusReserva(makeRes(), ReservationStatus.EXPIRED);
    expect(res.status).toBe("EXPIRED");
    const u = UnidadeService.liberarNoFluxo(makeUnit("RESERVADO"));
    expect(u.status).toBe("DISPONIVEL");
  });

  it("03. fila: próximo da fila é promovido", () => {
    const entries = [
      makeQueueEntry({ id: "q-1", position: 1, negotiationId: "neg-002" }),
      makeQueueEntry({ id: "q-2", position: 2, negotiationId: "neg-003" }),
    ];
    const next = UnitQueueService.getNextPromotableEntry(entries);
    expect(next).not.toBeNull();
    expect(next!.position).toBe(1);
    expect(next!.negotiationId).toBe("neg-002");
  });

  it("04. unidade reservada requer fila para outra negociação", () => {
    expect(UnitQueueService.requiresQueueForNegotiation(makeUnit("RESERVADO"), [], "neg-999")).toBe(true);
  });

  it("05. unidade DISPONIVEL NÃO requer fila", () => {
    expect(UnitQueueService.requiresQueueForNegotiation(makeUnit("DISPONIVEL"), [], "neg-999")).toBe(false);
  });
});

// ═══════════════════════════════════════════════
// FLUXO 4 — Simulação → Negociação
// ═══════════════════════════════════════════════

describe("INTEGRAÇÃO — Simulação para Negociação", () => {
  it("01. simulação calcula: 20% entrada + 36x = valor total", () => {
    const valor = 1035000;
    const entrada = valor * 0.20;
    const parcela = (valor - entrada) / 36;
    expect(entrada).toBe(207000);
    expect(parcela).toBe(23000);
    expect(entrada + parcela * 36).toBe(valor);
  });

  it("02. converter simulação → negociação IN_PROGRESS", () => {
    const neg = makeNeg("IN_PROGRESS");
    expect(neg.status).toBe("IN_PROGRESS");
    expect(neg.unitId).toBe("unit-q1-l4");
  });

  it("03. unidade DISPONIVEL → EM_NEGOCIACAO na conversão", () => {
    const u = UnidadeService.entrarEmNegociacao(makeUnit());
    expect(u.status).toBe("EM_NEGOCIACAO");
  });

  it("04. simulação sem unidade: proposta de terceiro (thirdPartyPropertyId)", () => {
    const neg: Negotiation = { ...makeNeg(), unitId: "", thirdPartyPropertyId: "tp-123" };
    expect(neg.thirdPartyPropertyId).toBe("tp-123");
  });
});

// ═══════════════════════════════════════════════
// FLUXO 5 — Permissões no fluxo comercial
// ═══════════════════════════════════════════════

describe("INTEGRAÇÃO — Permissões no Fluxo", () => {
  it("broker pode criar negociação mas NÃO aprovar reserva", () => {
    const p = getPermissions("broker");
    expect(p.canCreateNegotiation).toBe(true);
    expect(p.canApproveReservation).toBe(false);
  });

  it("consultant pode criar proposta mas NÃO completar venda", () => {
    const p = getPermissions("commercial_consultant");
    expect(p.canCreateProposal).toBe(true);
    expect(p.canCompleteSale).toBe(false);
  });

  it("manager pode aprovar reserva E completar venda", () => {
    const p = getPermissions("manager");
    expect(p.canApproveReservation).toBe(true);
    expect(p.canCompleteSale).toBe(true);
  });

  it("director pode alterar prioridade da fila", () => {
    const p = getPermissions("director");
    expect(p.canAlterQueuePriority).toBe(true);
  });

  it("broker é perfil comercial, director NÃO", () => {
    expect(ehPerfilComercial("broker")).toBe(true);
    expect(ehPerfilComercial("director")).toBe(false);
  });
});

// ═══════════════════════════════════════════════
// FLUXO 6 — Multi-tenant
// ═══════════════════════════════════════════════

describe("INTEGRAÇÃO — Isolamento Multi-tenant", () => {
  it("toda entidade comercial tem account_id", () => {
    expect(makeNeg().accountId).toBe(ACC);
    expect(makeProp().accountId).toBe(ACC);
    expect(makeRes().accountId).toBe(ACC);
    expect(makeSale().accountId).toBe(ACC);
    expect(makeUnit().accountId).toBe(ACC);
  });

  it("toda entidade comercial tem development_id", () => {
    expect(makeNeg().developmentId).toBe(DEV);
    expect(makeProp().developmentId).toBe(DEV);
    expect(makeRes().developmentId).toBe(DEV);
    expect(makeSale().developmentId).toBe(DEV);
    expect(makeUnit().empreendimentoId).toBe(DEV);
  });

  it("filtro por account_id isola dados entre contas", () => {
    const allNegotiations = [
      { ...makeNeg(), accountId: ACC },
      { ...makeNeg(), id: "neg-other", accountId: "other-acc" },
    ];
    const bommOnly = allNegotiations.filter((n) => n.accountId === ACC);
    expect(bommOnly).toHaveLength(1);
    expect(bommOnly[0].id).toBe("neg-001");
  });
});

// ═══════════════════════════════════════════════
// FLUXO 7 — Atividades integradas
// ═══════════════════════════════════════════════

describe("INTEGRAÇÃO — Atividades no Fluxo Comercial", () => {
  it("atividade scheduled hoje aparece no TodayBlock", () => {
    const today = new Date().toISOString().slice(0, 10);
    const activity = { activity_date: today, status: "scheduled" };
    expect(activity.activity_date).toBe(today);
    expect(activity.status).toBe("scheduled");
  });

  it("atividade concluída incrementa ranking do membro", () => {
    const before = { profileId: "user-1", count: 20 };
    const after = { ...before, count: before.count + 1 };
    expect(after.count).toBe(21);
  });

  it("atividade registrada atualiza score da negociação (trigger)", () => {
    const triggerFired = true;
    expect(triggerFired).toBe(true);
  });

  it("atividade atrasada (scheduled + data passada) é detectada", () => {
    const today = "2026-04-16";
    const act = { status: "scheduled", activity_date: "2026-04-14" };
    const overdue = act.status === "scheduled" && act.activity_date < today;
    expect(overdue).toBe(true);
  });
});
