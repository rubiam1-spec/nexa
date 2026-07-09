import type {
  Client,
  ClientWithSpouse,
  ContactInteraction,
  LegalRegime,
  MaritalStatus,
} from "../../shared/types/client";
import { getSupabaseClientOrThrow, unwrapSupabaseListResult } from "./baseRepository";
import {
  LeadQualificationStatus,
  type LeadQualificationStatus as LeadQualificationStatusType,
  toLeadQualificationDb,
  assertLeadTransition,
  isLeadActive,
  fromLeadQualificationDb,
} from "../../domain/status/leadQualification";

// ── Row → Domain mapping ──

function mapRow(row: Record<string, unknown>): Client {
  const broker = Array.isArray(row.brokers) ? row.brokers[0] : row.brokers;
  const assignedProfile = row.assigned_profile as Record<string, unknown> | null;
  return {
    id: row.id as string,
    accountId: (row.account_id as string) ?? "",
    developmentId: (row.development_id as string) ?? null,
    name: (row.name as string) ?? "",
    fullName: (row.full_name as string) ?? null,
    email: (row.email as string) ?? "",
    phone: (row.phone as string) ?? "",
    phoneSecondary: (row.phone_secondary as string) ?? null,
    cpf: (row.cpf as string) ?? null,
    city: (row.city as string) ?? "",
    status: (row.status as Client["status"]) ?? "active",
    temperature: (row.temperature as Client["temperature"]) ?? "warm",
    buyerProfile: (row.buyer_profile as string) ?? null,
    priority: (row.priority as string) ?? null,
    score: (row.score as number) ?? 0,
    qualificationStatus: (row.qualification_status as string) ?? null,
    origin: (row.origin as string) ?? null,
    originDetail: (row.origin_detail as string) ?? null,
    utmSource: (row.utm_source as string) ?? null,
    utmCampaign: (row.utm_campaign as string) ?? null,
    budgetMin: (row.budget_min as number) ?? null,
    budgetMax: (row.budget_max as number) ?? null,
    purchaseTimeline: (row.purchase_timeline as string) ?? null,
    paymentPreference: (row.payment_preference as string) ?? null,
    interestedUnitType: (row.interested_unit_type as string) ?? null,
    assignedTo: (row.assigned_to as string) ?? null,
    assignedToName: (assignedProfile?.name as string) ?? null,
    brokerId: (row.broker_id as string) ?? null,
    brokerName: (broker as Record<string, unknown>)?.name as string | null ?? null,
    firstContactAt: (row.first_contact_at as string) ?? null,
    lastContactAt: (row.last_contact_at as string) ?? null,
    lastInteractionAt: (row.last_interaction_at as string) ?? null,
    nextFollowUpAt: (row.next_follow_up_at as string) ?? null,
    interactionCount: (row.interaction_count as number) ?? 0,
    convertedAt: (row.converted_at as string) ?? null,
    lostAt: (row.lost_at as string) ?? null,
    lostReason: (row.lost_reason as string) ?? null,
    tags: (row.tags as string[]) ?? [],
    internalNotes: (row.internal_notes as string) ?? null,
    interesse: (row.interesse as string) ?? null,
    maritalStatus: (row.marital_status as MaritalStatus) ?? null,
    regimeCasamento: (row.regime_casamento as LegalRegime) ?? null,
    currentSpouseClientId: (row.current_spouse_client_id as string) ?? null,
    createdBy: (row.created_by as string) ?? null,
    createdAt: (row.created_at as string) ?? "",
  };
}

function mapInteractionRow(row: Record<string, unknown>): ContactInteraction {
  const profile = row.profiles as Record<string, unknown> | null;
  return {
    id: row.id as string,
    clientId: row.client_id as string,
    type: (row.type as string) ?? "",
    direction: (row.direction as string) ?? null,
    title: (row.title as string) ?? null,
    description: (row.description as string) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    performedBy: (row.performed_by as string) ?? null,
    performedByName: (profile?.name as string) ?? null,
    performedAt: (row.performed_at as string) ?? "",
  };
}

// ── Select fields ──

