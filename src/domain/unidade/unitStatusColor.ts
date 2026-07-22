import { UnidadeStatus } from "./UnidadeStatus";

// Fonte ÚNICA das cores canônicas de status de unidade — usada pelo espelho,
// pela legenda, pela ficha e pelo select de "Alterar status". Não redeclarar
// estes hex em componentes (importar daqui). Valores idênticos aos do espelho.
export const UNIT_STATUS_COLOR: Record<string, string> = {
  [UnidadeStatus.DISPONIVEL]: "#4ADE80",
  [UnidadeStatus.EM_NEGOCIACAO]: "#60A5FA",
  [UnidadeStatus.RESERVADO]: "#D97706",
  [UnidadeStatus.VENDIDO]: "#F87171",
};

export const UNIT_STATUS_COLOR_FALLBACK = "#5C5647";

export function unitStatusColor(status: string | null | undefined): string {
  if (!status) return UNIT_STATUS_COLOR_FALLBACK;
  return UNIT_STATUS_COLOR[status] ?? UNIT_STATUS_COLOR_FALLBACK;
}
