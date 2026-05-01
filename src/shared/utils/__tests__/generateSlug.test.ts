import { describe, it, expect } from "vitest";
import { generateSlug } from "../generateSlug";

describe("generateSlug", () => {
  it("converte para minúsculas e substitui espaços por hífens", () => {
    expect(generateSlug("Vivendas do Lago")).toBe("vivendas-do-lago");
  });
  it("remove acentos", () => {
    expect(generateSlug("Imóvel Único Edição")).toBe("imovel-unico-edicao");
  });
  it("remove caracteres especiais", () => {
    expect(generateSlug("Casa & Cia!")).toBe("casa-cia");
  });
  it("colapsa hífens múltiplos", () => {
    expect(generateSlug("Lote  --  Especial")).toBe("lote-especial");
  });
  it("trunca em 60 caracteres", () => {
    const long = "A".repeat(100);
    expect(generateSlug(long).length).toBeLessThanOrEqual(60);
  });
  it("trim whitespace", () => {
    expect(generateSlug("  Teste  ")).toBe("teste");
  });
  it("string vazia → vazia", () => {
    expect(generateSlug("")).toBe("");
  });
});