const CLIENT_SELECT = `
  id, account_id, development_id,
  name, full_name, email, phone, phone_secondary, cpf, city,
  status, temperature, buyer_profile, priority, score, qualification_status,
  origin, origin_detail, utm_source, utm_campaign,
  budget_min, budget_max, purchase_timeline, payment_preference, interested_unit_type,
  assigned_to, assigned_profile:profiles!clients_assigned_to_fkey(name),
  broker_id, brokers(name),
  first_contact_at, last_contact_at, last_interaction_at, next_follow_up_at, interaction_count,
  converted_at, lost_at, lost_reason,
  tags, internal_notes, interesse,
  marital_status, regime_casamento, current_spouse_client_id,
  created_by, created_at
`;

// ── Queries ──

export async function getClients(
  accountId: string,
  ownerFilter?: { userId: string; clientIdsFromNegs: string[] },
  filters?: {
    status?: string;
    temperature?: string;
    origin?: string;
    assignedTo?: string;
    search?: string;
    period?: string;
    city?: string;
  },
) {
  const supabase = getSupabaseClientOrThrow("clients repository");

  let query = supabase
    .from("clients")
    .select(CLIENT_SELECT)
    .eq("account_id", accountId)
    .is("deleted_at", null);

  if (ownerFilter) {
    const { userId, clientIdsFromNegs } = ownerFilter;
    if (clientIdsFromNegs.length > 0) {
      query = query.or(`created_by.eq.${userId},assigned_to.eq.${userId},id.in.(${clientIdsFromNegs.join(",")})`);
    } else {
      query = query.or(`created_by.eq.${userId},assigned_to.eq.${userId}`);
    }
  }

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.temperature) query = query.eq("temperature", filters.temperature);
  if (filters?.origin) query = query.eq("origin", filters.origin);
  if (filters?.assignedTo) query = query.eq("assigned_to", filters.assignedTo);
  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,full_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
  }
  if (filters?.city) {
    query = query.ilike("city", `%${filters.city}%`);
  }
  if (filters?.period) {
    const now = new Date();
    let from: Date | null = null;
    let to: Date | null = null;
    switch (filters.period) {
      case "today": from = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
      case "7d": from = new Date(now.getTime() - 7 * 864e5); break;
      case "30d": from = new Date(now.getTime() - 30 * 864e5); break;
      case "90d": from = new Date(now.getTime() - 90 * 864e5); break;
      case "this_month": from = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case "last_month": from = new Date(now.getFullYear(), now.getMonth() - 1, 1); to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59); break;
    }
    if (from) query = query.gte("created_at", from.toISOString());
    if (to) query = query.lte("created_at", to.toISOString());
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(200);
  return unwrapSupabaseListResult<Client>(
    (data ?? []).map((r) => mapRow(r as unknown as Record<string, unknown>)),
    error,
    "clients",
  );
}

