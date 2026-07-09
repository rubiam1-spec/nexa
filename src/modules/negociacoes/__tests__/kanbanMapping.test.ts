import { describe, it, expect } from "vitest";
import type { KanbanCard } from "../hooks/useKanbanData";
import { RESERVATION_ACTIVE_DB, RESERVATION_TERMINAL_DB_VALUES } from "../../../domain/status/reservation";
import { PROPOSAL_CLOSED_DB_VALUES } from "../../../domain/status/proposal";
import { NegotiationStatus } from "../../../domain/status/negotiation";

function mapRow(n: Record<string, unknown>): KanbanCard {
  const client = Array.isArray(n.clients) ? n.clients[0] : n.clients;
  const unit = Array.isArray(n.units) ? n.units[0] : n.units;
  const broker = Array.isArray(n.brokers) ? n.brokers[0] : n.brokers;
  const propostas = Array.isArray(n.proposals) ? n.proposals as Record<string, unknown>[] : [];
  const ultimaProposta = propostas.sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime())[0] ?? null;
  const reservas = Array.isArray(n.reservations) ? n.reservations as Record<string, unknown>[] : [];
  const reservaAtiva = reservas.find((r) => r.status === RESERVATION_ACTIVE_DB) ?? reservas[0] ?? null;
  return {
    id: n.id as string,
    status: (n.status as string) ?? "",
    createdAt: n.created_at as string,
    updatedAt: n.updated_at as string,
    clienteNome: (client as Record<string, unknown>)?.name as string | null ?? null,
    clienteId: n.client_id as string | null,
    quadra: (unit as Record<string, unknown>)?.quadra as string | null ?? null,
    lote: (unit as Record<string, unknown>)?.lote as string | null ?? null,
    valor: (unit as Record<string, unknown>)?.valor as number | null ?? null,
    unitId: n.unit_id as string | null,
    unitStatus: (unit as Record<string, unknown>)?.status as string | null ?? null,
    corretorNome: (broker as Record<string, unknown>)?.name as string | null ?? null,
    corretorId: n.broker_id as string | null,
    propostaId: ultimaProposta?.id as string | null ?? null,
    propostaStatus: ultimaProposta?.status as string | null ?? null,
    reservaExpiresAt: reservaAtiva?.expires_at as string | null ?? null,
    reservaStatus: reservaAtiva?.status as string | null ?? null,
    reservaRequestId: null,
    reservaRequestStatus: null,
    lostReason: n.lost_reason as string | null ?? null,
    score: n.score as number | null ?? null,
    stageChangedAt: n.stage_changed_at as string | null ?? null,
  };
}

