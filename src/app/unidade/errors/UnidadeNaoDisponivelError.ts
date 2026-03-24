export class UnidadeNaoDisponivelError extends Error {
  constructor() {
    super("A unidade informada nao esta disponivel para reserva.");
    this.name = "UnidadeNaoDisponivelError";
  }
}
