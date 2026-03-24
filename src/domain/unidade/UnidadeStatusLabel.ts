import { UnidadeStatus } from "./UnidadeStatus";

export function getUnidadeStatusLabel(status: UnidadeStatus): string {
  switch (status) {
    case UnidadeStatus.DISPONIVEL:
      return "Disponível";
    case UnidadeStatus.EM_NEGOCIACAO:
      return "Em negociação";
    case UnidadeStatus.RESERVADO:
      return "Reservado";
    case UnidadeStatus.VENDIDO:
      return "Vendido";
  }
}