describe("Kanban — mapeamento de dados Supabase → KanbanCard", () => {
  it("mapeia negociação completa", () => {
    const card = mapRow({
      id: "neg-1", status: "IN_PROGRESS",
      created_at: "2026-04-10T10:00:00Z", updated_at: "2026-04-15T14:00:00Z",
      client_id: "cli-1", unit_id: "unit-1", broker_id: "brk-1",
      clients: { name: "João Silva" },
      units: { quadra: "1", lote: "4", valor: 1035000, status: "EM_NEGOCIACAO" },
      brokers: { name: "Maria Vitoria" },
      proposals: [], reservations: [],
      lost_reason: null, score: 65, stage_changed_at: null,
    });
    expect(card.id).toBe("neg-1");
    expect(card.clienteNome).toBe("João Silva");
    expect(card.quadra).toBe("1");
    expect(card.lote).toBe("4");
    expect(card.valor).toBe(1035000);
    expect(card.corretorNome).toBe("Maria Vitoria");
    expect(card.score).toBe(65);
  });

  it("trata joins como array (Supabase pode retornar array ou objeto)", () => {
    const card = mapRow({
      id: "neg-2", status: "OPEN",
      created_at: "2026-04-10", updated_at: "2026-04-10",
      client_id: null, unit_id: "u-2", broker_id: null,
      clients: [{ name: "Maria" }],
      units: [{ quadra: "2", lote: "5", valor: 500000, status: "DISPONIVEL" }],
      brokers: [{ name: "Broker" }],
      proposals: [], reservations: [],
      lost_reason: null, score: null, stage_changed_at: null,
    });
    expect(card.clienteNome).toBe("Maria");
    expect(card.quadra).toBe("2");
    expect(card.corretorNome).toBe("Broker");
  });

  it("trata joins null/undefined", () => {
    const card = mapRow({
      id: "neg-3", status: "OPEN",
      created_at: "2026-04-10", updated_at: "2026-04-10",
      client_id: null, unit_id: null, broker_id: null,
      clients: null, units: null, brokers: null,
      proposals: [], reservations: [],
      lost_reason: null, score: null, stage_changed_at: null,
    });
    expect(card.clienteNome).toBeNull();
    expect(card.quadra).toBeNull();
    expect(card.corretorNome).toBeNull();
  });

  it("seleciona última proposta por data", () => {
    const card = mapRow({
      id: "neg-4", status: "IN_PROGRESS",
      created_at: "2026-04-10", updated_at: "2026-04-10",
      client_id: null, unit_id: null, broker_id: null,
      clients: null, units: null, brokers: null,
      proposals: [
        { id: "p-old", status: "rejected", created_at: "2026-04-01T10:00:00Z" },
        { id: "p-new", status: "sent", created_at: "2026-04-10T10:00:00Z" },
      ],
      reservations: [],
      lost_reason: null, score: null, stage_changed_at: null,
    });
    expect(card.propostaId).toBe("p-new");
    expect(card.propostaStatus).toBe("sent");
  });

  it("seleciona reserva active (canônico) sobre outras", () => {
    const card = mapRow({
      id: "neg-5", status: "IN_PROGRESS",
      created_at: "2026-04-10", updated_at: "2026-04-10",
      client_id: null, unit_id: null, broker_id: null,
      clients: null, units: null, brokers: null,
      proposals: [],
      reservations: [
        { id: "r-exp", status: "expired", expires_at: "2026-04-01" },
        { id: "r-act", status: "active", expires_at: "2026-04-20" },
      ],
      lost_reason: null, score: null, stage_changed_at: null,
    });
    expect(card.reservaStatus).toBe("active");
    expect(card.reservaExpiresAt).toBe("2026-04-20");
  });

  it("leitura estrita: variante não-canônica (ATIVA/ACTIVE) NÃO é selecionada como ativa", () => {
    const card = mapRow({
      id: "neg-strict", status: "IN_PROGRESS",
      created_at: "2026-04-10", updated_at: "2026-04-10",
      client_id: null, unit_id: null, broker_id: null,
      clients: null, units: null, brokers: null,
      proposals: [],
      reservations: [
        { id: "r-pt", status: "ATIVA", expires_at: "2026-04-01" },
        { id: "r-canon", status: "active", expires_at: "2026-04-20" },
      ],
      lost_reason: null, score: null, stage_changed_at: null,
    });
    // O find estrito casa só "active"; "ATIVA"/"ACTIVE" não são reconhecidos.
    expect(card.reservaStatus).toBe("active");
    expect(card.reservaExpiresAt).toBe("2026-04-20");
  });

  it("sem propostas: propostaId null", () => {
    const card = mapRow({
      id: "neg-6", status: "OPEN",
      created_at: "2026-04-10", updated_at: "2026-04-10",
      client_id: null, unit_id: null, broker_id: null,
      clients: null, units: null, brokers: null,
      proposals: [], reservations: [],
      lost_reason: null, score: null, stage_changed_at: null,
    });
    expect(card.propostaId).toBeNull();
    expect(card.reservaStatus).toBeNull();
  });

  it("lost_reason preservada", () => {
    const card = mapRow({
      id: "neg-7", status: "LOST",
      created_at: "2026-04-10", updated_at: "2026-04-10",
      client_id: null, unit_id: null, broker_id: null,
      clients: null, units: null, brokers: null,
      proposals: [], reservations: [],
      lost_reason: "Cliente desistiu", score: null, stage_changed_at: null,
    });
    expect(card.lostReason).toBe("Cliente desistiu");
  });

  it("valor numérico preservado (não string)", () => {
    const card = mapRow({
      id: "neg-8", status: "OPEN",
      created_at: "2026-04-10", updated_at: "2026-04-10",
      client_id: null, unit_id: null, broker_id: null,
      clients: null, units: { quadra: "1", lote: "1", valor: 1035000, status: "DISPONIVEL" },
      brokers: null, proposals: [], reservations: [],
      lost_reason: null, score: 72, stage_changed_at: null,
    });
    expect(typeof card.valor).toBe("number");
    expect(card.valor).toBe(1035000);
    expect(typeof card.score).toBe("number");
  });
});