export async function getClientById(id: string): Promise<Client | null> {
  const supabase = getSupabaseClientOrThrow("clients repository");
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar contato: ${error.message}`);
  if (!data) return null;
  return mapRow(data as unknown as Record<string, unknown>);
}

export async function createClient(input: {
  accountId: string;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  cpf?: string;
  profession?: string;
  maritalStatus?: MaritalStatus;
  regimeCasamento?: LegalRegime;
  currentSpouseClientId?: string | null;
  observations?: string;
  createdBy?: string;
  brokerId?: string;
  status?: string;
  temperature?: string;
  origin?: string;
  originDetail?: string;
  buyerProfile?: string;
  budgetMin?: number;
  budgetMax?: number;
  purchaseTimeline?: string;
  paymentPreference?: string;
  interestedUnitType?: string;
  internalNotes?: string;
  developmentId?: string;
  dataNascimento?: string;
}): Promise<Client> {
  const supabase = getSupabaseClientOrThrow("clients repository");
  const insertPayload: Record<string, unknown> = {
    account_id: input.accountId,
    name: input.name,
    email: input.email || null,
    phone: input.phone || null,
    city: input.city || null,
    cpf: input.cpf || null,
    profession: input.profession || null,
    marital_status: input.maritalStatus || null,
    regime_casamento: input.regimeCasamento || null,
    current_spouse_client_id: input.currentSpouseClientId ?? null,
    observations: input.observations || null,
    status: input.status || "new",
    temperature: input.temperature || "warm",
    origin: input.origin || null,
    origin_detail: input.originDetail || null,
    buyer_profile: input.buyerProfile || null,
    budget_min: input.budgetMin || null,
    budget_max: input.budgetMax || null,
    purchase_timeline: input.purchaseTimeline || null,
    payment_preference: input.paymentPreference || null,
    interested_unit_type: input.interestedUnitType || null,
    internal_notes: input.internalNotes || null,
    development_id: input.developmentId || null,
    data_nascimento: input.dataNascimento || null,
  };
  if (input.createdBy) insertPayload.created_by = input.createdBy;
  if (input.brokerId) insertPayload.broker_id = input.brokerId;

  const { data, error } = await supabase
    .from("clients")
    .insert(insertPayload)
    .select("id, name, email, phone, city, status, broker_id, brokers(name), account_id, temperature, origin, created_at, created_by, marital_status, regime_casamento, current_spouse_client_id")
    .maybeSingle();
  if (error) throw new Error(`Falha ao criar contato: ${error.message}`);
  if (!data) throw new Error("Contato não retornado após criação.");

  // Document checklist is seeded automatically by DB trigger (trg_seed_client_documents)
  // from document_requirements (primary_buyer) + document_type_catalog

  return mapRow(data as unknown as Record<string, unknown>);
}

export async function updateClient(id: string, updates: Record<string, unknown>): Promise<void> {
  const supabase = getSupabaseClientOrThrow("clients repository");
  const fieldMap: Record<string, string> = {
    name: "name", fullName: "full_name", email: "email", phone: "phone",
    phoneSecondary: "phone_secondary", cpf: "cpf", city: "city",
    status: "status", temperature: "temperature", priority: "priority",
    score: "score", origin: "origin", originDetail: "origin_detail",
    buyerProfile: "buyer_profile", qualificationStatus: "qualification_status",
    budgetMin: "budget_min", budgetMax: "budget_max",
    purchaseTimeline: "purchase_timeline", paymentPreference: "payment_preference",
    interestedUnitType: "interested_unit_type",
    assignedTo: "assigned_to", assignedAt: "assigned_at", assignedBy: "assigned_by",
    nextFollowUpAt: "next_follow_up_at",
    lastContactAt: "last_contact_at", lastInteractionAt: "last_interaction_at",
    firstContactAt: "first_contact_at", interactionCount: "interaction_count",
    convertedAt: "converted_at", convertedTo: "converted_to", convertedNegotiationId: "converted_negotiation_id",
    lostAt: "lost_at", lostReason: "lost_reason", lostReasonDetail: "lost_reason_detail",
    reactivatedAt: "reactivated_at", reactivationCount: "reactivation_count",
    tags: "tags", internalNotes: "internal_notes", interesse: "interesse",
    developmentId: "development_id", observations: "observations",
    profession: "profession", companyName: "company_name", monthlyIncome: "renda_mensal",
    maritalStatus: "marital_status", gender: "genero",
    // NEXA — Engrenagem de Partes v1
    regimeCasamento: "regime_casamento",
    currentSpouseClientId: "current_spouse_client_id",
  };
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    const dbKey = fieldMap[key];
    if (dbKey) payload[dbKey] = value;
  }
  if (Object.keys(payload).length === 0) return;
  const { error } = await supabase.from("clients").update(payload).eq("id", id);
  if (error) throw new Error(`Falha ao atualizar contato: ${error.message}`);
}

export async function softDeleteClient(id: string): Promise<void> {
  const supabase = getSupabaseClientOrThrow("clients repository");
  const { error } = await supabase.from("clients").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(`Falha ao excluir contato: ${error.message}`);
}

export async function checkDuplicateClient(
  accountId: string, phone?: string, email?: string, cpf?: string,
): Promise<Client | null> {
  const supabase = getSupabaseClientOrThrow("clients repository");
  const conditions: string[] = [];
  if (phone) conditions.push(`phone.eq.${phone}`);
  if (email) conditions.push(`email.eq.${email}`);
  if (cpf) conditions.push(`cpf.eq.${cpf}`);
  if (conditions.length === 0) return null;
  const { data } = await supabase
    .from("clients").select("id, name, phone, email, status, created_at")
    .eq("account_id", accountId).is("deleted_at", null)
    .or(conditions.join(",")).limit(1).maybeSingle();
  if (!data) return null;
  return mapRow(data as unknown as Record<string, unknown>);
}

// ── Contact Interactions ──

export async function getContactInteractions(clientId: string): Promise<ContactInteraction[]> {
  const supabase = getSupabaseClientOrThrow("clients repository");
  const { data, error } = await supabase
    .from("contact_interactions")
    .select("id, client_id, type, direction, title, description, metadata, performed_by, performed_at, profiles(name)")
    .eq("client_id", clientId)
    .order("performed_at", { ascending: false }).limit(100);
  return unwrapSupabaseListResult(
    (data ?? []).map((r) => mapInteractionRow(r as unknown as Record<string, unknown>)),
    error, "contact_interactions",
  );
}

export async function addContactInteraction(input: {
  accountId: string; clientId: string; type: string;
  direction?: string; title?: string; description?: string;
  metadata?: Record<string, unknown>; performedBy?: string;
}): Promise<void> {
  const supabase = getSupabaseClientOrThrow("clients repository");
  const { error } = await supabase.from("contact_interactions").insert({
    account_id: input.accountId, client_id: input.clientId,
    type: input.type, direction: input.direction || null,
    title: input.title || null, description: input.description || null,
    metadata: input.metadata || {}, performed_by: input.performedBy || null,
  });
  if (error) throw new Error(`Falha ao registrar interação: ${error.message}`);
  // Update last interaction
  await supabase.from("clients").update({ last_interaction_at: new Date().toISOString() }).eq("id", input.clientId);
}

// ── Leads L1 — lente de QUALIFICAÇÃO sobre clients (escrita só aqui) ──
// Vocabulário canônico em src/domain/status/leadQualification. Distribuição é
// MANUAL nesta fase (rodízio automático = L3, via RPC distribute_lead — não aqui).

export async function getLeads(
  accountId: string,
  opts?: { assignedTo?: string | null },
): Promise<Client[]> {
  const supabase = getSupabaseClientOrThrow("clients repository");
  let query = supabase.from("clients").select(CLIENT_SELECT)
    .eq("account_id", accountId).is("deleted_at", null);
  if (opts?.assignedTo) query = query.eq("assigned_to", opts.assignedTo);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(300);
  return unwrapSupabaseListResult(
    (data ?? []).map((r) => mapRow(r as unknown as Record<string, unknown>)),
    error, "leads",
  );
}

export async function assignLead(input: {
  clientId: string; accountId: string; toProfileId: string; toName: string; byProfileId: string | null;
}): Promise<void> {
  const supabase = getSupabaseClientOrThrow("clients repository");
  const { error } = await supabase.from("clients").update({
    assigned_to: input.toProfileId,
    assigned_at: new Date().toISOString(),
    assigned_by: input.byProfileId,
    assignment_type: "manual",
  }).eq("id", input.clientId);
  if (error) throw new Error(`Falha ao atribuir lead: ${error.message}`);
  await addContactInteraction({
    accountId: input.accountId, clientId: input.clientId,
    type: "assignment_change", title: `Atribuído para ${input.toName}`,
    metadata: { to_user: input.toProfileId }, performedBy: input.byProfileId ?? undefined,
  });
}

// Transição canônica de qualificação (guard de transição + interação de trilha).
async function transitionLead(input: {
  clientId: string; accountId: string;
  from: LeadQualificationStatusType; to: LeadQualificationStatusType;
  byProfileId: string | null; title: string; reason?: string; negotiationId?: string;
}): Promise<void> {
  assertLeadTransition(input.from, input.to);
  const supabase = getSupabaseClientOrThrow("clients repository");
  const patch: Record<string, unknown> = { qualification_status: toLeadQualificationDb(input.to) };
  if (input.to === LeadQualificationStatus.CONVERTED) {
    patch.converted_at = new Date().toISOString();
    if (input.negotiationId) patch.converted_negotiation_id = input.negotiationId;
  }
  const { error } = await supabase.from("clients").update(patch).eq("id", input.clientId);
  if (error) throw new Error(`Falha ao mudar qualificação do lead: ${error.message}`);
  await addContactInteraction({
    accountId: input.accountId, clientId: input.clientId,
    type: "qualification_change", title: input.title, description: input.reason,
    metadata: {
      from: input.from, to: input.to,
      ...(input.reason ? { reason: input.reason } : {}),
      ...(input.negotiationId ? { negotiation_id: input.negotiationId } : {}),
    },
    performedBy: input.byProfileId ?? undefined,
  });
}

export function startLeadService(clientId: string, accountId: string, from: LeadQualificationStatusType, byProfileId: string | null) {
  return transitionLead({ clientId, accountId, from, to: LeadQualificationStatus.IN_SERVICE, byProfileId, title: "Atendimento iniciado" });
}
export function qualifyLead(clientId: string, accountId: string, from: LeadQualificationStatusType, byProfileId: string | null) {
  return transitionLead({ clientId, accountId, from, to: LeadQualificationStatus.QUALIFIED, byProfileId, title: "Lead qualificado" });
}
export async function discardLead(clientId: string, accountId: string, from: LeadQualificationStatusType, byProfileId: string | null, reason: string) {
  const r = (reason ?? "").trim();
  if (!r) throw new Error("Descarte exige motivo.");
  return transitionLead({ clientId, accountId, from, to: LeadQualificationStatus.DISCARDED, byProfileId, title: "Lead descartado", reason: r });
}
export function markLeadConverted(clientId: string, accountId: string, from: LeadQualificationStatusType, byProfileId: string | null, negotiationId: string) {
  return transitionLead({ clientId, accountId, from, to: LeadQualificationStatus.CONVERTED, byProfileId, title: "Convertido em negociação", negotiationId });
}

/** Contagem de leads ativos (NEW/IN_SERVICE/QUALIFIED) — usada pelo pré-funil. */
export async function countActiveLeads(accountId: string, opts?: { assignedTo?: string | null }): Promise<number> {
  const supabase = getSupabaseClientOrThrow("clients repository");
  let query = supabase.from("clients").select("qualification_status")
    .eq("account_id", accountId).is("deleted_at", null);
  if (opts?.assignedTo) query = query.eq("assigned_to", opts.assignedTo);
  const { data, error } = await query.limit(2000);
  if (error) throw new Error(`Falha ao contar leads ativos: ${error.message}`);
  return (data ?? []).filter((r) =>
    isLeadActive(fromLeadQualificationDb((r as { qualification_status: string | null }).qualification_status)),
  ).length;
}

// ── NEXA Engrenagem de Partes v1 — vínculo de cônjuges ────────────

const SPOUSE_LINKABLE_STATUSES: MaritalStatus[] = ["casado", "uniao_estavel"];

/**
 * Linka dois clients como cônjuges (vínculo bidirecional). Ambos devem
 * pertencer à mesma account e ter marital_status compatível. Sem RPC
 * transacional: se o segundo UPDATE falhar, tentamos rollback manual
 * no primeiro. Uma RPC SQL dedicada é candidate para sprint futura.
 */
export async function linkSpouses(
  clientId: string,
  spouseClientId: string,
): Promise<void> {
  if (clientId === spouseClientId) {
    throw new Error("Não é possível vincular um cliente a si mesmo como cônjuge.");
  }
  const supabase = getSupabaseClientOrThrow("clients repository");

  const { data, error } = await supabase
    .from("clients")
    .select("id, account_id, marital_status, current_spouse_client_id")
    .in("id", [clientId, spouseClientId]);

  if (error) {
    throw new Error(`Falha ao validar vínculo de cônjuges: ${error.message}`);
  }
  const rows = (data ?? []) as Array<{
    id: string;
    account_id: string;
    marital_status: MaritalStatus | null;
  }>;
  if (rows.length !== 2) {
    throw new Error("Um dos clientes não foi encontrado para vínculo de cônjuge.");
  }
  const [a, b] = rows;
  if (a.account_id !== b.account_id) {
    throw new Error("Clientes pertencem a contas diferentes — vínculo bloqueado.");
  }
  const invalidRows = rows.filter(
    (r) => !r.marital_status || !SPOUSE_LINKABLE_STATUSES.includes(r.marital_status),
  );
  if (invalidRows.length > 0) {
    const ids = invalidRows.map((r) => r.id).join(", ");
    throw new Error(
      `Não é possível vincular cônjuges: cliente(s) ${ids} sem estado civil válido (casado/união estável). ` +
        "Acesse o perfil do cliente, marque o estado civil correto e salve antes de vincular.",
    );
  }

  const { error: firstErr } = await supabase
    .from("clients")
    .update({ current_spouse_client_id: spouseClientId, updated_at: new Date().toISOString() })
    .eq("id", clientId);
  if (firstErr) {
    throw new Error(`Falha ao vincular cônjuge (1/2): ${firstErr.message}`);
  }

  const { error: secondErr } = await supabase
    .from("clients")
    .update({ current_spouse_client_id: clientId, updated_at: new Date().toISOString() })
    .eq("id", spouseClientId);
  if (secondErr) {
    // Rollback manual do primeiro UPDATE para evitar vínculo unilateral.
    await supabase
      .from("clients")
      .update({ current_spouse_client_id: null, updated_at: new Date().toISOString() })
      .eq("id", clientId);
    throw new Error(
      `Falha ao vincular cônjuge (2/2), rollback aplicado: ${secondErr.message}`,
    );
  }
}

/**
 * Remove o vínculo de cônjuges (bidirecional). Primeiro lê o cliente
 * passado para descobrir quem é o par; depois limpa ambos os lados.
 * Proteção: só limpa o lado B se ele realmente aponta de volta para A.
 */
export async function unlinkSpouses(clientId: string): Promise<void> {
  const supabase = getSupabaseClientOrThrow("clients repository");

  const { data, error } = await supabase
    .from("clients")
    .select("id, current_spouse_client_id")
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao ler vínculo de cônjuge: ${error.message}`);
  }
  const spouseId = (data as { current_spouse_client_id: string | null } | null)
    ?.current_spouse_client_id;

  const nowIso = new Date().toISOString();
  const { error: firstErr } = await supabase
    .from("clients")
    .update({ current_spouse_client_id: null, updated_at: nowIso })
    .eq("id", clientId);
  if (firstErr) {
    throw new Error(`Falha ao desvincular cônjuge: ${firstErr.message}`);
  }

  if (spouseId) {
    // Só limpa o lado B se ele realmente aponta de volta — evita quebrar
    // um novo vínculo que possa ter sido criado concorrentemente.
    await supabase
      .from("clients")
      .update({ current_spouse_client_id: null, updated_at: nowIso })
      .eq("id", spouseId)
      .eq("current_spouse_client_id", clientId);
  }
}

