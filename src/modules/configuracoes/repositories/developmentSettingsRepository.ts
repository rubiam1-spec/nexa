import type { DevelopmentSettings } from "../../../shared/types/developmentSettings";
import { developmentSettingsMock } from "../mocks/developmentSettingsMock";

function createDefaultDevelopmentSettings(
  accountId: string,
  developmentId: string,
): DevelopmentSettings {
  return {
    developmentId,
    accountId,
    reservationDurationHours: null,
    requireAcceptedProposalForReservationRequest: null,
    requireCompleteClientDataForReservationRequest: null,
    queueEnabled: null,
    updatedAt: new Date(),
    entradaMinimaPct: 10,
    entradaMaximaPct: 80,
    entradaParceladaPermitida: true,
    entradaParceladaMaxVezes: 12,
    parcelasMinimas: 12,
    parcelasMaximas: 120,
    indicePreEntrega: "INCC",
    indicePosEntrega: "IPCA",
    dataEntregaEmpreendimento: null,
    carenciaMaximaMeses: 6,
    aceitaBalao: true,
    balaoMaxQuantidade: 12,
    aceitaPermuta: true,
    permutaTipos: ["veiculo", "terreno", "imovel"],
    permutaValorMaximoPct: 30,
    descontoMaximoPct: 5,
    comissaoCorretorPct: 4,
    tipoSaldo: "parcelas_incorporadora",
    textoSaldoPersonalizado: null,
    logoEmpreendimentoUrl: null,
    logoLightUrl: null,
    logoDarkUrl: null,
    imagemCapaUrl: null,
    corEmpreendimento: null,
    usarLogoEmpreendimentoNoPdf: true,
    usarCorEmpreendimentoNoPdf: false,
    incluirFotoCapaNoPdf: false,
    aceitaSaldoEntrega: false,
    saldoEntregaMaxPct: 30,
    textoSaldoEntrega: null,
    labelAgrupamento: "Quadra",
    labelUnidade: "Lote",
    labelArea: "m²",
    mapaUrl: null,
    mapaConfigurado: false,
    pdfTitulo: null,
    pdfBullet1: null,
    pdfBullet2: null,
    pdfBullet3: null,
    pdfDisclaimer: null,
    pdfFraseRodape: null,
    pdfValidadeHoras: 48,
    pdfTextoParcelamento: null,
    balaoPeriodicidade: "semestral",
  };
}

export function getDevelopmentSettings(accountId: string, developmentId: string) {
  return (
    developmentSettingsMock.find(
      (item) =>
        item.accountId === accountId && item.developmentId === developmentId,
    ) ?? createDefaultDevelopmentSettings(accountId, developmentId)
  );
}

export function updateDevelopmentSettings(
  accountId: string,
  developmentId: string,
  input: Partial<
    Omit<DevelopmentSettings, "accountId" | "developmentId" | "updatedAt">
  >,
) {
  const currentIndex = developmentSettingsMock.findIndex(
    (item) =>
      item.accountId === accountId && item.developmentId === developmentId,
  );
  const current =
    currentIndex >= 0
      ? developmentSettingsMock[currentIndex]
      : createDefaultDevelopmentSettings(accountId, developmentId);

  const next: DevelopmentSettings = {
    ...current,
    ...input,
    updatedAt: new Date(),
  };

  if (currentIndex >= 0) {
    developmentSettingsMock[currentIndex] = next;
  } else {
    developmentSettingsMock.unshift(next);
  }

  return next;
}
