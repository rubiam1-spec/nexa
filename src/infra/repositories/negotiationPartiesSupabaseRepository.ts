// NEXA — Engrenagem de Partes v1 — Fase 2
// Único ponto de acesso à tabela negotiation_parties. Padrão alinhado com
// pipelineSimulationsSupabaseRepository (RowType + mapper + named exports).
//
// IMPORTANTE: primary_buyer é gerenciado 100% por trigger no banco
// (SET/UNSET automático quando negotiations.client_id muda). Código nunca
// cria/remove linhas com role='primary_buyer' — as funções abaixo validam
// e rejeitam tentativas explícitas, com mensagem de orientação.

import type {
  AddPartyInput,
  LegalRegime,
  NegotiationParty,
  NegotiationPartyWithClient,
  PartyRole,
  SigningCapacity,
  UpdatePartyInput,
} from "../../shared/types/negotiationParty";
import { PARTY_ROLE_DISPLAY_ORDER } from "../../shared/types/negotiationParty";
import type { MaritalStatus } from "../../shared/types/client";
import { getSupabaseClientOrThrow, unwrapSupabaseListResult } from "./baseRepository";

type NegotiationPartyRow = {
  id: string;
  account_id: string;
  negotiation_id: string;
  client_id: string;
  role: PartyRole;
  signing_capacity: SigningCapacity | null;
  legal_regime: LegalRegime | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

type ClientEmbeddedRow = {
  id: string;
  full_name: string | null;
  name: string | null;
  cpf: string | null;
  email: string | null;
  phone: string | null;
  marital_status: MaritalStatus | null;
  regime_casamento: LegalRegime | null;
};

type NegotiationPartyWithClientRow = NegotiationPartyRow & {
  client: ClientEmbeddedRow | ClientEmbeddedRow[] | null;
};

const PARTY_COLUMNS =
  "id, account_id, negotiation_id, client_id, role, signing_capacity, legal_regime, notes, created_at, updated_at, created_by";

const PARTY_WITH_CLIENT_COLUMNS =
  `${PARTY_COLUMNS}, client:clients!client_id(id, full_name, name, cpf, email, phone, marital_status, regime_casamento)`;

function mapPartyRow(row: NegotiationPartyRow): NegotiationParty {
  return {
    id: row.id,
    accountId: row.account_id,
    negotiationId: row.negotiation_id,
    clientId: row.client_id,
    role: row.role,
    signingCapacity: row.signing_capacity,
    legalRegime: row.legal_regime,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  };
}

function mapEmbeddedClient(
  raw: ClientEmbeddedRow | ClientEmbeddedRow[] | null,
  fallbackId: string,
): NegotiationPartyWithClient["client"] {
  const row = Array.isArray(raw) ? (raw[0] ?? null) : raw;
  if (!row) {
    return {
      id: fallbackId,
      fullName: null,
      name: null,
      cpf: null,
      email: null,
      phone: null,
      maritalStatus: null,
      regimeCasamento: null,
    };
  }
  return {
    id: row.id,
    fullName: row.full_name,
    name: row.name,
    cpf: row.cpf,
    email: row.email,
    phone: row.phone,
    maritalStatus: row.marital_status,
    regimeCasamento: row.regime_casamento,
  };
}

function mapRowWithClient(row: NegotiationPartyWithClientRow): NegotiationPartyWithClient {
  return {
    party: mapPartyRow(row),
    client: mapEmbeddedClient(row.client, row.client_id),
  };
}

function sortByDisplayOrder(list: NegotiationPartyWithClient[]): NegotiationPartyWithClient[] {
  const weight = (role: PartyRole) => {
    const idx = PARTY_ROLE_DISPLAY_ORDER.indexOf(role);
    return idx < 0 ? PARTY_ROLE_DISPLAY_ORDER.length : idx;
  };
  // createdAt como desempate para múltiplos co_obligor.
  return [...list].sort((a, b) => {
    const w = weight(a.party.role) - weight(b.party.role);
    if (w !== 0) return w;
    return a.party.createdAt.localeCompare(b.party.createdAt);
  });
}

// ── Queries ───────────────────────────────────────────────────────

export async function listPartiesByNegotiation(
  negotiationId: string,
): Promise<NegotiationPartyWithClient[]> {
  const supabase = getSupabaseClientOrThrow("negotiation parties repository");

  const { data, error } = await supabase
    .from("negotiation_parties")
    .select(PARTY_WITH_CLIENT_COLUMNS)
    .eq("negotiation_id", negotiationId);

  if (error) {
    throw new Error(`Failed to list negotiation parties: ${error.message}`);
  }
  const mapped = ((data ?? []) as NegotiationPartyWithClientRow[]).map(mapRowWithClient);
  return sortByDisplayOrder(mapped);
}

export async function getPartyById(
  partyId: string,
): Promise<NegotiationPartyWithClient | null> {
  const supabase = getSupabaseClientOrThrow("negotiation parties repository");

  const { data, error } = await supabase
    .from("negotiation_parties")
    .select(PARTY_WITH_CLIENT_COLUMNS)
    .eq("id", partyId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load negotiation party: ${error.message}`);
  }
  return data ? mapRowWithClient(data as NegotiationPartyWithClientRow) : null;
}

export async function listPartiesByClient(
  clientId: string,
): Promise<NegotiationParty[]> {
  const supabase = getSupabaseClientOrThrow("negotiation parties repository");

  const { data, error } = await supabase
    .from("negotiation_parties")
    .select(PARTY_COLUMNS)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  const parties = ((data ?? []) as NegotiationPartyRow[]).map(mapPartyRow);
  return unwrapSupabaseListResult<NegotiationParty>(
    parties,
    error,
    "negotiation_parties",
  );
}

// ── Mutations ─────────────────────────────────────────────────────

export async function addParty(
  input: AddPartyInput,
  accountId: string,
  createdBy: string,
): Promise<NegotiationParty> {
  // Defesa a nível de código — banco também rejeita, mas mensagem amigável
  // é melhor no ponto de falha da UI.
  if ((input.role as PartyRole) === "primary_buyer") {
    throw new Error(
      "primary_buyer é gerenciado automaticamente pelo sistema. Atualize negotiations.client_id em vez disso.",
    );
  }

  const supabase = getSupabaseClientOrThrow("negotiation parties repository");

  const { data, error } = await supabase
    .from("negotiation_parties")
    .insert({
      account_id: accountId,
      negotiation_id: input.negotiationId,
      client_id: input.clientId,
      role: input.role,
      signing_capacity: input.signingCapacity ?? null,
      legal_regime: input.legalRegime ?? null,
      notes: input.notes ?? null,
      created_by: createdBy,
    })
    .select(PARTY_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Failed to add negotiation party: ${error.message}`);
  }
  return mapPartyRow(data as NegotiationPartyRow);
}

