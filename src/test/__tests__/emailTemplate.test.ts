import { describe, it, expect } from "vitest";
import { renderNexaEmail, esc, nexaSubject } from "../../../supabase/functions/_shared/emailTemplate";

describe("renderNexaEmail — esqueleto único (cânone do protótipo v2)", () => {
  const email1 = renderNexaEmail({
    badge: { label: "NOVO LEAD", color: "#4ADE80" },
    timestamp: "HOJE · 13:21",
    title: "Maria Andrade",
    meta: "Google Ads · Campanha Vivendas · Vivendas do Bosque",
    dataGrid: [
      { label: "TELEFONE", value: "(45) 99999-1234", link: "https://wa.me/5545999991234" },
      { label: "E-MAIL", value: "maria@email.com" },
      { label: "RESPONSÁVEL", value: "Gabrielly Truilho" },
    ],
    ctas: [
      { label: "Atender agora →", url: "https://app.nexacomercial.com.br/leads", primary: true },
      { label: "Chamar no WhatsApp", url: "https://wa.me/5545999991234" },
    ],
    ruler: "Lead de anúncio esfria em minutos.",
    footer: { account: "Bomm Urbanizadora", development: "Vivendas do Bosque" },
  });

  it("usa fundo claro, card branco e cores do Brand Book", () => {
    expect(email1).toContain("background-color:#F4F2EE");
    expect(email1).toContain("background-color:#FFFFFF");
    expect(email1).toContain("border:1px solid #E4E1DA");
  });
  it("badge com cor do evento e timestamp", () => {
    expect(email1).toContain("background-color:#4ADE80");
    expect(email1).toContain("NOVO LEAD");
    expect(email1).toContain("HOJE · 13:21");
  });
  it("título Georgia itálico", () => {
    expect(email1).toContain("font-family:Georgia,'Times New Roman',serif;font-style:italic");
    expect(email1).toContain("Maria Andrade");
  });
  it("CTA primário preto com texto #4ADE80 + link secundário sublinhado", () => {
    expect(email1).toContain("background-color:#12110F");
    expect(email1).toContain("color:#4ADE80;text-decoration:none\">Atender agora →");
    expect(email1).toContain("text-decoration:underline\">Chamar no WhatsApp");
  });
  it("grade de dados com telefone linkado (wa.me)", () => {
    expect(email1).toContain("https://wa.me/5545999991234");
    expect(email1).toContain("TELEFONE");
  });
  it("rodapé com conta/empreendimento + Preferências", () => {
    expect(email1).toContain("Bomm Urbanizadora · Vivendas do Bosque");
    expect(email1).toContain("Preferências de notificação");
    expect(email1).toContain("max-width:560px");
  });
  it("largura 560px, logo do Storage, links absolutos", () => {
    expect(email1).toContain("width=\"560\"");
    expect(email1).toContain("/storage/v1/object/public/logos/");
    expect(email1).toContain("https://app.nexacomercial.com.br/configuracoes");
  });
});

describe("renderNexaEmail — E-mail 3 (faixa de prazo + próximo passo)", () => {
  const email3 = renderNexaEmail({
    badge: { label: "RESERVA APROVADA", color: "#E8B45A" },
    timestamp: "HOJE · 16:40",
    title: "Quadra 4 · Lote 14",
    meta: "Vivendas do Bosque · R$ 948.750 · 420 m²",
    highlightBand: { label: "UNIDADE TRAVADA · PRAZO DA RESERVA", value: "72 horas · expira 16/07 16:40", note: "Se expirar, a unidade volta ao mercado e a fila promove." },
    dataGrid: [{ label: "CLIENTE", value: "Carla Andréia" }, { label: "CORRETORA", value: "Joelma" }],
    nextStep: "Enviar a documentação do cliente para análise (checklist: 3 de 8).",
    ctas: [{ label: "Abrir a reserva →", url: "https://app.nexacomercial.com.br/negociacoes" }],
    footer: { account: "Bomm", development: "Vivendas do Bosque" },
  });
  it("faixa âmbar com prazo + consequência", () => {
    expect(email3).toContain("background-color:#FDF6E9;border:1px solid #F0DDB4");
    expect(email3).toContain("UNIDADE TRAVADA");
    expect(email3).toContain("a fila promove");
  });
  it("próximo passo com contagem real (fornecida pelo chamador)", () => {
    expect(email3).toContain("PRÓXIMO PASSO");
    expect(email3).toContain("checklist: 3 de 8");
  });
});

describe("helpers", () => {
  it("esc previne injeção de HTML", () => {
    expect(esc("<script>x</script>")).toBe("&lt;script&gt;x&lt;/script&gt;");
  });
  it("assunto padronizado NEXA — {evento}: {contexto}", () => {
    expect(nexaSubject("Novo lead: Maria · Google Ads")).toBe("NEXA — Novo lead: Maria · Google Ads");
  });
  it("title com HTML é escapado (dado de usuário)", () => {
    const h = renderNexaEmail({ badge: { label: "X", color: "#4ADE80" }, title: "<b>hack</b>", footer: {} });
    expect(h).toContain("&lt;b&gt;hack&lt;/b&gt;");
    expect(h).not.toContain("<b>hack</b>");
  });
});
