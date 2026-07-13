// Adaptadores de ingestão de leads — normalização PURA (sem Deno/Supabase),
// para ser testável em vitest E reutilizável na Edge receive-lead (L2.2).
// Contrato interno único; 'generic'/'landing_page' preservam o comportamento v7.

export type NormalizedLead = {
  name: string;
  phone: string;
  email: string;
  message: string;
  utm: { source: string | null; medium: string | null; campaign: string | null; content: string | null; term: string | null };
  /** id do lead no provedor (Google lead_id) — para dedupe idempotente. */
  leadId: string | null;
  /** payload de teste (botão "enviar teste" do Google) — não cria client. */
  isTest: boolean;
  /** chave enviada no corpo pelo Google (google_key) — validar contra a api_key do canal. */
  googleKey: string | null;
};

// deno-lint-ignore no-explicit-any
type Body = Record<string, any>;

export function cleanPhone(p: string): string {
  return (p ?? "").replace(/\D/g, "");
}

/** Honeypot anti-bot: campos-isca preenchidos = bot. */
export function isHoneypot(body: Body): boolean {
  const h = body?.website || body?.Website || body?.url || body?.honeypot || "";
  return typeof h === "string" && h.trim().length > 0;
}

// Google Lead Form: column_id oficiais → campo interno.
const GOOGLE_COLUMN_MAP: Record<string, "name" | "phone" | "email"> = {
  FULL_NAME: "name", NAME: "name", FIRST_NAME: "name", FIRST_AND_LAST_NAME: "name",
  PHONE_NUMBER: "phone", PHONE: "phone",
  EMAIL: "email", USER_EMAIL: "email", WORK_EMAIL: "email",
};

function extractUtm(body: Body) {
  return {
    source: (body?.utm_source ?? null) as string | null,
    medium: (body?.utm_medium ?? null) as string | null,
    campaign: (body?.utm_campaign ?? body?.campaign ?? body?.campanha ?? null) as string | null,
    content: (body?.utm_content ?? null) as string | null,
    term: (body?.utm_term ?? null) as string | null,
  };
}

function applyFieldMapping(body: Body, fieldMapping: Record<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [ext, nexa] of Object.entries(fieldMapping ?? {})) {
    if (body?.[ext] !== undefined) mapped[nexa] = String(body[ext]);
  }
  return mapped;
}

function normalizeGoogle(body: Body, mapped: Record<string, string>): NormalizedLead {
  const cols = Array.isArray(body?.user_column_data) ? body.user_column_data : [];
  const pick = (want: "name" | "phone" | "email"): string => {
    for (const c of cols) {
      const key = String(c?.column_id ?? c?.column_name ?? "").toUpperCase().replace(/\s+/g, "_");
      if (GOOGLE_COLUMN_MAP[key] === want) return String(c?.string_value ?? c?.value ?? "").trim();
    }
    return "";
  };
  return {
    name: (mapped.name || pick("name") || "").slice(0, 200),
    phone: cleanPhone(mapped.phone || pick("phone")),
    email: (mapped.email || pick("email") || "").slice(0, 200),
    message: mapped.message || "",
    utm: extractUtm(body),
    leadId: body?.lead_id != null ? String(body.lead_id) : null,
    isTest: body?.is_test === true || body?.is_test === "true",
    googleKey: body?.google_key != null ? String(body.google_key) : null,
  };
}

function normalizeGeneric(body: Body, mapped: Record<string, string>): NormalizedLead {
  let name = mapped.name || body?.name || body?.nome || body?.full_name || "";
  let email = mapped.email || body?.email || "";
  let phone = mapped.phone || body?.phone || body?.telefone || body?.whatsapp || body?.phone_number || "";
  // Facebook Lead Ads inline (preservado do v7).
  if (body?.entry && body.entry[0]?.changes) {
    const fields = body.entry[0].changes[0]?.value?.field_data || [];
    const getField = (names: string[]) => {
      for (const n of names) {
        const f = fields.find((fd: { name: string; values: string[] }) => fd.name === n);
        if (f?.values?.[0]) return f.values[0];
      }
      return "";
    };
    name = name || getField(["full_name", "nome", "name"]);
    email = email || getField(["email"]);
    phone = phone || getField(["phone_number", "telefone", "whatsapp"]);
  }
  return {
    name: String(name).slice(0, 200),
    phone: cleanPhone(phone),
    email: String(email).slice(0, 200),
    message: mapped.message || body?.message || body?.observations || body?.notes || body?.observacoes || "",
    utm: extractUtm(body),
    leadId: body?.lead_id != null ? String(body.lead_id) : null,
    isTest: false,
    googleKey: null,
  };
}

/**
 * Normaliza o payload conforme o provider_adapter do canal.
 * 'google_lead_form' → user_column_data[]. Demais (generic/landing_page/pontes)
 * → contrato v7 + field_mapping do canal.
 */
export function normalizeLead(providerAdapter: string, body: Body, fieldMapping: Record<string, string> = {}): NormalizedLead {
  const mapped = applyFieldMapping(body, fieldMapping);
  if (providerAdapter === "google_lead_form") return normalizeGoogle(body, mapped);
  return normalizeGeneric(body, mapped);
}

/** Detalhe da origem (para origin_detail) a partir do payload/utm. */
export function sourceDetailOf(body: Body, mapped: Record<string, string> = {}): string {
  return mapped.source_detail || body?.source_detail || body?.campaign || body?.campanha || body?.form || "";
}
