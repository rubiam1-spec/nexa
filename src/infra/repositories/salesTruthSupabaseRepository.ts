// Infra da verdade única de vendas. Busca sales (não canceladas) + negociações
// WON e mapeia para os tipos PUROS do serviço salesTruth (que faz união/dedupe).
// Labels (cliente/unidade) vêm no mesmo fetch para as superfícies não re-buscarem.
import { getSupabaseClientOrThrow } from "./baseRepository";
import { buildSalesTruth, type SaleTruthSaleRow, type SaleTruthWon, type SaleTruthItem } from "../../domain/venda/salesTruth";

export type SalesTruthLabels = {
  clientName: Record<string, string>; // key: item.id
  unitLabel: Record<string, string>; // key: item.id
};

export type SalesTruthResult = { items: SaleTruthItem[]; labels: SalesTruthLabels };

function firstRel<T>(v: unknown): T | null {
  return (Array.isArray(v) ? v[0] : v) as T | null;
}

export async function getSalesTruth(accountId: string, developmentId: string | null): Promise<SalesTruthResult> {
  const supabase = getSupabaseClientOrThrow("sales truth repository");

  let salesQ = supabase
    .from("sales")
    .select("id, negotiation_id, unit_id, client_id, amount, sale_date, status, created_at, clients(name), units(quadra, lote)")
    .neq("status", "cancelled")
    .eq("account_id", accountId);
  if (developmentId) salesQ = salesQ.eq("development_id", developmentId);

  let wonQ = supabase
    .from("negotiations")
    .select("id, unit_id, status, stage_changed_at, created_at, clients(name), units(quadra, lote, valor)")
    .eq("status", "WON")
    .eq("account_id", accountId);
  if (developmentId) wonQ = wonQ.eq("development_id", developmentId);

  const [salesRes, wonRes] = await Promise.all([salesQ, wonQ]);
  if (salesRes.error) throw new Error(salesRes.error.message);
  if (wonRes.error) throw new Error(wonRes.error.message);

  const clientName: Record<string, string> = {};
  const unitLabel: Record<string, string> = {};

  const sales: SaleTruthSaleRow[] = ((salesRes.data ?? []) as Record<string, unknown>[]).map((r) => {
    const cl = firstRel<{ name?: string }>(r.clients);
    const un = firstRel<{ quadra?: string; lote?: string }>(r.units);
    const id = String(r.id);
    if (cl?.name) clientName[id] = cl.name;
    if (un?.quadra) unitLabel[id] = `Q${un.quadra}·L${un.lote}`;
    return {
      id,
      negotiationId: (r.negotiation_id as string | null) ?? null,
      unitId: (r.unit_id as string | null) ?? null,
      amount: r.amount == null ? null : Number(r.amount),
      saleDate: (r.sale_date as string | null) ?? null,
      status: String(r.status ?? "completed"),
      createdAt: String(r.created_at),
    };
  });

  const won: SaleTruthWon[] = ((wonRes.data ?? []) as Record<string, unknown>[]).map((r) => {
    const un = firstRel<{ quadra?: string; lote?: string; valor?: number }>(r.units);
    const cl = firstRel<{ name?: string }>(r.clients);
    const negId = String(r.id);
    const key = `won:${negId}`;
    if (cl?.name) clientName[key] = cl.name;
    if (un?.quadra) unitLabel[key] = `Q${un.quadra}·L${un.lote}`;
    return {
      negotiationId: negId,
      unitId: (r.unit_id as string | null) ?? null,
      valor: un?.valor == null ? null : Number(un.valor),
      stageChangedAt: (r.stage_changed_at as string | null) ?? null,
      createdAt: String(r.created_at),
    };
  });

  return { items: buildSalesTruth(sales, won), labels: { clientName, unitLabel } };
}
