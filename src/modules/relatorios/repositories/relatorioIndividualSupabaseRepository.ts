// Repository do Relatório Individual (atividades + negócios por pessoa).
// Espelha o padrão de activitiesSupabaseRepository: SÓ acesso a dados, ZERO
// agregação. Toda query filtra SEMPRE por account_id + development_id (escopo
// do empreendimento ativo). Domínio/regra ficam no hook useRelatorioIndividual.
import { getSupabaseClientOrThrow } from "../../../infra/repositories/baseRepository";

export type AtividadeIndividualRow = {
  id: string;
  profile_id: string;
  type: string;
  status: string;
  activity_date: string; // YYYY-MM-DD
  title: string | null;
  start_time: string | null;
  created_at: string;
};

export type NegociacaoIndividualRow = {
  id: string;
  status: string;
  owner_profile_id: string | null;
  broker_id: string | null;
  created_at: string;
};

export type MembroElegivel = { id: string; name: string; role: string };

type PeriodoIndividual = {
  accountId: string;
  developmentId: string;
  profileId: string;
  from: string; // YYYY-MM-DD (activity_date) — inclusive
  to: string; // YYYY-MM-DD (activity_date) — inclusive
};

type PeriodoNegociacao = {
  accountId: string;
  developmentId: string;
  profileId: string;
  from: string; // ISO (created_at) — inclusive
  to: string; // ISO (created_at) — inclusive
};

// Atividades da PESSOA no empreendimento ativo e período. Janela em
// activity_date (coluna date), gte/lte inclusive.
export async function fetchAtividadesIndividual(
  opts: PeriodoIndividual,
): Promise<AtividadeIndividualRow[]> {
  const client = getSupabaseClientOrThrow("relatorioIndividual.fetchAtividadesIndividual");
  const { data, error } = await client
    .from("activities")
    .select("id, profile_id, type, status, activity_date, title, start_time, created_at")
    .eq("account_id", opts.accountId)
    .eq("development_id", opts.developmentId)
    .eq("profile_id", opts.profileId)
    .gte("activity_date", opts.from)
    .lte("activity_date", opts.to);
  if (error) throw error;
  return (data ?? []) as AtividadeIndividualRow[];
}

// Negócios cujo DONO interno é a pessoa (owner_profile_id), no empreendimento
// ativo e período. Janela em created_at (timestamptz), gte/lte inclusive.
// negotiations NÃO possui coluna de valor confiável — por isso não há VGV aqui.
export async function fetchNegociacoesIndividual(
  opts: PeriodoNegociacao,
): Promise<NegociacaoIndividualRow[]> {
  const client = getSupabaseClientOrThrow("relatorioIndividual.fetchNegociacoesIndividual");
  const { data, error } = await client
    .from("negotiations")
    .select("id, status, owner_profile_id, broker_id, created_at")
    .eq("account_id", opts.accountId)
    .eq("development_id", opts.developmentId)
    .eq("owner_profile_id", opts.profileId)
    .gte("created_at", opts.from)
    .lte("created_at", opts.to);
  if (error) throw error;
  return (data ?? []) as NegociacaoIndividualRow[];
}

// Contagem de negociações SEM dono atribuído (owner_profile_id NULL) na
// conta+empreendimento+período — base da nota honesta de exclusão. head:true
// não traz linhas, só o count.
export async function countNegociacoesSemDono(opts: {
  accountId: string;
  developmentId: string;
  from: string; // ISO created_at
  to: string; // ISO created_at
}): Promise<number> {
  const client = getSupabaseClientOrThrow("relatorioIndividual.countNegociacoesSemDono");
  const { count, error } = await client
    .from("negotiations")
    .select("id", { count: "exact", head: true })
    .eq("account_id", opts.accountId)
    .eq("development_id", opts.developmentId)
    .is("owner_profile_id", null)
    .gte("created_at", opts.from)
    .lte("created_at", opts.to);
  if (error) throw error;
  return count ?? 0;
}

// Membros da CONTA ATIVA elegíveis para recorte individual (quem PODE ser
// selecionado). Vínculo via user_account_access → profiles. Só papéis
// operacionais; administrative/concierge/director/owner ficam de fora.
export async function fetchMembrosElegiveis(opts: {
  accountId: string;
}): Promise<MembroElegivel[]> {
  const client = getSupabaseClientOrThrow("relatorioIndividual.fetchMembrosElegiveis");
  const { data, error } = await client
    .from("user_account_access")
    .select("role, profiles:user_id(id, name, full_name)")
    .eq("account_id", opts.accountId)
    .in("role", ["manager", "commercial_consultant", "broker"]);
  if (error) throw error;
  const seen = new Set<string>();
  const out: MembroElegivel[] = [];
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const p = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) as
      | Record<string, unknown>
      | null;
    if (!p) continue;
    const id = p.id as string;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name: (p.name as string) || (p.full_name as string) || "—",
      role: r.role as string,
    });
  }
  return out;
}
