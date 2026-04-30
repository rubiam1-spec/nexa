import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../../infra/supabase/supabaseClient";

export interface ThirdPartyProperty {
  id: string; accountId: string; titulo: string;
  tipo: string; status: string;
  endereco: string | null; bairro: string | null; cidade: string | null; estado: string | null; cep: string | null;
  areaM2: number | null; areaConstruida: number | null; areaTerreno: number | null; areaHectares: number | null; areaPrivativa: number | null; areaComum: number | null;
  quartos: number | null; suites: number | null; banheiros: number | null; vagasGaragem: number | null;
  suiteMaster: boolean; closet: boolean; banheira: boolean; lavabo: boolean;
  vagasTipo: string | null; previsaoEntrega: string | null;
  andar: number | null; unidadeApt: string | null; anoConstrucao: number | null;
  condominioNome: string | null; condominioValor: number | null; iptuValor: number | null;
  frente: number | null; fundo: number | null; lateralEsquerda: number | null; lateralDireita: number | null;
  topografia: string | null;
  possuiAgua: boolean; possuiLuz: boolean; possuiEsgoto: boolean; possuiAsfalto: boolean; possuiEnergia: boolean;
  acesso: string | null; fonteAgua: string | null;
  descricao: string | null; matricula: string | null; origem: string;
  valorAvaliado: number | null; valorVenda: number | null;
  descontoAvistaPct: number; entradaMinimaPct: number; parcelasMax: number;
  aceitaFinanciamento: boolean; aceitaPermuta: boolean; observacoesComerciais: string | null;
  fotoPrincipalUrl: string | null; slug: string | null;
  corretorResponsavelId: string | null; createdBy: string;
  approvalStatus: string; approvedBy: string | null; approvedAt: string | null; approvalNotes: string | null;
  createdAt: string; updatedAt: string;
  corretorNome?: string;
  createdByName?: string; approvedByName?: string;
  photos?: { id: string; fileUrl: string; legenda: string | null; ordem: number }[];
  documents?: { id: string; fileUrl: string; nome: string; tipo: string }[];
}

function mapRow(r: Record<string, unknown>): ThirdPartyProperty {
  return {
    id: r.id as string, accountId: r.account_id as string, titulo: r.titulo as string,
    tipo: r.tipo as string, status: r.status as string,
    endereco: r.endereco as string | null, bairro: r.bairro as string | null,
    cidade: r.cidade as string | null, estado: r.estado as string | null, cep: r.cep as string | null,
    areaM2: r.area_m2 != null ? Number(r.area_m2) : null,
    areaConstruida: r.area_construida != null ? Number(r.area_construida) : null,
    areaTerreno: r.area_terreno != null ? Number(r.area_terreno) : null,
    areaHectares: r.area_hectares != null ? Number(r.area_hectares) : null,
    areaPrivativa: r.area_privativa != null ? Number(r.area_privativa) : null,
    areaComum: r.area_comum != null ? Number(r.area_comum) : null,
    quartos: r.quartos != null ? Number(r.quartos) : null,
    suites: r.suites != null ? Number(r.suites) : null,
    banheiros: r.banheiros != null ? Number(r.banheiros) : null,
    vagasGaragem: r.vagas_garagem != null ? Number(r.vagas_garagem) : null,
    suiteMaster: !!r.suite_master, closet: !!r.closet, banheira: !!r.banheira, lavabo: !!r.lavabo,
    vagasTipo: (r.vagas_tipo as string) || null, previsaoEntrega: (r.previsao_entrega as string) || null,
    andar: r.andar != null ? Number(r.andar) : null,
    unidadeApt: r.unidade_apt as string | null,
    anoConstrucao: r.ano_construcao != null ? Number(r.ano_construcao) : null,
    condominioNome: r.condominio_nome as string | null,
    condominioValor: r.condominio_valor != null ? Number(r.condominio_valor) : null,
    iptuValor: r.iptu_valor != null ? Number(r.iptu_valor) : null,
    frente: r.frente != null ? Number(r.frente) : null,
    fundo: r.fundo != null ? Number(r.fundo) : null,
    lateralEsquerda: r.lateral_esquerda != null ? Number(r.lateral_esquerda) : null,
    lateralDireita: r.lateral_direita != null ? Number(r.lateral_direita) : null,
    topografia: r.topografia as string | null,
    possuiAgua: !!r.possui_agua, possuiLuz: !!r.possui_luz, possuiEsgoto: !!r.possui_esgoto,
    possuiAsfalto: !!r.possui_asfalto, possuiEnergia: !!r.possui_energia,
    acesso: r.acesso as string | null, fonteAgua: r.fonte_agua as string | null,
    descricao: r.descricao as string | null, matricula: r.matricula as string | null,
    origem: (r.origem as string) || "permuta",
    valorAvaliado: r.valor_avaliado != null ? Number(r.valor_avaliado) : null,
    valorVenda: r.valor_venda != null ? Number(r.valor_venda) : null,
    descontoAvistaPct: Number(r.desconto_avista_pct || 0), entradaMinimaPct: Number(r.entrada_minima_pct || 0),
    parcelasMax: Number(r.parcelas_max || 1),
    aceitaFinanciamento: !!r.aceita_financiamento, aceitaPermuta: !!r.aceita_permuta,
    observacoesComerciais: r.observacoes_comerciais as string | null,
    fotoPrincipalUrl: r.foto_principal_url as string | null,
    slug: (r.slug as string) || null,
    corretorResponsavelId: r.corretor_responsavel_id as string | null,
    createdBy: r.created_by as string,
    approvalStatus: (r.approval_status as string) || "pending",
    approvedBy: r.approved_by as string | null,
    approvedAt: r.approved_at as string | null,
    approvalNotes: r.approval_notes as string | null,
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
    corretorNome: ((r.corretor as Record<string, unknown>)?.name as string) || undefined,
    createdByName: ((r.created_by_profile as Record<string, unknown>)?.full_name as string) || undefined,
    approvedByName: ((r.approved_by_profile as Record<string, unknown>)?.full_name as string) || undefined,
  };
}

