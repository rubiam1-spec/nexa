import type { UnidadeStatus } from "./UnidadeStatus";

export type Unidade = {
  id: string;
  accountId: string;
  quadra: string;
  lote: string;
  valor: number;
  empreendimentoId: string;
  status: UnidadeStatus;
  createdAt: Date;
  updatedAt: Date;
};
