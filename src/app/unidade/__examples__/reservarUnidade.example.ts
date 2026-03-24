import { reservarUnidade } from "../ReservarUnidade";
import { UnidadeStatus } from "../../../domain/unidade/UnidadeStatus";

const unidadeDisponivel = {
  id: "unidade_1",
  accountId: "account_1",
  quadra: "Q1",
  lote: "L12",
  valor: 350000,
  empreendimentoId: "empreendimento_1",
  status: UnidadeStatus.DISPONIVEL,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const unidadeReservada = {
  ...unidadeDisponivel,
  status: UnidadeStatus.RESERVADO,
};

const resultadoReserva = reservarUnidade(unidadeDisponivel);

console.log(resultadoReserva.status);

try {
  reservarUnidade(unidadeReservada);
} catch (error) {
  console.log(error);
}