export async function updateParty(
  partyId: string,
  input: UpdatePartyInput,
): Promise<NegotiationParty> {
  const supabase = getSupabaseClientOrThrow("negotiation parties repository");

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.signingCapacity !== undefined) payload.signing_capacity = input.signingCapacity;
  if (input.legalRegime !== undefined) payload.legal_regime = input.legalRegime;
  if (input.notes !== undefined) payload.notes = input.notes;

  const { data, error } = await supabase
    .from("negotiation_parties")
    .update(payload)
    .eq("id", partyId)
    .select(PARTY_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Failed to update negotiation party: ${error.message}`);
  }
  return mapPartyRow(data as NegotiationPartyRow);
}

export async function removeParty(partyId: string): Promise<void> {
  const supabase = getSupabaseClientOrThrow("negotiation parties repository");

  // Verifica role antes de deletar — primary_buyer só deve sair via trigger.
  const { data: current, error: readError } = await supabase
    .from("negotiation_parties")
    .select("role")
    .eq("id", partyId)
    .maybeSingle();

  if (readError) {
    throw new Error(`Failed to read party role before delete: ${readError.message}`);
  }
  if (!current) {
    // Nada a fazer — já não existe.
    return;
  }
  if ((current as { role: PartyRole }).role === "primary_buyer") {
    throw new Error(
      "Não é possível remover primary_buyer diretamente. Para remover o comprador principal, remova client_id da negociação.",
    );
  }

  const { error } = await supabase
    .from("negotiation_parties")
    .delete()
    .eq("id", partyId);

  if (error) {
    throw new Error(`Failed to remove negotiation party: ${error.message}`);
  }
}

// Para testes unitários / introspection futura.
export const __INTERNAL__ = {
  mapPartyRow,
  mapEmbeddedClient,
  sortByDisplayOrder,
};