describe("Kanban — agrupamento por estágio", () => {
  const cards: KanbanCard[] = [
    { id: "1", status: "OPEN", propostaStatus: null, reservaStatus: null } as KanbanCard,
    { id: "2", status: "IN_PROGRESS", propostaStatus: "sent", reservaStatus: null } as KanbanCard,
    { id: "3", status: "IN_PROGRESS", propostaStatus: "accepted", reservaStatus: "active" } as KanbanCard,
    { id: "4", status: "WON", propostaStatus: "accepted", reservaStatus: "converted" } as KanbanCard,
    { id: "5", status: "LOST", propostaStatus: null, reservaStatus: null } as KanbanCard,
  ];

  // Estágio estrito (espelha getEstagio do KanbanPage): compara com o canônico da fonte única.
  function getStage(c: KanbanCard): string {
    if (c.status === NegotiationStatus.WON) return "sale";
    if (c.status === NegotiationStatus.LOST || c.status === NegotiationStatus.CANCELLED) return "lost";
    if (c.reservaStatus && !RESERVATION_TERMINAL_DB_VALUES.includes(c.reservaStatus)) return "reservation";
    if (c.propostaStatus && !PROPOSAL_CLOSED_DB_VALUES.includes(c.propostaStatus)) return "proposal";
    // Fase A do Funil: backstop pelo status (o estágio agora vive na negociação)
    // para não sumir card cujo filho não veio no join.
    if (c.status === NegotiationStatus.RESERVATION) return "reservation";
    if (c.status === NegotiationStatus.PROPOSAL) return "proposal";
    return "negotiation";
  }

  it("card OPEN sem proposta = negotiation", () => {
    expect(getStage(cards[0])).toBe("negotiation");
  });
  it("card IN_PROGRESS com proposta SENT = proposal", () => {
    expect(getStage(cards[1])).toBe("proposal");
  });
  it("card com reserva ACTIVE = reservation", () => {
    expect(getStage(cards[2])).toBe("reservation");
  });
  it("card WON = sale", () => {
    expect(getStage(cards[3])).toBe("sale");
  });
  it("card LOST = lost", () => {
    expect(getStage(cards[4])).toBe("lost");
  });
  it("estrito: reserva terminal (converted) NÃO conta como reservation", () => {
    const c = { id: "6", status: "IN_PROGRESS", propostaStatus: null, reservaStatus: "converted" } as KanbanCard;
    expect(getStage(c)).toBe("negotiation");
  });
  it("estrito: proposta encerrada (accepted) NÃO conta como proposal", () => {
    const c = { id: "7", status: "IN_PROGRESS", propostaStatus: "accepted", reservaStatus: null } as KanbanCard;
    expect(getStage(c)).toBe("negotiation");
  });
  it("Fase A: status RESERVATION sem filho no join cai em reservation (backstop)", () => {
    const c = { id: "8", status: "RESERVATION", propostaStatus: null, reservaStatus: null } as KanbanCard;
    expect(getStage(c)).toBe("reservation");
  });
  it("Fase A: status PROPOSAL sem filho no join cai em proposal (backstop)", () => {
    const c = { id: "9", status: "PROPOSAL", propostaStatus: null, reservaStatus: null } as KanbanCard;
    expect(getStage(c)).toBe("proposal");
  });
});
