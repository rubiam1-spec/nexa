import type { DevelopmentSettings } from "../../shared/types/developmentSettings";
import { getSupabaseClientOrThrow } from "./baseRepository";

type DevelopmentSettingsRow = {
  development_id: string;
  account_id: string;
  reservation_duration_hours: number | null;
  require_accepted_proposal_for_reservation_request: boolean | null;
  require_complete_client_data_for_reservation_request: boolean | null;
  queue_enabled: boolean | null;
  updated_at: string;
  // Simulador
  entrada_minima_pct?: number | null;
  entrada_maxima_pct?: number | null;
  entrada_parcelada_permitida?: boolean | null;
  entrada_parcelada_max_vezes?: number | null;
  parcelas_minimas?: number | null;
  parcelas_maximas?: number | null;
  indice_pre_entrega?: string | null;
  indice_pos_entrega?: string | null;
  data_entrega_empreendimento?: string | null;
  carencia_maxima_meses?: number | null;
  aceita_balao?: boolean | null;
  balao_max_quantidade?: number | null;
  aceita_permuta?: boolean | null;
  permuta_tipos?: string[] | null;
  permuta_valor_maximo_pct?: number | null;
  desconto_maximo_pct?: number | null;
  comissao_corretor_pct?: number | null;
  tipo_saldo?: string | null;
  texto_saldo_personalizado?: string | null;
  logo_empreendimento_url?: string | null;
  logo_light_url?: string | null;
  logo_dark_url?: string | null;
  imagem_capa_url?: string | null;
  cor_empreendimento?: string | null;
  usar_logo_empreendimento_no_pdf?: boolean | null;
  usar_cor_empreendimento_no_pdf?: boolean | null;
  incluir_foto_capa_no_pdf?: boolean | null;
  aceita_saldo_entrega?: boolean | null;
  saldo_entrega_max_pct?: number | null;
  texto_saldo_entrega?: string | null;
  label_agrupamento?: string | null;
  label_unidade?: string | null;
  label_area?: string | null;
  mapa_url?: string | null;
  mapa_configurado?: boolean | null;
  pdf_titulo?: string | null;
  pdf_bullet_1?: string | null;
  pdf_bullet_2?: string | null;
  pdf_bullet_3?: string | null;
  pdf_disclaimer?: string | null;
  pdf_frase_rodape?: string | null;
  pdf_validade_horas?: number | null;
  pdf_texto_parcelamento?: string | null;
};

