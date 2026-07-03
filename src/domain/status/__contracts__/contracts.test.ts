// Teste de CONTRATO enum × CHECK constraint (Fase 3 — Etapa 4).
// Prova que o conjunto de valores canônicos de src/domain/status/ é EXATAMENTE
// igual ao conjunto aceito pela CHECK constraint (manifesto em db-constraints.ts,
// espelho das migrations). Roda no CI sem banco. Também via: npm run check:contracts.
import { describe, it, expect } from "vitest";
import { DB_STATUS_CONSTRAINTS } from "./db-constraints";
import { NEGOTIATION_DB_VALUES } from "../negotiation";
import { PROPOSAL_DB_VALUES } from "../proposal";
import { RESERVATION_DB_VALUES, RESERVATION_REQUEST_DB_VALUES } from "../reservation";
import { SALE_DB_VALUES } from "../sale";
import { PIPELINE_SIMULATION_DB_VALUES } from "../pipelineSimulation";
import { SIMULATION_GROUP_DB_VALUES } from "../simulationGroup";
import { UNIT_QUEUE_DB_VALUES, UnitQueueStatus } from "../unitQueue";

const uniqSorted = (v: readonly string[]): string[] => [...new Set(v)].sort();

/** Falha com mensagem clara: quais valores só existem de um lado. */
function assertContract(entity: string, code: readonly string[], db: readonly string[]) {
  const c = uniqSorted(code);
  const d = uniqSorted(db);
  const soNoCodigo = c.filter((x) => !d.includes(x));
  const soNoBanco = d.filter((x) => !c.includes(x));
  expect(
    { entity, soNoCodigo, soNoBanco },
    `Divergência de contrato em "${entity}": código=${JSON.stringify(c)} banco=${JSON.stringify(d)}`,
  ).toEqual({ entity, soNoCodigo: [], soNoBanco: [] });
}

describe("Contrato enum × CHECK constraint", () => {
  it("negotiations", () => assertContract("negotiations", NEGOTIATION_DB_VALUES, DB_STATUS_CONSTRAINTS.negotiations));
  it("proposals", () => assertContract("proposals", PROPOSAL_DB_VALUES, DB_STATUS_CONSTRAINTS.proposals));
  it("reservations", () => assertContract("reservations", RESERVATION_DB_VALUES, DB_STATUS_CONSTRAINTS.reservations));
  it("reservation_requests (subconjunto de ReservationStatus)", () =>
    assertContract("reservation_requests", RESERVATION_REQUEST_DB_VALUES, DB_STATUS_CONSTRAINTS.reservation_requests));
  it("sales", () => assertContract("sales", SALE_DB_VALUES, DB_STATUS_CONSTRAINTS.sales));
  it("pipeline_simulations", () =>
    assertContract("pipeline_simulations", PIPELINE_SIMULATION_DB_VALUES, DB_STATUS_CONSTRAINTS.pipeline_simulations));
  it("simulation_groups", () =>
    assertContract("simulation_groups", SIMULATION_GROUP_DB_VALUES, DB_STATUS_CONSTRAINTS.simulation_groups));
});

describe("unit_queue_entries — SEM CHECK no banco até a Etapa 5", () => {
  // TODO(Fase3-Etapa5): unit_queue_entries ganha CHECK junto com o fix de escrita M1
  // (que hoje grava em UPPER). Quando isso ocorrer: adicionar unit_queue_entries ao
  // manifesto DB_STATUS_CONSTRAINTS e o caso de contrato aqui; remover a tolerância.
  it("consistência interna do enum (sem contrato de banco por ora)", () => {
    expect(new Set(UNIT_QUEUE_DB_VALUES).size).toBe(UNIT_QUEUE_DB_VALUES.length);
    expect(UNIT_QUEUE_DB_VALUES.length).toBe(Object.keys(UnitQueueStatus).length);
  });
});
