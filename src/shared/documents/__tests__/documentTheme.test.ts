// v3 · testes do documentTheme (merge parcial, neutro-sem-linha, protocolo, hex).
import { describe, it, expect } from "vitest";
import { resolveDocumentTheme, DEFAULT_NEXA_THEME, hexToRgb, buildProtocolo } from "../documentTheme";

describe("resolveDocumentTheme — merge parcial sobre o neutro NEXA", () => {
  it("sem linha → neutro PURO (default NEXA)", () => {
    expect(resolveDocumentTheme(null)).toEqual(DEFAULT_NEXA_THEME);
    expect(resolveDocumentTheme(undefined)).toEqual(DEFAULT_NEXA_THEME);
  });

  it("conta define só accent → resto permanece neutro", () => {
    const t = resolveDocumentTheme({ palette: { accent: "#C8102E" } });
    expect(t.accent).toBe("#C8102E");
    expect(t.pageBg).toBe(DEFAULT_NEXA_THEME.pageBg);
    expect(t.cardBg).toBe(DEFAULT_NEXA_THEME.cardBg);
    expect(t.fontPair).toBe("nexa");
    expect(t.slogan).toBeNull();
    expect(t.disclaimer).toBe(DEFAULT_NEXA_THEME.disclaimer);
  });

  it("mescla logos, slogan/accent, disclaimer e font_pair", () => {
    const t = resolveDocumentTheme({
      logo_primary_url: "logos/acc/primary.png",
      logo_product_url: "logos/acc/product.png",
      palette: { pageBg: "#0B0B0B", textPrimary: "#FFFFFF" },
      slogan: "O bairro planejado que valoriza",
      slogan_accent_word: "valoriza",
      disclaimer: "Documento sem valor contratual.",
      font_pair: "bomm_editorial",
    });
    expect(t.logoPrimary).toBe("logos/acc/primary.png");
    expect(t.logoProduct).toBe("logos/acc/product.png");
    expect(t.pageBg).toBe("#0B0B0B");
    expect(t.textPrimary).toBe("#FFFFFF");
    expect(t.slogan).toBe("O bairro planejado que valoriza");
    expect(t.sloganAccentWord).toBe("valoriza");
    expect(t.disclaimer).toBe("Documento sem valor contratual.");
    expect(t.fontPair).toBe("bomm_editorial");
  });

  it("valores vazios/inválidos não sobrescrevem o neutro", () => {
    const t = resolveDocumentTheme({ palette: { accent: "  " }, slogan: "", disclaimer: "   ", font_pair: "xpto" });
    expect(t.accent).toBe(DEFAULT_NEXA_THEME.accent);
    expect(t.slogan).toBeNull();
    expect(t.disclaimer).toBe(DEFAULT_NEXA_THEME.disclaimer);
    expect(t.fontPair).toBe("nexa"); // font_pair desconhecido → nexa
  });
});

describe("hexToRgb", () => {
  it("#RRGGBB e #RGB", () => {
    expect(hexToRgb("#C8102E")).toEqual([200, 16, 46]);
    expect(hexToRgb("#000000")).toEqual([0, 0, 0]);
    expect(hexToRgb("#FFF")).toEqual([255, 255, 255]);
    expect(hexToRgb("#0B0B0B")).toEqual([11, 11, 11]);
  });
  it("lixo → preto (nunca quebra)", () => {
    expect(hexToRgb("nope")).toEqual([0, 0, 0]);
    expect(hexToRgb("")).toEqual([0, 0, 0]);
  });
});

describe("buildProtocolo — CP-AAAAMMDD-LxxQxx", () => {
  it("formata data + lote/quadra com 2 dígitos", () => {
    expect(buildProtocolo("2026-07-30T12:00:00Z", "5", "12")).toBe("CP-20260730-L05Q12");
    expect(buildProtocolo("2026-01-03T00:00:00Z", 7, 3)).toBe("CP-20260103-L07Q03");
  });
  it("sem lote/quadra → L00Q00", () => {
    expect(buildProtocolo("2026-07-30T12:00:00Z", null, null)).toBe("CP-20260730-L00Q00");
    expect(buildProtocolo("2026-07-30T12:00:00Z", "", undefined)).toBe("CP-20260730-L00Q00");
  });
  it("data inválida não quebra", () => {
    expect(buildProtocolo("lixo", "1", "1")).toMatch(/^CP-\d{8}-L01Q01$/);
  });
});