function mapDevelopmentSettingsRow(
  row: DevelopmentSettingsRow,
): DevelopmentSettings {
  return {
    developmentId: row.development_id,
    accountId: row.account_id,
    reservationDurationHours: row.reservation_duration_hours,
    requireAcceptedProposalForReservationRequest:
      row.require_accepted_proposal_for_reservation_request,
    requireCompleteClientDataForReservationRequest:
      row.require_complete_client_data_for_reservation_request,
    queueEnabled: row.queue_enabled,
    updatedAt: new Date(row.updated_at),
    // Simulador com defaults
    entradaMinimaPct: row.entrada_minima_pct ?? 10,
    entradaMaximaPct: row.entrada_maxima_pct ?? 80,
    entradaParceladaPermitida: row.entrada_parcelada_permitida ?? true,
    entradaParceladaMaxVezes: row.entrada_parcelada_max_vezes ?? 12,
    parcelasMinimas: row.parcelas_minimas ?? 12,
    parcelasMaximas: row.parcelas_maximas ?? 120,
    indicePreEntrega: row.indice_pre_entrega ?? "INCC",
    indicePosEntrega: row.indice_pos_entrega ?? "IPCA",
    dataEntregaEmpreendimento: row.data_entrega_empreendimento ?? null,
    carenciaMaximaMeses: row.carencia_maxima_meses ?? 6,
    aceitaBalao: row.aceita_balao ?? true,
    balaoMaxQuantidade: row.balao_max_quantidade ?? 12,
    aceitaPermuta: row.aceita_permuta ?? true,
    permutaTipos: row.permuta_tipos ?? ["veiculo", "terreno", "imovel"],
    permutaValorMaximoPct: row.permuta_valor_maximo_pct ?? 30,
    descontoMaximoPct: row.desconto_maximo_pct ?? 5,
    comissaoCorretorPct: row.comissao_corretor_pct ?? 4,
    tipoSaldo: (row.tipo_saldo as "parcelas_incorporadora" | "financiamento_bancario" | "saldo_entrega") ?? "parcelas_incorporadora",
    textoSaldoPersonalizado: row.texto_saldo_personalizado ?? null,
    logoEmpreendimentoUrl: row.logo_empreendimento_url ?? null,
    logoLightUrl: row.logo_light_url ?? null,
    logoDarkUrl: row.logo_dark_url ?? null,
    imagemCapaUrl: row.imagem_capa_url ?? null,
    corEmpreendimento: row.cor_empreendimento ?? null,
    usarLogoEmpreendimentoNoPdf: row.usar_logo_empreendimento_no_pdf ?? true,
    usarCorEmpreendimentoNoPdf: row.usar_cor_empreendimento_no_pdf ?? false,
    incluirFotoCapaNoPdf: row.incluir_foto_capa_no_pdf ?? false,
    aceitaSaldoEntrega: row.aceita_saldo_entrega ?? false,
    saldoEntregaMaxPct: row.saldo_entrega_max_pct ?? 30,
    textoSaldoEntrega: row.texto_saldo_entrega ?? null,
    labelAgrupamento: row.label_agrupamento ?? "Quadra",
    labelUnidade: row.label_unidade ?? "Lote",
    labelArea: row.label_area ?? "m²",
    mapaUrl: row.mapa_url ?? null,
    mapaConfigurado: row.mapa_configurado ?? false,
    pdfTitulo: row.pdf_titulo ?? null,
    pdfBullet1: row.pdf_bullet_1 ?? null,
    pdfBullet2: row.pdf_bullet_2 ?? null,
    pdfBullet3: row.pdf_bullet_3 ?? null,
    pdfDisclaimer: row.pdf_disclaimer ?? null,
    pdfFraseRodape: row.pdf_frase_rodape ?? null,
    pdfValidadeHoras: row.pdf_validade_horas ?? 48,
    pdfTextoParcelamento: row.pdf_texto_parcelamento ?? null,
    balaoPeriodicidade: (row as Record<string, unknown>).balao_periodicidade as string ?? "semestral",
  };
}

