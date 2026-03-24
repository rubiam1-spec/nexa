export const UnidadeStatus = {
  DISPONIVEL: "DISPONIVEL",
  EM_NEGOCIACAO: "EM_NEGOCIACAO",
  RESERVADO: "RESERVADO",
  VENDIDO: "VENDIDO",
} as const;

export type UnidadeStatus =
  (typeof UnidadeStatus)[keyof typeof UnidadeStatus];
