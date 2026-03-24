import type { Unidade } from "../../domain/unidade/Unidade";
import { UnidadeService } from "../../domain/unidade/UnidadeService";
import { UnidadeStatus } from "../../domain/unidade/UnidadeStatus";
import { UnidadeNaoDisponivelError } from "./errors/UnidadeNaoDisponivelError";

export function reservarUnidade(unidade: Unidade): Unidade {
  if (!UnidadeService.podeReservar(unidade)) {
    throw new UnidadeNaoDisponivelError();
  }

  return UnidadeService.alterarStatus(unidade, UnidadeStatus.RESERVADO);
}
