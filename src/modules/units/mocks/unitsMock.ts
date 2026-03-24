import type { Unidade } from "../../../domain/unidade/Unidade";
import { UnidadeStatus } from "../../../domain/unidade/UnidadeStatus";

export const unitsMock: Unidade[] = [
  {
    id: "unit_1",
    accountId: "account_1",
    quadra: "Q1",
    lote: "L01",
    valor: 280000,
    empreendimentoId: "development_1",
    status: UnidadeStatus.DISPONIVEL,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  {
    id: "unit_2",
    accountId: "account_1",
    quadra: "Q1",
    lote: "L02",
    valor: 295000,
    empreendimentoId: "development_1",
    status: UnidadeStatus.EM_NEGOCIACAO,
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  },
  {
    id: "unit_3",
    accountId: "account_1",
    quadra: "Q2",
    lote: "L07",
    valor: 310000,
    empreendimentoId: "development_1",
    status: UnidadeStatus.VENDIDO,
    createdAt: new Date("2026-01-03T00:00:00.000Z"),
    updatedAt: new Date("2026-01-03T00:00:00.000Z"),
  },
  {
    id: "unit_4",
    accountId: "account_1",
    quadra: "Q3",
    lote: "L12",
    valor: 420000,
    empreendimentoId: "development_2",
    status: UnidadeStatus.DISPONIVEL,
    createdAt: new Date("2026-01-04T00:00:00.000Z"),
    updatedAt: new Date("2026-01-04T00:00:00.000Z"),
  },
];
