export function getSaldoLabel(
  settings: { tipoSaldo: string; textoSaldoPersonalizado: string | null } | null,
): { titulo: string; subtitulo: string } {
  if (!settings) {
    return { titulo: "Parcelado direto com a incorporadora", subtitulo: "Sem banco · sem juros bancários" };
  }

  if (settings.textoSaldoPersonalizado) {
    return { titulo: settings.textoSaldoPersonalizado, subtitulo: "" };
  }

  switch (settings.tipoSaldo) {
    case "financiamento_bancario":
      return { titulo: "Saldo para financiamento bancário", subtitulo: "Sujeito à aprovação de crédito na entrega" };
    case "saldo_entrega":
      return { titulo: "Saldo a pagar na entrega do empreendimento", subtitulo: "Pode ser quitado com FGTS, à vista ou financiado" };
    case "parcelas_incorporadora":
    default:
      return { titulo: "Parcelado direto com a incorporadora", subtitulo: "Sem banco · sem juros bancários" };
  }
}