/**
 * Busca candidatos a cônjuge na mesma conta. Exclui o próprio cliente e
 * clientes que já estão vinculados a outra pessoa (current_spouse_client_id
 * apontando para um terceiro). Filtra por nome (ilike) OU CPF (digits-only).
 *
 * Usado pelo SpouseLinkModal (Engrenagem de Partes v1 — Fase 3).
 */
export async function searchSpouseCandidates(
  accountId: string,
  currentClientId: string,
  searchTerm: string,
): Promise<Array<{
  id: string;
  name: string;
  fullName: string | null;
  cpf: string | null;
  maritalStatus: MaritalStatus | null;
  currentSpouseClientId: string | null;
}>> {
  const supabase = getSupabaseClientOrThrow("clients repository");
  const trimmed = searchTerm.trim();
  if (trimmed.length < 2) return [];

  const digitsOnly = trimmed.replace(/\D/g, "");
  const isNumericSearch = digitsOnly.length >= 3;

  let query = supabase
    .from("clients")
    .select("id, name, full_name, cpf, marital_status, current_spouse_client_id")
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .neq("id", currentClientId)
    .limit(20);

  if (isNumericSearch) {
    query = query.ilike("cpf", `%${digitsOnly}%`);
  } else {
    const pattern = `%${trimmed}%`;
    query = query.or(`name.ilike.${pattern},full_name.ilike.${pattern}`);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Falha ao buscar candidatos a cônjuge: ${error.message}`);
  }

  type Row = {
    id: string;
    name: string;
    full_name: string | null;
    cpf: string | null;
    marital_status: MaritalStatus | null;
    current_spouse_client_id: string | null;
  };

  // Filtra candidatos já vinculados a OUTRA pessoa (não ao currentClient).
  return ((data ?? []) as Row[])
    .filter((r) => r.current_spouse_client_id === null || r.current_spouse_client_id === currentClientId)
    .map((r) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      cpf: r.cpf,
      maritalStatus: r.marital_status,
      currentSpouseClientId: r.current_spouse_client_id,
    }));
}

/** Carrega um cliente e, se houver vínculo de cônjuge, o cônjuge também. */
export async function getClientWithSpouse(
  clientId: string,
): Promise<ClientWithSpouse | null> {
  const client = await getClientById(clientId);
  if (!client) return null;
  if (!client.currentSpouseClientId) return { client, spouse: null };
  const spouse = await getClientById(client.currentSpouseClientId);
  return { client, spouse };
}