export function useThirdPartyProperties(accountId: string | null, opts?: { userId?: string | null; isManagerRole?: boolean }) {
  const [properties, setProperties] = useState<ThirdPartyProperty[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    if (!supabase || !accountId) { setLoading(false); return; }
    setLoading(true);
    let query = supabase.from("third_party_properties")
      .select("*, corretor:corretor_responsavel_id(name), created_by_profile:profiles!created_by(full_name), approved_by_profile:profiles!approved_by(full_name)")
      .eq("account_id", accountId).neq("status", "inativo");
    // Broker/consultant: only approved or own submissions
    if (!opts?.isManagerRole && opts?.userId) {
      query = query.or(`approval_status.eq.approved,created_by.eq.${opts.userId}`);
    }
    const { data } = await query.order("created_at", { ascending: false });
    setProperties((data ?? []).map((r) => mapRow(r as Record<string, unknown>)));
    setLoading(false);
  }, [accountId, opts?.isManagerRole, opts?.userId]);

  useEffect(() => { void fetch_(); }, [fetch_]);

  return { properties, loading, refetch: fetch_ };
}

export function useThirdPartyProperty(id: string | null, accountId: string | null) {
  const [property, setProperty] = useState<ThirdPartyProperty | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    if (!supabase || !id || !accountId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from("third_party_properties")
      .select("*, corretor:corretor_responsavel_id(name), created_by_profile:profiles!created_by(full_name), approved_by_profile:profiles!approved_by(full_name)")
      .eq("id", id).maybeSingle();
    if (data) {
      const p = mapRow(data as Record<string, unknown>);
      const { data: photos } = await supabase.from("third_party_property_photos").select("id, file_url, legenda, ordem").eq("property_id", id).order("ordem");
      const { data: docs } = await supabase.from("third_party_property_documents").select("id, file_url, nome, tipo").eq("property_id", id).order("created_at", { ascending: false });
      p.photos = (photos ?? []).map((ph: Record<string, unknown>) => ({ id: ph.id as string, fileUrl: ph.file_url as string, legenda: ph.legenda as string | null, ordem: Number(ph.ordem) }));
      p.documents = (docs ?? []).map((d: Record<string, unknown>) => ({ id: d.id as string, fileUrl: d.file_url as string, nome: d.nome as string, tipo: d.tipo as string }));
      setProperty(p);
    }
    setLoading(false);
  }, [id, accountId]);

  useEffect(() => { void fetch_(); }, [fetch_]);

  return { property, loading, refetch: fetch_ };
}

export async function createProperty(accountId: string, userId: string, data: Record<string, unknown>): Promise<string> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data: inserted, error } = await supabase.from("third_party_properties").insert({
    account_id: accountId, created_by: userId, ...data,
  }).select("id").single();
  if (error) throw new Error(error.message);
  return inserted.id;
}

