// Fonte ÚNICA das mensagens PT-BR do RPC register_historical_sale.
// PURA e testável. Exceptions (throw): not_authenticated | unit_not_found |
// forbidden | client_not_found | sale_already_registered | invalid_amount.
const ERROR_LABELS: Array<[string, string]> = [
  ["not_authenticated", "Sessão expirada. Faça login novamente."],
  ["unit_not_found", "Unidade não encontrada."],
  ["forbidden", "Sem permissão para registrar venda."],
  ["client_not_found", "Comprador não encontrado."],
  ["sale_already_registered", "Esta unidade já tem venda registrada."],
  ["invalid_amount", "Valor inválido."],
];

export function historicalSaleErrorLabel(message: string): string {
  const m = (message ?? "").toLowerCase();
  for (const [code, label] of ERROR_LABELS) {
    if (m.includes(code)) return label;
  }
  return "Não foi possível registrar a venda. Tente novamente.";
}
