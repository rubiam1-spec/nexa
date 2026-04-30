import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useAuth } from "../../../app/contexts/AuthContext";
import { useScreen } from "../../../shared/hooks/useIsMobile";
import { createProperty, updateProperty, uploadPropertyPhoto, uploadPropertyDocument, notifyManagersNewProperty, useThirdPartyProperty, deletePropertyPhoto } from "../hooks/useThirdPartyProperties";
import { maskCurrency, currencyToNumber, maskCEP, UF_OPTIONS } from "../../../shared/utils/masks";
import { generateSlug } from "../../../shared/utils/generateSlug";

const T = { ink: "var(--surface-base)", carbon: "var(--surface-raised)", stone: "var(--border-default)", chalk: "var(--text-primary)", bone: "var(--text-secondary)", fog: "var(--text-muted)", slate: "var(--text-disabled)", sprout: "var(--interactive-primary)" };
const IS: React.CSSProperties = { width: "100%", background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 8, padding: "10px 14px", color: T.chalk, fontSize: 14, outline: "none", boxSizing: "border-box" };
const LBL: React.CSSProperties = { fontSize: 10, color: T.fog, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 4 };

const TIPOS: { value: string; label: string; icon: string }[] = [
  { value: "terreno", label: "Terreno", icon: "▦" }, { value: "casa", label: "Casa", icon: "⌂" },
  { value: "apartamento", label: "Apto", icon: "◫" }, { value: "chacara", label: "Chácara", icon: "♣" },
  { value: "fazenda", label: "Fazenda", icon: "◈" }, { value: "comercial", label: "Comercial", icon: "◻" },
  { value: "sala", label: "Sala", icon: "▯" }, { value: "galpao", label: "Galpão", icon: "⊟" },
  { value: "outro", label: "Outro", icon: "+" },
];

const DOC_TYPE_LABELS: Record<string, string> = { matricula: "Matrícula", escritura: "Escritura", iptu: "IPTU", laudo_avaliacao: "Laudo", contrato: "Contrato", procuracao: "Procuração", certidao: "Certidão", outro: "Outro" };
const RURAL = new Set(["chacara", "fazenda"]);
const HAS_QUARTOS = new Set(["casa", "apartamento", "chacara"]);
const HAS_CONDO = new Set(["apartamento", "sala"]);
const HAS_TERRENO_DIMS = new Set(["terreno"]);
const HAS_INFRA = new Set(["terreno", "galpao"]);