export async function updateProperty(id: string, data: Record<string, unknown>): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("third_party_properties").update(data).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function uploadPropertyPhoto(propertyId: string, accountId: string, file: File): Promise<string> {
  if (!supabase) throw new Error("Supabase not configured");
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${accountId}/${propertyId}/photos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage.from("properties").upload(path, file, { contentType: file.type });
  if (upErr) throw new Error(upErr.message);
  const { data: urlData } = supabase.storage.from("properties").getPublicUrl(path);
  const url = urlData.publicUrl;
  await supabase.from("third_party_property_photos").insert({ property_id: propertyId, account_id: accountId, file_url: url, storage_path: path, ordem: 0 });
  // Set as main photo if first
  const { count } = await supabase.from("third_party_property_photos").select("id", { count: "exact", head: true }).eq("property_id", propertyId);
  if (count === 1) await supabase.from("third_party_properties").update({ foto_principal_url: url }).eq("id", propertyId);
  return url;
}

export async function deletePropertyPhoto(photoId: string, storagePath?: string): Promise<void> {
  if (!supabase) return;
  if (storagePath) await supabase.storage.from("properties").remove([storagePath]);
  await supabase.from("third_party_property_photos").delete().eq("id", photoId);
}

export async function uploadPropertyDocument(propertyId: string, accountId: string, file: File, tipo: string, nome: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const ext = file.name.split(".").pop() || "pdf";
  const path = `${accountId}/${propertyId}/documents/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage.from("properties").upload(path, file, { contentType: file.type });
  if (upErr) throw new Error(upErr.message);
  const { data: urlData } = supabase.storage.from("properties").getPublicUrl(path);
  await supabase.from("third_party_property_documents").insert({ property_id: propertyId, account_id: accountId, file_url: urlData.publicUrl, storage_path: path, nome, tipo });
}

async function getPropertyMeta(propertyId: string) {
  if (!supabase) return null;
  const { data } = await supabase.from("third_party_properties").select("titulo, created_by, account_id").eq("id", propertyId).maybeSingle();
  return data as { titulo: string; created_by: string; account_id: string } | null;
}

async function notifyPropertyAction(accountId: string, recipientId: string, senderId: string, type: string, title: string, message: string, propertyId: string) {
  if (!supabase) return;
  supabase.from("notifications").insert({ account_id: accountId, recipient_id: recipientId, sender_id: senderId, type, title, message, action_url: `/imoveis/${propertyId}`, read: false }).then(() => {}, () => {});
}

export async function approveProperty(propertyId: string, userId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("third_party_properties").update({ approval_status: "approved", approved_by: userId, approved_at: new Date().toISOString(), approval_notes: null, status: "disponivel" }).eq("id", propertyId);
  if (error) throw new Error(error.message);
  const meta = await getPropertyMeta(propertyId);
  if (meta && meta.created_by !== userId) notifyPropertyAction(meta.account_id, meta.created_by, userId, "property_approved", "Imóvel aprovado", `O imóvel "${meta.titulo}" foi aprovado e está disponível para corretores.`, propertyId);
}

export async function rejectProperty(propertyId: string, userId: string, notes: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("third_party_properties").update({ approval_status: "rejected", approved_by: userId, approved_at: new Date().toISOString(), approval_notes: notes }).eq("id", propertyId);
  if (error) throw new Error(error.message);
  const meta = await getPropertyMeta(propertyId);
  if (meta && meta.created_by !== userId) notifyPropertyAction(meta.account_id, meta.created_by, userId, "property_rejected", "Imóvel rejeitado", `O imóvel "${meta.titulo}" foi rejeitado. Motivo: ${notes}`, propertyId);
}

export async function requestRevision(propertyId: string, userId: string, notes: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("third_party_properties").update({ approval_status: "revision", approved_by: userId, approved_at: new Date().toISOString(), approval_notes: notes }).eq("id", propertyId);
  if (error) throw new Error(error.message);
  const meta = await getPropertyMeta(propertyId);
  if (meta && meta.created_by !== userId) notifyPropertyAction(meta.account_id, meta.created_by, userId, "property_revision_requested", "Revisão solicitada", `Revisão solicitada para o imóvel "${meta.titulo}": ${notes}`, propertyId);
}

export async function resubmitProperty(propertyId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("third_party_properties").update({ approval_status: "pending", approval_notes: null }).eq("id", propertyId);
  if (error) throw new Error(error.message);
}

export async function notifyManagersNewProperty(accountId: string, senderId: string, propertyId: string, titulo: string, creatorName: string): Promise<void> {
  if (!supabase) return;
  const { data: mgrs } = await supabase.from("user_account_access").select("user_id").eq("account_id", accountId).in("role", ["owner", "director", "manager"]);
  for (const m of (mgrs || []) as Record<string, unknown>[]) {
    if (m.user_id === senderId) continue;
    notifyPropertyAction(accountId, m.user_id as string, senderId, "property_pending_approval", "Novo imóvel para aprovar", `"${titulo}" cadastrado por ${creatorName}. Aguardando aprovação.`, propertyId);
  }
}
