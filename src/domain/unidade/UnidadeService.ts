import type { Unidade } from "./Unidade";
import { UnidadeStatus } from "./UnidadeStatus";

export class UnidadeService {
  static podeEntrarEmNegociacao(unidade: Unidade) {
    return unidade.status === UnidadeStatus.DISPONIVEL;
  }

  static podeReservar(unidade: Unidade) {
    return unidade.status === UnidadeStatus.DISPONIVEL;
  }

  static podeMarcarComoReservadaNoFluxo(unidade: Unidade) {
    return (
      unidade.status === UnidadeStatus.DISPONIVEL ||
      unidade.status === UnidadeStatus.EM_NEGOCIACAO
    );
  }

  static podeVender(unidade: Unidade) {
    return unidade.status === UnidadeStatus.RESERVADO;
  }

  static podeLiberarNoFluxo(unidade: Unidade) {
    return (
      unidade.status === UnidadeStatus.EM_NEGOCIACAO ||
      unidade.status === UnidadeStatus.RESERVADO
    );
  }

  static alterarStatus(unidade: Unidade, status: Unidade["status"]): Unidade {
    return {
      ...unidade,
      status,
      updatedAt: new Date(),
    };
  }

  static entrarEmNegociacao(unidade: Unidade) {
    if (!this.podeEntrarEmNegociacao(unidade)) {
      throw new Error("A unidade nao pode entrar em negociacao no status atual.");
    }

    return this.alterarStatus(unidade, UnidadeStatus.EM_NEGOCIACAO);
  }

  static marcarComoReservadaNoFluxo(unidade: Unidade) {
    if (!this.podeMarcarComoReservadaNoFluxo(unidade)) {
      throw new Error("A unidade nao pode ser reservada no fluxo atual.");
    }

    return this.alterarStatus(unidade, UnidadeStatus.RESERVADO);
  }

  static liberarNoFluxo(unidade: Unidade) {
    if (!this.podeLiberarNoFluxo(unidade)) {
      throw new Error("A unidade nao pode ser liberada no status atual.");
    }

    return this.alterarStatus(unidade, UnidadeStatus.DISPONIVEL);
  }

  static marcarComoVendida(unidade: Unidade) {
    if (!this.podeVender(unidade)) {
      throw new Error("A unidade nao pode ser vendida no status atual.");
    }

    return this.alterarStatus(unidade, UnidadeStatus.VENDIDO);
  }
}