export default function ThirdPartyPropertyFormPage() {
  const { id: editId } = useParams<{ id: string }>();
  const isEditing = !!editId;
  const navigate = useNavigate();
  const { account } = useAccount();
  const { authenticatedProfile } = useAuth();
  const screen = useScreen();
  const isMobile = screen.isMobile;
  const accountId = account?.accountId ?? null;
  const userId = authenticatedProfile?.id ?? null;
  const numRef = useRef<HTMLInputElement>(null);
  const addrRef = useRef<HTMLInputElement>(null);

  // Core
  const [tipo, setTipo] = useState("terreno");
  const [titulo, setTitulo] = useState("");
  const [origem, setOrigem] = useState("permuta");
  const [descricao, setDescricao] = useState("");

  // Location (urban)
  const [cep, setCep] = useState(""); const [cepLoading, setCepLoading] = useState(false); const [cepErr, setCepErr] = useState("");
  const [endereco, setEndereco] = useState(""); const [numero, setNumero] = useState(""); const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState(""); const [cidade, setCidade] = useState("Cascavel"); const [estado, setEstado] = useState("PR");

  // Location (rural)
  const [refLocal, setRefLocal] = useState(""); const [lat, setLat] = useState(""); const [lng, setLng] = useState("");

  // Characteristics
  const [areaM2, setAreaM2] = useState(""); const [areaConstruida, setAreaConstruida] = useState(""); const [areaTerreno, setAreaTerreno] = useState("");
  const [areaHectares, setAreaHectares] = useState("");
  const [areaPrivativa, setAreaPrivativa] = useState(""); const [areaComum, setAreaComum] = useState("");
  const [quartos, setQuartos] = useState(""); const [suites, setSuites] = useState(""); const [banheiros, setBanheiros] = useState(""); const [vagas, setVagas] = useState("");
  const [suiteMaster, setSuiteMaster] = useState(false); const [closet, setCloset] = useState(false);
  const [banheira, setBanheira] = useState(false); const [lavabo, setLavabo] = useState(false);
  const [andar, setAndar] = useState(""); const [unidadeApt, setUnidadeApt] = useState(""); const [anoConstrucao, setAnoConstrucao] = useState("");
  const [vagasTipo, setVagasTipo] = useState(""); const [previsaoEntrega, setPrevisaoEntrega] = useState(""); const [statusConstrucao, setStatusConstrucao] = useState<"pronto" | "na_planta">("pronto");
  const [condNome, setCondNome] = useState(""); const [condValor, setCondValor] = useState(""); const [iptuValor, setIptuValor] = useState("");
  const [frente, setFrente] = useState(""); const [fundo, setFundo] = useState(""); const [latEsq, setLatEsq] = useState(""); const [latDir, setLatDir] = useState("");
  const [topografia, setTopografia] = useState("");
  const [possuiAgua, setPossuiAgua] = useState(false); const [possuiLuz, setPossuiLuz] = useState(false);
  const [possuiEsgoto, setPossuiEsgoto] = useState(false); const [possuiAsfalto, setPossuiAsfalto] = useState(false);
  const [possuiEnergia, setPossuiEnergia] = useState(false);
  const [acesso, setAcesso] = useState(""); const [fonteAgua, setFonteAgua] = useState(""); const [tipoSolo, setTipoSolo] = useState("");
  const [benfeitorias, setBenfeitorias] = useState(""); const [culturas, setCulturas] = useState("");
  const [ccir, setCcir] = useState(""); const [car, setCar] = useState(""); const [nirf, setNirf] = useState("");
  const [matricula, setMatricula] = useState("");

  // Values
  const [valorAvaliado, setValorAvaliado] = useState(""); const [valorVenda, setValorVenda] = useState("");
  const [descontoAvista, setDescontoAvista] = useState(""); const [entradaMinima, setEntradaMinima] = useState("");
  const [parcelasMax, setParcelasMax] = useState("1");
  const [aceitaFinanciamento, setAceitaFinanciamento] = useState(false); const [aceitaPermuta, setAceitaPermuta] = useState(false);
  const [obsComerciais, setObsComerciais] = useState("");

  // Photos
  const [photoFiles, setPhotoFiles] = useState<{ file: File; preview: string }[]>([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Documents
  const [docFiles, setDocFiles] = useState<{ file: File; tipo: string; nome: string }[]>([]);
  const [editingDocIdx, setEditingDocIdx] = useState<number | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Existing media (edit mode)
  const [existingPhotos, setExistingPhotos] = useState<{ id: string; fileUrl: string; storagePath?: string }[]>([]);
  const [existingDocs, setExistingDocs] = useState<{ id: string; fileUrl: string; nome: string; tipo: string }[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);

  const [saving, setSaving] = useState(false); const [progress, setProgress] = useState(""); const [error, setError] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(isEditing);

  // Load existing property data for edit mode — run ONCE only
  const { property: editProp, loading: editPropLoading } = useThirdPartyProperty(editId ?? null, accountId);
  const [editLoaded, setEditLoaded] = useState(false);
  useEffect(() => {
    if (!isEditing || !editProp || editLoaded) return;
    setEditLoaded(true);
    setTipo(editProp.tipo); setTitulo(editProp.titulo); setOrigem(editProp.origem);
    setDescricao(editProp.descricao || ""); setMatricula(editProp.matricula || "");
    // Location — load endereco, stripping embedded "nº XXX" to avoid duplication with numero field
    if (editProp.endereco) {
      const numMatch = editProp.endereco.match(/nº?\s*(\d+)/);
      const cleanAddr = editProp.endereco.replace(/,?\s*nº?\s*\d+/g, "").trim().replace(/,\s*$/, "");
      setEndereco(cleanAddr);
      if (numMatch && !numero) setNumero(numMatch[1]);
    }
    setBairro(editProp.bairro || ""); setCidade(editProp.cidade || "Cascavel"); setEstado(editProp.estado || "PR");
    if (editProp.cep) setCep(editProp.cep);
    // Characteristics
    if (editProp.areaM2) setAreaM2(String(editProp.areaM2));
    if (editProp.areaConstruida) setAreaConstruida(String(editProp.areaConstruida));
    if (editProp.areaTerreno) setAreaTerreno(String(editProp.areaTerreno));
    if (editProp.areaHectares) setAreaHectares(String(editProp.areaHectares));
    if (editProp.areaPrivativa) setAreaPrivativa(String(editProp.areaPrivativa));
    if (editProp.areaComum) setAreaComum(String(editProp.areaComum));
    if (editProp.quartos) setQuartos(String(editProp.quartos));
    if (editProp.suites) setSuites(String(editProp.suites));
    if (editProp.banheiros) setBanheiros(String(editProp.banheiros));
    setSuiteMaster(editProp.suiteMaster); setCloset(editProp.closet);
    setBanheira(editProp.banheira); setLavabo(editProp.lavabo);
    if (editProp.vagasGaragem) setVagas(String(editProp.vagasGaragem));
    if (editProp.vagasTipo) setVagasTipo(editProp.vagasTipo);
    if (editProp.previsaoEntrega) { setStatusConstrucao("na_planta"); setPrevisaoEntrega(editProp.previsaoEntrega); } else { setStatusConstrucao("pronto"); }
    if (editProp.andar) setAndar(String(editProp.andar));
    if (editProp.unidadeApt) setUnidadeApt(editProp.unidadeApt);
    if (editProp.anoConstrucao) setAnoConstrucao(String(editProp.anoConstrucao));
    if (editProp.condominioNome) setCondNome(editProp.condominioNome);
    if (editProp.frente) setFrente(String(editProp.frente));
    if (editProp.fundo) setFundo(String(editProp.fundo));
    if (editProp.lateralEsquerda) setLatEsq(String(editProp.lateralEsquerda));
    if (editProp.lateralDireita) setLatDir(String(editProp.lateralDireita));
    if (editProp.topografia) setTopografia(editProp.topografia);
    setPossuiAgua(editProp.possuiAgua); setPossuiLuz(editProp.possuiLuz);
    setPossuiEsgoto(editProp.possuiEsgoto); setPossuiAsfalto(editProp.possuiAsfalto);
    setPossuiEnergia(editProp.possuiEnergia);
    if (editProp.acesso) setAcesso(editProp.acesso);
    if (editProp.fonteAgua) setFonteAgua(editProp.fonteAgua);
    // Values — convert numbers to formatted currency strings for maskCurrency compatibility
    // maskCurrency expects the state to be a formatted string like "R$ 350.000,00"
    // currencyToNumber parses that back to 350000. So we must store as formatted.
    const fmtCur = (v: number | null) => v != null && v > 0 ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "";
    if (editProp.valorAvaliado) setValorAvaliado(fmtCur(editProp.valorAvaliado));
    if (editProp.valorVenda) setValorVenda(fmtCur(editProp.valorVenda));
    if (editProp.condominioValor) setCondValor(fmtCur(editProp.condominioValor));
    if (editProp.iptuValor) setIptuValor(fmtCur(editProp.iptuValor));
    if (editProp.descontoAvistaPct) setDescontoAvista(String(editProp.descontoAvistaPct));
    if (editProp.entradaMinimaPct) setEntradaMinima(String(editProp.entradaMinimaPct));
    if (editProp.parcelasMax > 1) setParcelasMax(String(editProp.parcelasMax));
    setAceitaFinanciamento(editProp.aceitaFinanciamento); setAceitaPermuta(editProp.aceitaPermuta);
    if (editProp.observacoesComerciais) setObsComerciais(editProp.observacoesComerciais);
    // Photos & docs
    if (editProp.photos) {
      setExistingPhotos(editProp.photos.map((ph) => ({ id: ph.id, fileUrl: ph.fileUrl })));
      const capaIdx = editProp.photos.findIndex((ph) => ph.fileUrl === editProp.fotoPrincipalUrl);
      if (capaIdx >= 0) setCoverIndex(capaIdx);
    }
    if (editProp.documents) setExistingDocs(editProp.documents);
    setLoadingEdit(false);
  }, [isEditing, editProp]);

  useEffect(() => { if (!isEditing) setLoadingEdit(false); }, [isEditing]);

  const isRural = RURAL.has(tipo);

  // CEP auto-fill
  const handleCep = useCallback(async (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    setCep(digits); setCepErr("");
    if (digits.length === 8) {
      setCepLoading(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
        const d = await res.json();
        if (d.erro) { setCepErr("CEP não encontrado"); } else {
          setEndereco(d.logradouro || ""); setBairro(d.bairro || ""); setCidade(d.localidade || ""); setEstado(d.uf || "");
          if (d.logradouro) numRef.current?.focus(); else addrRef.current?.focus();
        }
      } catch { setCepErr("Erro ao buscar CEP"); }
      finally { setCepLoading(false); }
    }
  }, []);

  // Photo handlers
  function handlePhotoSelect(files: FileList | null) {
    if (!files) return;
    const MAX = 10 * 1024 * 1024; // 10MB
    const accepted = Array.from(files).filter((f) => f.type.startsWith("image/") && f.size <= MAX);
    const newEntries = accepted.map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setPhotoFiles((prev) => [...prev, ...newEntries]);
  }
  function removePhoto(idx: number) {
    setPhotoFiles((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      const next = prev.filter((_, i) => i !== idx);
      if (coverIndex === idx) setCoverIndex(0);
      else if (coverIndex > idx) setCoverIndex((c) => c - 1);
      return next;
    });
  }

  // Document handlers
  function handleDocSelect(files: FileList | null) {
    if (!files) return;
    const MAX = 10 * 1024 * 1024;
    const accepted = Array.from(files).filter((f) => f.size <= MAX && (f.type.startsWith("image/") || f.type === "application/pdf"));
    const newEntries = accepted.map((file) => ({ file, tipo: "outro" as string, nome: file.name }));
    setDocFiles((prev) => [...prev, ...newEntries]);
    if (newEntries.length > 0) setEditingDocIdx(docFiles.length); // focus first new one
  }
  function removeDoc(idx: number) {
    setDocFiles((prev) => prev.filter((_, i) => i !== idx));
    if (editingDocIdx === idx) setEditingDocIdx(null);
  }

  // Image resize utility (max 1920px, 85% quality)
  function resizeImage(file: File): Promise<File> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1920;
        let w = img.width, h = img.height;
        if (w <= MAX && h <= MAX) { resolve(file); return; }
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; } else { w = Math.round(w * MAX / h); h = MAX; }
        const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          resolve(blob ? new File([blob], file.name, { type: "image/jpeg" }) : file);
        }, "image/jpeg", 0.85);
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  }

  function buildPayload(): Record<string, unknown> {
    const enderecoFull = [endereco, numero ? `nº ${numero}` : "", complemento].filter(Boolean).join(", ");
    return {
      titulo: titulo.trim(), tipo, origem, slug: generateSlug(titulo),
      endereco: enderecoFull || null, bairro: bairro.trim() || null,
      cidade: cidade.trim() || null, estado, cep: cep || null, numero: numero.trim() || null, complemento: complemento.trim() || null,
      area_m2: areaM2 ? Number(areaM2) : null, area_construida: areaConstruida ? Number(areaConstruida) : null,
      area_terreno: areaTerreno ? Number(areaTerreno) : null, area_hectares: areaHectares ? Number(areaHectares) : null,
      area_privativa: areaPrivativa ? Number(areaPrivativa) : null,
      area_comum: areaComum ? Number(areaComum) : (areaPrivativa && areaConstruida && Number(areaConstruida) > Number(areaPrivativa) ? Number(areaConstruida) - Number(areaPrivativa) : null),
      quartos: quartos ? Number(quartos) : null, suites: suites ? Number(suites) : 0, banheiros: banheiros ? Number(banheiros) : null, vagas_garagem: vagas ? Number(vagas) : null,
      suite_master: suiteMaster, closet, banheira, lavabo,
      vagas_tipo: vagasTipo || null,
      andar: andar ? Number(andar) : null, unidade_apt: unidadeApt.trim() || null,
      ano_construcao: statusConstrucao === "pronto" && anoConstrucao ? Number(anoConstrucao) : null,
      previsao_entrega: statusConstrucao === "na_planta" && previsaoEntrega.trim() ? previsaoEntrega.trim() : null,
      condominio_nome: condNome.trim() || null, condominio_valor: condValor ? currencyToNumber(condValor) : null,
      iptu_valor: iptuValor ? currencyToNumber(iptuValor) : null,
      frente: frente ? Number(frente) : null, fundo: fundo ? Number(fundo) : null,
      lateral_esquerda: latEsq ? Number(latEsq) : null, lateral_direita: latDir ? Number(latDir) : null,
      topografia: topografia || null,
      possui_agua: possuiAgua, possui_luz: possuiLuz, possui_esgoto: possuiEsgoto, possui_asfalto: possuiAsfalto,
      possui_energia: possuiEnergia, acesso: acesso || null, fonte_agua: fonteAgua || null, tipo_solo: tipoSolo.trim() || null,
      benfeitorias: benfeitorias.trim() || null, culturas: culturas.trim() || null,
      ccir: ccir.trim() || null, car: car.trim() || null, nirf: nirf.trim() || null,
      referencia_localizacao: refLocal.trim() || null,
      latitude: lat ? Number(lat) : null, longitude: lng ? Number(lng) : null,
      descricao: descricao.trim() || null, matricula: matricula.trim() || null,
      valor_avaliado: valorAvaliado ? currencyToNumber(valorAvaliado) : null,
      valor_venda: valorVenda ? currencyToNumber(valorVenda) : null,
      desconto_avista_pct: descontoAvista ? Number(descontoAvista) : 0,
      entrada_minima_pct: entradaMinima ? Number(entradaMinima) : 0,
      parcelas_max: parcelasMax ? Number(parcelasMax) : 1,
      aceita_financiamento: aceitaFinanciamento, aceita_permuta: aceitaPermuta,
      observacoes_comerciais: obsComerciais.trim() || null,
    };
  }

  async function handleSave() {
    if (!accountId || !userId || !titulo.trim()) { setError("Título é obrigatório."); return; }
    setSaving(true); setError(null); setProgress(isEditing ? "Atualizando imóvel..." : "Salvando dados do imóvel...");
    try {
      const payload = buildPayload();
      let propertyId: string;

      if (isEditing && editId) {
        // UPDATE existing property
        propertyId = editId;
        await updateProperty(propertyId, { ...payload, updated_at: new Date().toISOString() });

        // Delete removed existing photos
        for (const photoId of removedPhotoIds) {
          try { await deletePropertyPhoto(photoId); } catch { /* non-blocking */ }
        }

        // Determine new cover from remaining existing + new photos
        const remainingExisting = existingPhotos.filter((p) => !removedPhotoIds.includes(p.id));
        const totalExistingCount = remainingExisting.length;

        // Upload NEW photos only
        if (photoFiles.length > 0) {
          for (let i = 0; i < photoFiles.length; i++) {
            setProgress(`Enviando foto ${i + 1} de ${photoFiles.length}...`);
            const resized = await resizeImage(photoFiles[i].file);
            await uploadPropertyPhoto(propertyId, accountId, resized);
          }
        }

        // Update cover: if coverIndex points to an existing photo, use its URL; otherwise it's a new photo
        if (coverIndex < totalExistingCount && remainingExisting[coverIndex]) {
          await updateProperty(propertyId, { foto_principal_url: remainingExisting[coverIndex].fileUrl });
        }
      } else {
        // CREATE new property
        propertyId = await createProperty(accountId, userId, payload);

        // Upload photos
        if (photoFiles.length > 0) {
          let coverUrl: string | null = null;
          for (let i = 0; i < photoFiles.length; i++) {
            setProgress(`Enviando foto ${i + 1} de ${photoFiles.length}...`);
            const resized = await resizeImage(photoFiles[i].file);
            const url = await uploadPropertyPhoto(propertyId, accountId, resized);
            if (i === coverIndex) coverUrl = url;
          }
          if (coverUrl) await updateProperty(propertyId, { foto_principal_url: coverUrl });
        }

        // Notify managers
        notifyManagersNewProperty(accountId, userId, propertyId, titulo.trim(), authenticatedProfile?.fullName || "Equipe").catch(() => {});
      }

      // Upload NEW documents (both create and edit)
      if (docFiles.length > 0) {
        for (let i = 0; i < docFiles.length; i++) {
          setProgress(`Enviando documento ${i + 1} de ${docFiles.length}...`);
          await uploadPropertyDocument(propertyId, accountId, docFiles[i].file, docFiles[i].tipo, docFiles[i].nome);
        }
      }

      setProgress(""); setSaving(false);
      const toastMsg = isEditing ? "Imóvel atualizado ✓" : "Imóvel cadastrado! Aguardando aprovação do gestor.";
      navigate(`/imoveis/${propertyId}?toast=${encodeURIComponent(toastMsg)}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao salvar"); setProgress(""); }
    finally { setSaving(false); }
  }

  const grid = isMobile ? "1fr" : "1fr 1fr 1fr";
  const grid2 = isMobile ? "1fr" : "1fr 1fr";

  if (loadingEdit || editPropLoading) return <div style={{ maxWidth: 720, margin: "0 auto", padding: 32 }}><div className="nexa-skeleton" style={{ height: 24, width: 200, marginBottom: 20 }} /><div className="nexa-skeleton" style={{ height: 300, borderRadius: 12 }} /></div>;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <nav style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 20, fontSize: 12 }}>
        <a href="/imoveis" style={{ color: T.fog, textDecoration: "none" }}>Imóveis de Terceiros</a>
        <span style={{ color: T.slate }}>›</span>
        {isEditing && editProp ? <><a href={`/imoveis/${editId}`} style={{ color: T.fog, textDecoration: "none" }}>{editProp.titulo}</a><span style={{ color: T.slate }}>›</span></> : null}
        <span style={{ color: T.bone }}>{isEditing ? "Editar" : "Cadastrar imóvel"}</span>
      </nav>
      <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic", fontSize: isMobile ? 22 : 28, fontWeight: 400, color: T.bone, margin: "0 0 28px" }}>{isEditing ? "Editar imóvel" : "Cadastrar imóvel"}</h1>

      {/* TIPO — visual card selector */}
      <Section title="Tipo de imóvel">
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : "repeat(5, 1fr)", gap: 8 }}>
          {TIPOS.map((t) => (
            <button key={t.value} type="button" onClick={() => setTipo(t.value)} style={{ padding: "14px 8px", background: tipo === t.value ? "rgba(74,222,128,0.08)" : T.carbon, border: `1px solid ${tipo === t.value ? "var(--interactive-primary)" : T.stone}`, borderRadius: 8, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, transition: "all 150ms", color: tipo === t.value ? "var(--interactive-primary)" : T.fog }}>
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 600 }}>{t.label}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* IDENTIFICAÇÃO */}
      <Section title="Identificação">
        <div style={{ display: "grid", gridTemplateColumns: grid, gap: 12 }}>
          <div style={{ gridColumn: isMobile ? "1" : "1 / -1" }}><label style={LBL}>Título *</label><input style={IS} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Casa 3Q — Jardim Europa" /></div>
          <div><label style={LBL}>Origem</label><select style={IS} value={origem} onChange={(e) => setOrigem(e.target.value)}><option value="permuta">Permuta</option><option value="aquisicao">Aquisição</option><option value="outro">Outro</option></select></div>
          <div><label style={LBL}>Matrícula</label><input style={IS} value={matricula} onChange={(e) => setMatricula(e.target.value)} /></div>
        </div>
      </Section>

      {/* LOCALIZAÇÃO */}
      <Section title={isRural ? "Localização rural" : "Localização"}>
        {isRural ? (
          <div style={{ display: "grid", gridTemplateColumns: grid2, gap: 12 }}>
            <div><label style={LBL}>Município *</label><input style={IS} value={cidade} onChange={(e) => setCidade(e.target.value)} /></div>
            <div><label style={LBL}>UF</label><select style={IS} value={estado} onChange={(e) => setEstado(e.target.value)}>{UF_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}</select></div>
            <div style={{ gridColumn: "1 / -1" }}><label style={LBL}>Referência de localização</label><textarea rows={2} style={{ ...IS, resize: "vertical" }} value={refLocal} onChange={(e) => setRefLocal(e.target.value)} placeholder="Estrada da Cachoeira, km 7, próximo à ponte..." /></div>
            <div><label style={LBL}>Latitude</label><input style={IS} value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-25.3005" onPaste={(e) => { const t = e.clipboardData.getData("text"); const m = t.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/); if (m) { e.preventDefault(); setLat(m[1]); setLng(m[2]); } }} /></div>
            <div><label style={LBL}>Longitude</label><input style={IS} value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-53.4321" /></div>
            {(lat && lng) && <div style={{ gridColumn: "1 / -1" }}><button type="button" onClick={() => window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank")} style={{ fontSize: 12, color: T.sprout, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Abrir no Google Maps →</button></div>}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: grid, gap: 12 }}>
            <div><label style={LBL}>CEP {cepLoading && <span style={{ color: T.sprout }}>buscando...</span>}</label><input style={{ ...IS, borderColor: cepErr ? "#F87171" : undefined }} value={maskCEP(cep)} onChange={(e) => handleCep(e.target.value)} maxLength={9} placeholder="00000-000" />{cepErr && <span style={{ fontSize: 11, color: "#F87171" }}>{cepErr}</span>}</div>
            <div style={{ gridColumn: isMobile ? "1" : "1 / 3" }}><label style={LBL}>Endereço</label><input ref={addrRef} style={IS} value={endereco} onChange={(e) => setEndereco(e.target.value)} /></div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: "0 0 90px" }}><label style={LBL}>Número</label><input ref={numRef} style={IS} value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="123" /></div>
              <div style={{ flex: 1 }}><label style={LBL}>Complemento</label><input style={IS} value={complemento} onChange={(e) => setComplemento(e.target.value)} placeholder="Apto 4" /></div>
            </div>
            <div><label style={LBL}>Bairro</label><input style={IS} value={bairro} onChange={(e) => setBairro(e.target.value)} /></div>
            <div><label style={LBL}>Cidade</label><input style={IS} value={cidade} onChange={(e) => setCidade(e.target.value)} /></div>
            <div><label style={LBL}>UF</label><select style={IS} value={estado} onChange={(e) => setEstado(e.target.value)}>{UF_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}</select></div>
          </div>
        )}
      </Section>

      {/* CARACTERÍSTICAS (dynamic by type) */}
      <Section title="Características">
        <div style={{ display: "grid", gridTemplateColumns: grid, gap: 12 }}>
          {/* Area fields by type */}
          {isRural && <div><label style={LBL}>Área (hectares)</label><input type="number" style={IS} value={areaHectares} onChange={(e) => setAreaHectares(e.target.value)} placeholder="12.5" /></div>}
          {isRural && <div><label style={LBL}>Área construída (m²)</label><input type="number" style={IS} value={areaConstruida} onChange={(e) => setAreaConstruida(e.target.value)} /></div>}
          {!isRural && HAS_QUARTOS.has(tipo) && <>
            <div><label style={LBL}>Área privativa (m²)</label><input type="number" step="0.01" style={IS} value={areaPrivativa} onChange={(e) => setAreaPrivativa(e.target.value)} placeholder="165.00" /></div>
            <div><label style={LBL}>Área total (m²)</label><input type="number" step="0.01" style={IS} value={areaConstruida} onChange={(e) => setAreaConstruida(e.target.value)} placeholder="203.94" /></div>
            <div><label style={LBL}>Área comum (m²)</label><input type="number" step="0.01" style={{ ...IS, color: areaComum ? undefined : "var(--text-disabled)" }} value={areaComum || (areaPrivativa && areaConstruida && Number(areaConstruida) > Number(areaPrivativa) ? (Number(areaConstruida) - Number(areaPrivativa)).toFixed(2) : "")} onChange={(e) => setAreaComum(e.target.value)} placeholder="automático" /></div>
          </>}
          {!isRural && !HAS_QUARTOS.has(tipo) && tipo !== "terreno" && <div><label style={LBL}>Área construída (m²)</label><input type="number" style={IS} value={areaConstruida} onChange={(e) => setAreaConstruida(e.target.value)} /></div>}
          {(tipo === "casa" || tipo === "comercial" || tipo === "galpao") && <div><label style={LBL}>Área do terreno (m²)</label><input type="number" style={IS} value={areaTerreno} onChange={(e) => setAreaTerreno(e.target.value)} /></div>}
          {(tipo === "terreno" || tipo === "outro") && <div><label style={LBL}>Área (m²)</label><input type="number" style={IS} value={areaM2} onChange={(e) => setAreaM2(e.target.value)} /></div>}
          {HAS_QUARTOS.has(tipo) && <>
            <div><label style={LBL}>Quartos <span style={{ fontWeight: 400, opacity: 0.6 }}>total</span></label><input type="number" min={0} style={IS} value={quartos} onChange={(e) => { const v = e.target.value; setQuartos(v); if (Number(v) < Number(suites)) setSuites(v); }} /></div>
            <div><label style={LBL}>Suítes</label><input type="number" min={0} max={Number(quartos) || 99} style={IS} value={suites} onChange={(e) => { const v = e.target.value; setSuites(v); if (Number(v) > Number(quartos)) setQuartos(v); if (Number(banheiros) < Number(v)) setBanheiros(v); if (Number(v) === 0) { setSuiteMaster(false); setCloset(false); } }} /></div>
            <div><label style={LBL}>Banheiros <span style={{ fontWeight: 400, opacity: 0.6 }}>total</span></label><input type="number" min={Number(suites) || 0} style={IS} value={banheiros} onChange={(e) => { const v = e.target.value; setBanheiros(v); if (Number(v) < Number(suites)) setBanheiros(suites); if (Number(v) === 0) { setBanheira(false); setLavabo(false); } }} /></div>
          </>}
          {/* Toggles condicionais — quartos */}
          {HAS_QUARTOS.has(tipo) && Number(suites) > 0 && (
            <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, animation: "fadeInUp 200ms cubic-bezier(0.16,1,0.3,1) both" }}>
              <TogCard label="Suíte master" checked={suiteMaster} onChange={setSuiteMaster} />
              <TogCard label="Closet" checked={closet} onChange={setCloset} />
            </div>
          )}
          {/* Toggles condicionais — banheiros */}
          {HAS_QUARTOS.has(tipo) && Number(banheiros) > 0 && (
            <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, animation: "fadeInUp 200ms cubic-bezier(0.16,1,0.3,1) both" }}>
              <TogCard label="Banheira" checked={banheira} onChange={setBanheira} />
              <TogCard label="Lavabo" checked={lavabo} onChange={setLavabo} />
            </div>
          )}
          {!isRural && tipo !== "terreno" && <div><label style={LBL}>Vagas de garagem</label><input type="number" style={IS} value={vagas} onChange={(e) => setVagas(e.target.value)} /></div>}
          {/* Tipo de vaga — aparece quando vagas > 0 */}
          {!isRural && tipo !== "terreno" && Number(vagas) > 0 && (
            <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, animation: "fadeInUp 200ms cubic-bezier(0.16,1,0.3,1) both" }}>
              {[{ v: "lado_a_lado", l: "Lado a lado" }, { v: "gaveta", l: "Gaveta" }, { v: "indeterminada", l: "Indeterminada" }].map((t) => (
                <button key={t.v} type="button" onClick={() => setVagasTipo(vagasTipo === t.v ? "" : t.v)} style={{ padding: "10px 14px", background: vagasTipo === t.v ? "rgba(74,222,128,0.04)" : T.ink, border: `1px solid ${vagasTipo === t.v ? "var(--interactive-primary)" : T.stone}`, borderRadius: 8, cursor: "pointer", color: vagasTipo === t.v ? "var(--interactive-primary)" : T.fog, fontSize: 13, fontWeight: vagasTipo === t.v ? 600 : 400, textAlign: "center", transition: "all 150ms", minHeight: 44 }}>{t.l}</button>
              ))}
            </div>
          )}
          {HAS_CONDO.has(tipo) && <><div><label style={LBL}>Andar</label><input type="number" style={IS} value={andar} onChange={(e) => setAndar(e.target.value)} /></div><div><label style={LBL}>Unidade/Apto</label><input style={IS} value={unidadeApt} onChange={(e) => setUnidadeApt(e.target.value)} /></div></>}
          {/* Pronto / Na planta */}
          {!isRural && tipo !== "terreno" && (
            <>
              <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {([["pronto", "Pronto para morar"], ["na_planta", "Na planta / Em construção"]] as const).map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setStatusConstrucao(v)} style={{ padding: "10px 14px", background: statusConstrucao === v ? "rgba(74,222,128,0.04)" : T.ink, border: `1px solid ${statusConstrucao === v ? "var(--interactive-primary)" : T.stone}`, borderRadius: 8, cursor: "pointer", color: statusConstrucao === v ? "var(--interactive-primary)" : T.fog, fontSize: 13, fontWeight: statusConstrucao === v ? 600 : 400, textAlign: "center", transition: "all 150ms", minHeight: 44 }}>{l}</button>
                ))}
              </div>
              {statusConstrucao === "pronto" ? (
                <div><label style={LBL}>Ano de construção</label><input type="number" style={IS} value={anoConstrucao} onChange={(e) => setAnoConstrucao(e.target.value)} placeholder="2024" /></div>
              ) : (
                <div><label style={LBL}>Previsão de entrega</label><input style={IS} value={previsaoEntrega} onChange={(e) => setPrevisaoEntrega(e.target.value)} placeholder="Dezembro 2025" /></div>
              )}
            </>
          )}
          <div style={{ gridColumn: isMobile ? "1" : "1 / -1" }}><label style={LBL}>Descrição</label><textarea rows={3} style={{ ...IS, resize: "vertical" }} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
        </div>
      </Section>

      {/* TERRAIN DIMENSIONS */}
      {HAS_TERRENO_DIMS.has(tipo) && (
        <Section title="Dimensões do terreno">
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 12 }}>
            <div><label style={LBL}>Frente (m)</label><input type="number" style={IS} value={frente} onChange={(e) => setFrente(e.target.value)} /></div>
            <div><label style={LBL}>Fundo (m)</label><input type="number" style={IS} value={fundo} onChange={(e) => setFundo(e.target.value)} /></div>
            <div><label style={LBL}>Lateral esq. (m)</label><input type="number" style={IS} value={latEsq} onChange={(e) => setLatEsq(e.target.value)} /></div>
            <div><label style={LBL}>Lateral dir. (m)</label><input type="number" style={IS} value={latDir} onChange={(e) => setLatDir(e.target.value)} /></div>
            <div><label style={LBL}>Topografia</label><select style={IS} value={topografia} onChange={(e) => setTopografia(e.target.value)}><option value="">—</option><option value="plano">Plano</option><option value="aclive">Aclive</option><option value="declive">Declive</option><option value="irregular">Irregular</option></select></div>
          </div>
        </Section>
      )}

      {/* CONDOMINIUM */}
      {HAS_CONDO.has(tipo) && (
        <Section title="Condomínio">
          <div style={{ display: "grid", gridTemplateColumns: grid, gap: 12 }}>
            <div style={{ gridColumn: isMobile ? "1" : "1 / 3" }}><label style={LBL}>Nome do condomínio</label><input style={IS} value={condNome} onChange={(e) => setCondNome(e.target.value)} placeholder="Residencial Vista Verde" /></div>
            <div><label style={LBL}>Condomínio (R$/mês)</label><input style={IS} value={condValor ? maskCurrency(String(Math.round(currencyToNumber(condValor) * 100))) : ""} onChange={(e) => setCondValor(e.target.value)} placeholder="R$ 500,00" /></div>
          </div>
        </Section>
      )}

      {/* INFRASTRUCTURE (terrain/warehouse) */}
      {(HAS_INFRA.has(tipo) || isRural) && (
        <Section title="Infraestrutura">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {!isRural && <><TogCard label="Água encanada" checked={possuiAgua} onChange={setPossuiAgua} /><TogCard label="Energia elétrica" checked={possuiLuz} onChange={setPossuiLuz} /><TogCard label="Rede de esgoto" checked={possuiEsgoto} onChange={setPossuiEsgoto} /><TogCard label="Rua asfaltada" checked={possuiAsfalto} onChange={setPossuiAsfalto} /></>}
            {isRural && <>
              <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: grid, gap: 12 }}>
                <div><label style={LBL}>Tipo de acesso</label><select style={IS} value={acesso} onChange={(e) => setAcesso(e.target.value)}><option value="">—</option><option value="asfalto">Asfalto</option><option value="terra">Terra</option><option value="cascalho">Cascalho</option><option value="misto">Misto</option></select></div>
                <div><label style={LBL}>Fonte de água</label><select style={IS} value={fonteAgua} onChange={(e) => setFonteAgua(e.target.value)}><option value="">—</option><option value="rio">Rio</option><option value="poço">Poço</option><option value="nascente">Nascente</option><option value="represa">Represa</option><option value="nenhuma">Nenhuma</option></select></div>
                <div><label style={LBL}>Tipo de solo</label><input style={IS} value={tipoSolo} onChange={(e) => setTipoSolo(e.target.value)} placeholder="Terra roxa..." /></div>
              </div>
              <TogCard label="Energia elétrica" checked={possuiEnergia} onChange={setPossuiEnergia} />
              <div style={{ gridColumn: "1 / -1" }}><label style={LBL}>Benfeitorias</label><textarea rows={2} style={{ ...IS, resize: "vertical" }} value={benfeitorias} onChange={(e) => setBenfeitorias(e.target.value)} placeholder="Casa sede, curral, barracão..." /></div>
              <div style={{ gridColumn: "1 / -1" }}><label style={LBL}>Culturas/Plantações</label><textarea rows={2} style={{ ...IS, resize: "vertical" }} value={culturas} onChange={(e) => setCulturas(e.target.value)} placeholder="Eucalipto 5ha, pastagem 8ha..." /></div>
            </>}
          </div>
        </Section>
      )}

      {/* RURAL DOCS */}
      {isRural && (
        <Section title="Documentação rural">
          <div style={{ display: "grid", gridTemplateColumns: grid, gap: 12 }}>
            <div><label style={LBL}>CCIR (INCRA)</label><input style={IS} value={ccir} onChange={(e) => setCcir(e.target.value)} /></div>
            <div><label style={LBL}>CAR</label><input style={IS} value={car} onChange={(e) => setCar(e.target.value)} /></div>
            <div><label style={LBL}>NIRF</label><input style={IS} value={nirf} onChange={(e) => setNirf(e.target.value)} /></div>
          </div>
        </Section>
      )}

      {/* IPTU (non-rural) */}
      {!isRural && <Section title="Impostos"><div style={{ display: "grid", gridTemplateColumns: grid, gap: 12 }}><div><label style={LBL}>IPTU (R$/ano)</label><input style={IS} value={iptuValor ? maskCurrency(String(Math.round(currencyToNumber(iptuValor) * 100))) : ""} onChange={(e) => setIptuValor(e.target.value)} placeholder="R$ 1.200,00" /></div></div></Section>}

      {/* VALUES */}
      <Section title="Valores e condições comerciais">
        <div style={{ display: "grid", gridTemplateColumns: grid, gap: 12 }}>
          <div><label style={LBL}>Valor avaliado (R$)</label><input style={IS} value={valorAvaliado ? maskCurrency(String(Math.round(currencyToNumber(valorAvaliado) * 100))) : ""} onChange={(e) => setValorAvaliado(e.target.value)} placeholder="R$ 0,00" /></div>
          <div><label style={LBL}>Valor de venda (R$)</label><input style={IS} value={valorVenda ? maskCurrency(String(Math.round(currencyToNumber(valorVenda) * 100))) : ""} onChange={(e) => setValorVenda(e.target.value)} placeholder="R$ 0,00" /></div>
          <div><label style={LBL}>Desconto à vista (%)</label><input type="number" min={0} max={100} style={IS} value={descontoAvista} onChange={(e) => setDescontoAvista(e.target.value)} /></div>
          <div><label style={LBL}>Entrada mínima (%)</label><input type="number" min={0} max={100} style={IS} value={entradaMinima} onChange={(e) => setEntradaMinima(e.target.value)} /></div>
          <div><label style={LBL}>Parcelas máx.</label><input type="number" min={1} max={360} style={IS} value={parcelasMax} onChange={(e) => setParcelasMax(e.target.value)} /></div>
          <div style={{ display: "flex", gap: 20, alignItems: "center", gridColumn: isMobile ? "1" : "1 / -1", paddingTop: 8 }}>
            <Tog checked={aceitaFinanciamento} onChange={setAceitaFinanciamento} label="Aceita financiamento" />
            <Tog checked={aceitaPermuta} onChange={setAceitaPermuta} label="Aceita permuta" />
          </div>
          <div style={{ gridColumn: isMobile ? "1" : "1 / -1" }}><label style={LBL}>Observações comerciais</label><textarea rows={2} style={{ ...IS, resize: "vertical" }} value={obsComerciais} onChange={(e) => setObsComerciais(e.target.value)} placeholder="Visível apenas para a equipe interna" /></div>
        </div>
      </Section>

      {/* FOTOS */}
      <Section title="Fotos">
        <input ref={photoInputRef} type="file" accept="image/*" multiple hidden onChange={(e) => { handlePhotoSelect(e.target.files); e.target.value = ""; }} />
        {(() => {
          const activeExisting = existingPhotos.filter((ep) => !removedPhotoIds.includes(ep.id));
          const totalPhotos = activeExisting.length + photoFiles.length;
          return <>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10 }}>
              {/* Existing photos (from DB) */}
              {activeExisting.map((ep, i) => (
                <div key={`ex-${ep.id}`} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: `2px solid ${i === coverIndex ? "var(--interactive-primary)" : T.stone}`, aspectRatio: "4/3", background: T.ink }}>
                  <img src={ep.fileUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  {i === coverIndex && <div style={{ position: "absolute", top: 6, left: 6, fontSize: 9, fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", color: "#12110F", background: "var(--interactive-primary)", padding: "2px 6px", borderRadius: 4 }}>CAPA</div>}
                  <button type="button" onClick={() => setCoverIndex(i)} title="Definir como capa" style={{ position: "absolute", top: 6, right: 30, width: 24, height: 24, borderRadius: 6, border: "none", background: "rgba(18,17,15,0.7)", color: i === coverIndex ? "#FBBF24" : "#9C9686", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 44, minWidth: 44, padding: 0, margin: "-10px -10px 0 0" }}>★</button>
                  <button type="button" onClick={() => { setRemovedPhotoIds((prev) => [...prev, ep.id]); if (coverIndex === i) setCoverIndex(0); else if (coverIndex > i) setCoverIndex((c) => c - 1); }} title="Remover" style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: 6, border: "none", background: "rgba(248,113,113,0.8)", color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 44, minWidth: 44, padding: 0, margin: "-10px -10px 0 0" }}>✕</button>
                </div>
              ))}
              {/* New photos (local) */}
              {photoFiles.map((ph, i) => {
                const globalIdx = activeExisting.length + i;
                return (
                  <div key={`new-${i}`} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: `2px solid ${globalIdx === coverIndex ? "var(--interactive-primary)" : T.stone}`, aspectRatio: "4/3", background: T.ink }}>
                    <img src={ph.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    {globalIdx === coverIndex && <div style={{ position: "absolute", top: 6, left: 6, fontSize: 9, fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", color: "#12110F", background: "var(--interactive-primary)", padding: "2px 6px", borderRadius: 4 }}>CAPA</div>}
                    <span style={{ position: "absolute", top: 6, left: globalIdx === coverIndex ? 52 : 6, fontSize: 9, fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", color: "#60A5FA", background: "rgba(96,165,250,0.15)", padding: "2px 6px", borderRadius: 4 }}>NOVA</span>
                    <button type="button" onClick={() => setCoverIndex(globalIdx)} title="Definir como capa" style={{ position: "absolute", top: 6, right: 30, width: 24, height: 24, borderRadius: 6, border: "none", background: "rgba(18,17,15,0.7)", color: globalIdx === coverIndex ? "#FBBF24" : "#9C9686", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 44, minWidth: 44, padding: 0, margin: "-10px -10px 0 0" }}>★</button>
                    <button type="button" onClick={() => removePhoto(i)} title="Remover" style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: 6, border: "none", background: "rgba(248,113,113,0.8)", color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 44, minWidth: 44, padding: 0, margin: "-10px -10px 0 0" }}>✕</button>
                  </div>
                );
              })}
              <button type="button" onClick={() => photoInputRef.current?.click()} style={{ aspectRatio: "4/3", border: `2px dashed ${T.stone}`, borderRadius: 8, background: "transparent", color: T.fog, fontSize: 13, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 44 }}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>+</span>
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>Adicionar</span>
              </button>
            </div>
            {totalPhotos > 0 && <div style={{ fontSize: 11, color: T.slate, marginTop: 8, fontFamily: "var(--font-mono)" }}>{totalPhotos} foto{totalPhotos !== 1 ? "s" : ""}{photoFiles.length > 0 ? ` (${photoFiles.length} nova${photoFiles.length > 1 ? "s" : ""})` : ""} · Clique ★ para definir a capa</div>}
          </>;
        })()}
      </Section>

      {/* DOCUMENTOS */}
      <Section title="Documentos">
        <input ref={docInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" multiple hidden onChange={(e) => { handleDocSelect(e.target.files); e.target.value = ""; }} />
        {/* Existing docs (edit mode) */}
        {existingDocs.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {existingDocs.map((doc) => (
              <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8 }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>📄</span>
                <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", color: T.sprout, background: "rgba(74,222,128,0.08)", padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>{DOC_TYPE_LABELS[doc.tipo] || doc.tipo}</span>
                <span style={{ fontSize: 13, color: T.bone, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.nome}</span>
                <span style={{ fontSize: 10, color: T.slate, fontFamily: "var(--font-mono)" }}>salvo</span>
              </div>
            ))}
          </div>
        )}
        {/* New docs (local) */}
        {docFiles.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {docFiles.map((doc, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: T.carbon, border: `1px solid ${T.stone}`, borderRadius: 8 }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{doc.file.type === "application/pdf" ? "📄" : "🖼"}</span>
                {editingDocIdx === i ? (
                  <div style={{ flex: 1, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <select value={doc.tipo} onChange={(e) => setDocFiles((prev) => prev.map((d, j) => j === i ? { ...d, tipo: e.target.value } : d))} style={{ background: T.ink, border: `1px solid ${T.stone}`, borderRadius: 6, padding: "4px 8px", color: T.chalk, fontSize: 12, fontFamily: "var(--font-mono)" }}>
                      <option value="matricula">Matrícula</option><option value="escritura">Escritura</option><option value="iptu">IPTU</option><option value="laudo_avaliacao">Laudo de avaliação</option><option value="contrato">Contrato</option><option value="procuracao">Procuração</option><option value="certidao">Certidão</option><option value="outro">Outro</option>
                    </select>
                    <input value={doc.nome} onChange={(e) => setDocFiles((prev) => prev.map((d, j) => j === i ? { ...d, nome: e.target.value } : d))} style={{ ...IS, flex: 1, minWidth: 120, padding: "4px 8px", fontSize: 12 }} />
                    <button type="button" onClick={() => setEditingDocIdx(null)} style={{ fontSize: 11, fontWeight: 600, color: T.sprout, background: "none", border: "none", cursor: "pointer", padding: "4px 8px", minHeight: 44 }}>OK</button>
                  </div>
                ) : (
                  <>
                    <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", color: T.sprout, background: "rgba(74,222,128,0.08)", padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>{DOC_TYPE_LABELS[doc.tipo] || doc.tipo}</span>
                    <span style={{ fontSize: 13, color: T.bone, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.nome}</span>
                    <button type="button" onClick={() => setEditingDocIdx(i)} style={{ fontSize: 11, color: T.fog, background: "none", border: "none", cursor: "pointer", padding: "4px", minHeight: 44, minWidth: 44 }} title="Editar">✎</button>
                    <button type="button" onClick={() => removeDoc(i)} style={{ fontSize: 13, color: "#F87171", background: "none", border: "none", cursor: "pointer", padding: "4px", minHeight: 44, minWidth: 44 }} title="Remover">✕</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={() => docInputRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", border: `1px dashed ${T.stone}`, borderRadius: 8, background: "transparent", color: T.fog, fontSize: 13, cursor: "pointer", minHeight: 44 }}>
          <span style={{ fontSize: 16 }}>+</span> Adicionar documento
        </button>
        <div style={{ fontSize: 11, color: T.slate, marginTop: 6, fontFamily: "var(--font-mono)" }}>PDF, JPG ou PNG · Máx 10MB por arquivo</div>
      </Section>

      {error && <div style={{ fontSize: 13, color: "#F87171", marginBottom: 16 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="button" onClick={handleSave} disabled={saving || !titulo.trim()} style={{ background: saving ? "var(--surface-overlay)" : T.sprout, color: saving ? T.slate : "var(--interactive-on-primary)", border: "none", borderRadius: 8, padding: "12px 24px", fontSize: 14, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? (progress || "Salvando...") : isEditing ? "Salvar alterações" : "Salvar e continuar"}</button>
        <button type="button" onClick={() => navigate(isEditing && editId ? `/imoveis/${editId}` : "/imoveis")} disabled={saving} style={{ background: "transparent", color: T.bone, border: `1px solid ${T.stone}`, borderRadius: 8, padding: "12px 24px", fontSize: 14, cursor: saving ? "not-allowed" : "pointer" }}>Cancelar</button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 32, animation: "fadeInUp 200ms cubic-bezier(0.16,1,0.3,1) both" }}><div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: "var(--interactive-primary)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 16, paddingBottom: 8, borderBottom: "1px solid var(--border-default)" }}>{title}</div>{children}</div>;
}

function Tog({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" onClick={() => onChange(!checked)} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
    <div style={{ width: 32, height: 18, borderRadius: 9, background: checked ? "var(--interactive-primary)" : "var(--surface-overlay)", transition: "background 0.2s", position: "relative" }}><div style={{ position: "absolute", top: 2, left: checked ? 16 : 2, width: 14, height: 14, borderRadius: "50%", background: "var(--text-primary)", transition: "left 0.2s" }} /></div>
    <span style={{ fontSize: 13, color: checked ? "var(--text-secondary)" : "var(--text-muted)" }}>{label}</span>
  </button>;
}

function TogCard({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <button type="button" onClick={() => onChange(!checked)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: checked ? "rgba(74,222,128,0.04)" : "var(--surface-raised)", border: `1px solid ${checked ? "var(--interactive-primary)" : "var(--border-default)"}`, borderRadius: 8, cursor: "pointer", transition: "all 150ms", minHeight: 44 }}>
    <span style={{ fontSize: 13, color: checked ? "var(--text-secondary)" : "var(--text-muted)" }}>{label}</span>
    <div style={{ width: 32, height: 18, borderRadius: 9, background: checked ? "var(--interactive-primary)" : "var(--surface-overlay)", position: "relative", flexShrink: 0 }}><div style={{ position: "absolute", top: 2, left: checked ? 16 : 2, width: 14, height: 14, borderRadius: "50%", background: "var(--text-primary)", transition: "left 0.2s" }} /></div>
  </button>;
}