export async function getDevelopmentSettings(
  accountId: string,
  developmentId: string,
) {
  const supabase = getSupabaseClientOrThrow("development settings repository");

  const { data, error } = await supabase
    .from("development_settings")
    .select("*")
    .eq("account_id", accountId)
    .eq("development_id", developmentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load development settings: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapDevelopmentSettingsRow(data as DevelopmentSettingsRow);
}

export async function updateDevelopmentSettings(
  accountId: string,
  developmentId: string,
  input: Partial<
    Omit<DevelopmentSettings, "accountId" | "developmentId" | "updatedAt">
  >,
) {
  const supabase = getSupabaseClientOrThrow("development settings repository");

  const payload: Record<string, unknown> = {
    account_id: accountId,
    development_id: developmentId,
    updated_at: new Date().toISOString(),
  };
  // Only include fields that are explicitly provided
  if (input.reservationDurationHours !== undefined) payload.reservation_duration_hours = input.reservationDurationHours;
  if (input.requireAcceptedProposalForReservationRequest !== undefined) payload.require_accepted_proposal_for_reservation_request = input.requireAcceptedProposalForReservationRequest;
  if (input.requireCompleteClientDataForReservationRequest !== undefined) payload.require_complete_client_data_for_reservation_request = input.requireCompleteClientDataForReservationRequest;
  if (input.queueEnabled !== undefined) payload.queue_enabled = input.queueEnabled;
  if (input.tipoSaldo !== undefined) payload.tipo_saldo = input.tipoSaldo;
  if (input.textoSaldoPersonalizado !== undefined) payload.texto_saldo_personalizado = input.textoSaldoPersonalizado;
  if (input.entradaMinimaPct !== undefined) payload.entrada_minima_pct = input.entradaMinimaPct;
  if (input.entradaMaximaPct !== undefined) payload.entrada_maxima_pct = input.entradaMaximaPct;
  if (input.entradaParceladaPermitida !== undefined) payload.entrada_parcelada_permitida = input.entradaParceladaPermitida;
  if (input.entradaParceladaMaxVezes !== undefined) payload.entrada_parcelada_max_vezes = input.entradaParceladaMaxVezes;
  if (input.parcelasMinimas !== undefined) payload.parcelas_minimas = input.parcelasMinimas;
  if (input.parcelasMaximas !== undefined) payload.parcelas_maximas = input.parcelasMaximas;
  if (input.indicePreEntrega !== undefined) payload.indice_pre_entrega = input.indicePreEntrega;
  if (input.indicePosEntrega !== undefined) payload.indice_pos_entrega = input.indicePosEntrega;
  if (input.dataEntregaEmpreendimento !== undefined) payload.data_entrega_empreendimento = input.dataEntregaEmpreendimento;
  if (input.carenciaMaximaMeses !== undefined) payload.carencia_maxima_meses = input.carenciaMaximaMeses;
  if (input.aceitaBalao !== undefined) payload.aceita_balao = input.aceitaBalao;
  if (input.balaoMaxQuantidade !== undefined) payload.balao_max_quantidade = input.balaoMaxQuantidade;
  if (input.aceitaPermuta !== undefined) payload.aceita_permuta = input.aceitaPermuta;
  if (input.permutaValorMaximoPct !== undefined) payload.permuta_valor_maximo_pct = input.permutaValorMaximoPct;
  if (input.descontoMaximoPct !== undefined) payload.desconto_maximo_pct = input.descontoMaximoPct;
  if (input.comissaoCorretorPct !== undefined) payload.comissao_corretor_pct = input.comissaoCorretorPct;
  if (input.logoEmpreendimentoUrl !== undefined) payload.logo_empreendimento_url = input.logoEmpreendimentoUrl;
  if (input.logoLightUrl !== undefined) payload.logo_light_url = input.logoLightUrl;
  if (input.logoDarkUrl !== undefined) payload.logo_dark_url = input.logoDarkUrl;
  if (input.imagemCapaUrl !== undefined) payload.imagem_capa_url = input.imagemCapaUrl;
  if (input.corEmpreendimento !== undefined) payload.cor_empreendimento = input.corEmpreendimento;
  if (input.usarLogoEmpreendimentoNoPdf !== undefined) payload.usar_logo_empreendimento_no_pdf = input.usarLogoEmpreendimentoNoPdf;
  if (input.usarCorEmpreendimentoNoPdf !== undefined) payload.usar_cor_empreendimento_no_pdf = input.usarCorEmpreendimentoNoPdf;
  if (input.incluirFotoCapaNoPdf !== undefined) payload.incluir_foto_capa_no_pdf = input.incluirFotoCapaNoPdf;
  if (input.aceitaSaldoEntrega !== undefined) payload.aceita_saldo_entrega = input.aceitaSaldoEntrega;
  if (input.saldoEntregaMaxPct !== undefined) payload.saldo_entrega_max_pct = input.saldoEntregaMaxPct;
  if (input.textoSaldoEntrega !== undefined) payload.texto_saldo_entrega = input.textoSaldoEntrega;
  if (input.labelAgrupamento !== undefined) payload.label_agrupamento = input.labelAgrupamento;
  if (input.labelUnidade !== undefined) payload.label_unidade = input.labelUnidade;
  if (input.labelArea !== undefined) payload.label_area = input.labelArea;
  if (input.mapaUrl !== undefined) payload.mapa_url = input.mapaUrl;
  if (input.mapaConfigurado !== undefined) payload.mapa_configurado = input.mapaConfigurado;
  if (input.pdfTitulo !== undefined) payload.pdf_titulo = input.pdfTitulo;
  if (input.pdfBullet1 !== undefined) payload.pdf_bullet_1 = input.pdfBullet1;
  if (input.pdfBullet2 !== undefined) payload.pdf_bullet_2 = input.pdfBullet2;
  if (input.pdfBullet3 !== undefined) payload.pdf_bullet_3 = input.pdfBullet3;
  if (input.pdfDisclaimer !== undefined) payload.pdf_disclaimer = input.pdfDisclaimer;
  if (input.pdfFraseRodape !== undefined) payload.pdf_frase_rodape = input.pdfFraseRodape;
  if (input.pdfValidadeHoras !== undefined) payload.pdf_validade_horas = input.pdfValidadeHoras;
  if (input.pdfTextoParcelamento !== undefined) payload.pdf_texto_parcelamento = input.pdfTextoParcelamento;

  const { data, error } = await supabase
    .from("development_settings")
    .upsert(payload)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update development settings: ${error.message}`);
  }

  if (!data) {
    throw new Error("Development settings were not returned after update.");
  }

  return mapDevelopmentSettingsRow(data as DevelopmentSettingsRow);
}
