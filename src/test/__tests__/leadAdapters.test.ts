import { describe, it, expect } from "vitest";
import { normalizeLead, cleanPhone, isHoneypot } from "../../../supabase/functions/receive-lead/leadAdapters";

describe("normalizeLead — google_lead_form (payload oficial)", () => {
  const google = {
    lead_id: "AB-42",
    api_version: "1.0",
    form_id: 123,
    campaign_id: 456,
    google_key: "channel-key-xyz",
    is_test: false,
    user_column_data: [
      { column_name: "Full Name", column_id: "FULL_NAME", string_value: "Maria Vitória" },
      { column_name: "User Phone", column_id: "PHONE_NUMBER", string_value: "+55 (45) 99999-0001" },
      { column_name: "User Email", column_id: "EMAIL", string_value: "maria@ex.com" },
    ],
    utm_campaign: "Vivendas-Set",
  };

  it("mapeia user_column_data, lead_id, google_key e limpa o telefone", () => {
    const n = normalizeLead("google_lead_form", google, {});
    expect(n.name).toBe("Maria Vitória");
    expect(n.phone).toBe("5545999990001");
    expect(n.email).toBe("maria@ex.com");
    expect(n.leadId).toBe("AB-42");
    expect(n.googleKey).toBe("channel-key-xyz");
    expect(n.isTest).toBe(false);
    expect(n.utm.campaign).toBe("Vivendas-Set");
  });

  it("is_test=true é sinalizado (não cria client)", () => {
    expect(normalizeLead("google_lead_form", { ...google, is_test: true }, {}).isTest).toBe(true);
    expect(normalizeLead("google_lead_form", { ...google, is_test: "true" }, {}).isTest).toBe(true);
  });
});

describe("normalizeLead — generic/landing_page (contrato v7)", () => {
  it("extrai nome/telefone/email de chaves comuns + utm", () => {
    const n = normalizeLead("landing_page", { nome: "João", telefone: "45 98888-1122", email: "j@ex.com", utm_campaign: "Camp1" }, {});
    expect(n.name).toBe("João");
    expect(n.phone).toBe("45988881122");
    expect(n.email).toBe("j@ex.com");
    expect(n.utm.campaign).toBe("Camp1");
    expect(n.leadId).toBeNull();
    expect(n.isTest).toBe(false);
  });

  it("field_mapping do canal renomeia chaves externas", () => {
    const n = normalizeLead("meta_bridge", { Nome_Completo: "Ana", Fone: "45 97777", Mail: "a@ex.com" }, { Nome_Completo: "name", Fone: "phone", Mail: "email" });
    expect(n.name).toBe("Ana");
    expect(n.phone).toBe("4597777");
    expect(n.email).toBe("a@ex.com");
  });

  it("Facebook Lead Ads inline preservado", () => {
    const fb = { entry: [{ changes: [{ value: { field_data: [
      { name: "full_name", values: ["Fulano FB"] },
      { name: "phone_number", values: ["45 96666-0000"] },
    ] } }] }] };
    const n = normalizeLead("generic", fb, {});
    expect(n.name).toBe("Fulano FB");
    expect(n.phone).toBe("45966660000");
  });
});

describe("helpers", () => {
  it("cleanPhone remove tudo que não é dígito", () => {
    expect(cleanPhone("+55 (45) 9.9999-0001")).toBe("5545999990001");
  });
  it("isHoneypot detecta campos-isca", () => {
    expect(isHoneypot({ website: "http://bot" })).toBe(true);
    expect(isHoneypot({ name: "ok" })).toBe(false);
  });
});
