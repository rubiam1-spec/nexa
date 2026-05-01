import { SaleStatus, type SaleStatus as SaleStatusType } from "../../domain/venda/SaleStatus";
import type { Sale } from "../../shared/types/sale";
import { getSupabaseClientOrThrow, unwrapSupabaseListResult } from "./baseRepository";

const dbStatusToEnum: Record<string, SaleStatusType> = {
  created: SaleStatus.CREATED,
  awaiting_documents: SaleStatus.AWAITING_DOCUMENTS,
  awaiting_contract: SaleStatus.AWAITING_CONTRACT,
  awaiting_payment: SaleStatus.AWAITING_PAYMENT,
  completed: SaleStatus.COMPLETED,
  cancelled: SaleStatus.CANCELLED,
};

const enumToDbStatus: Record<SaleStatusType, string> = {
  [SaleStatus.CREATED]: "created",
  [SaleStatus.AWAITING_DOCUMENTS]: "awaiting_documents",
  [SaleStatus.AWAITING_CONTRACT]: "awaiting_contract",
  [SaleStatus.AWAITING_PAYMENT]: "awaiting_payment",
  [SaleStatus.COMPLETED]: "completed",
  [SaleStatus.CANCELLED]: "cancelled",
};

const validStatuses = new Set<string>(Object.values(SaleStatus));

type SaleRow = {
  id: string;
  negotiation_id: string;
  reservation_id: string;
  proposal_id: string;
  account_id: string;
  development_id: string;
  unit_id: string;
  amount: number;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeSaleStatus(raw: string): SaleStatusType {
  const trimmed = raw.trim();
  const mapped = dbStatusToEnum[trimmed];
  if (mapped) return mapped;
  const upper = trimmed.toUpperCase();
  if (validStatuses.has(upper)) return upper as SaleStatusType;
  console.warn(`[salesRepository] status desconhecido do banco: "${raw}", usando CREATED como fallback`);
  return SaleStatus.CREATED;
}

function mapSaleRow(row: SaleRow): Sale {
  return {
    id: row.id,
    negotiationId: row.negotiation_id,
    reservationId: row.reservation_id,
    proposalId: row.proposal_id,
    accountId: row.account_id,
    developmentId: row.development_id,
    unitId: row.unit_id,
    amount: Number(row.amount),
    status: normalizeSaleStatus(row.status),
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function getSalesByNegotiation(negotiationId: string) {
  const supabase = getSupabaseClientOrThrow("sales repository");

  const { data, error } = await supabase
    .from("sales")
    .select(
      "id, negotiation_id, reservation_id, proposal_id, account_id, development_id, unit_id, amount, status, created_by, created_at, updated_at",
    )
    .eq("negotiation_id", negotiationId)
    .order("created_at", { ascending: false });

  const sales = (data ?? []).map((row) => mapSaleRow(row as SaleRow));

  return unwrapSupabaseListResult<Sale>(sales, error, "sales");
}

export async function getSales(accountId: string, developmentId: string) {
  const supabase = getSupabaseClientOrThrow("sales repository");

  const { data, error } = await supabase
    .from("sales")
    .select(
      "id, negotiation_id, reservation_id, proposal_id, account_id, development_id, unit_id, amount, status, created_by, created_at, updated_at",
    )
    .eq("account_id", accountId)
    .eq("development_id", developmentId)
    .order("created_at", { ascending: false });

  const sales = (data ?? []).map((row) => mapSaleRow(row as SaleRow));

  return unwrapSupabaseListResult<Sale>(sales, error, "sales");
}

export async function createSale(input: {
  negotiationId: string;
  reservationId: string;
  proposalId: string;
  accountId: string;
  developmentId: string;
  unitId: string;
  amount: number;
  status: Sale["status"];
  createdBy: string | null;
}) {
  const supabase = getSupabaseClientOrThrow("sales repository");

  const { data, error } = await supabase
    .from("sales")
    .insert({
      negotiation_id: input.negotiationId,
      reservation_id: input.reservationId,
      proposal_id: input.proposalId,
      account_id: input.accountId,
      development_id: input.developmentId,
      unit_id: input.unitId,
      amount: input.amount,
      status: enumToDbStatus[input.status] ?? input.status,
      created_by: input.createdBy,
      updated_at: new Date().toISOString(),
    })
    .select(
      "id, negotiation_id, reservation_id, proposal_id, account_id, development_id, unit_id, amount, status, created_by, created_at, updated_at",
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to create sale: ${error.message}`);
  }

  if (!data) {
    throw new Error("Sale was not returned after insert.");
  }

  return mapSaleRow(data as SaleRow);
}

export async function updateSaleStatus(
  saleId: string,
  status: Sale["status"],
) {
  const supabase = getSupabaseClientOrThrow("sales repository");

  const dbStatus = enumToDbStatus[status] ?? status;

  const { data, error } = await supabase
    .from("sales")
    .update({
      status: dbStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", saleId)
    .select(
      "id, negotiation_id, reservation_id, proposal_id, account_id, development_id, unit_id, amount, status, created_by, created_at, updated_at",
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update sale: ${error.message}`);
  }

  if (!data) {
    throw new Error("Sale not found for update.");
  }

  return mapSaleRow(data as SaleRow);
}

export async function deleteSalesByDevelopment(developmentId: string): Promise<void> {
  const sb = getSupabaseClientOrThrow("sales repository");
  const { error } = await sb
    .from("sales")
    .delete()
    .eq("development_id", developmentId);
  if (error) throw new Error(error.message);
}
