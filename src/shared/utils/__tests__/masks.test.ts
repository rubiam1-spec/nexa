import { describe, it, expect } from "vitest";
import {
  maskCPF, maskCNPJ, maskPhone, maskCEP, maskRG, maskCurrency, maskCRECI, maskNumero,
  filterName, filterNumbers,
  validateEmail, validateCPF, validateCNPJ,
  formatCPF, formatCNPJ, formatPhone, formatCEP, formatCurrency,
  currencyToNumber,
  UF_OPTIONS,
} from "../masks";

describe("Máscaras (formatação em tempo real)", () => {
  describe("maskCPF", () => {
    it("formata CPF completo: 12345678909 → 123.456.789-09", () => {
      expect(maskCPF("12345678909")).toBe("123.456.789-09");
    });
    it("formata CPF parcial: 123456 → 123.456", () => {
      expect(maskCPF("123456")).toBe("123.456");
    });
    it("retorna vazio para vazio", () => {
      expect(maskCPF("")).toBe("");
    });
    it("remove caracteres não numéricos", () => {
      expect(maskCPF("123.456.789-09")).toBe("123.456.789-09");
    });
    it("trunca em 11 dígitos", () => {
      expect(maskCPF("123456789091234")).toBe("123.456.789-09");
    });
  });

  describe("maskCNPJ", () => {
    it("formata CNPJ completo: 12345678000190 → 12.345.678/0001-90", () => {
      expect(maskCNPJ("12345678000190")).toBe("12.345.678/0001-90");
    });
    it("trunca em 14 dígitos", () => {
      expect(maskCNPJ("1234567800019099")).toBe("12.345.678/0001-90");
    });
  });

  describe("maskPhone", () => {
    it("formata celular 11 dígitos: 45999012364 → (45) 99901-2364", () => {
      expect(maskPhone("45999012364")).toBe("(45) 99901-2364");
    });
    it("formata fixo 10 dígitos: 4532221234 → (45) 3222-1234", () => {
      expect(maskPhone("4532221234")).toBe("(45) 3222-1234");
    });
    it("parcial 6 dígitos: 459990 → (45) 9990", () => {
      expect(maskPhone("459990")).toBe("(45) 9990");
    });
    it("trunca em 11 dígitos", () => {
      expect(maskPhone("459990123641234")).toBe("(45) 99901-2364");
    });
  });

  describe("maskCEP", () => {
    it("formata CEP completo: 85801000 → 85801-000", () => {
      expect(maskCEP("85801000")).toBe("85801-000");
    });
    it("parcial: 85801 → 85801", () => {
      expect(maskCEP("85801")).toBe("85801");
    });
  });

  describe("maskRG", () => {
    it("permite números, pontos e hífens", () => {
      expect(maskRG("12.345-6")).toBe("12.345-6");
    });
    it("remove letras", () => {
      expect(maskRG("12abc34")).toBe("1234");
    });
    it("trunca em 15 caracteres", () => {
      expect(maskRG("1234567890123456")).toHaveLength(15);
    });
  });

  describe("maskCurrency", () => {
    it("formata centavos em reais: '100000' → R$ 1.000,00", () => {
      expect(maskCurrency("100000")).toBe("R$\u00a01.000,00");
    });
    it("retorna vazio para zero", () => {
      expect(maskCurrency("0")).toBe("");
    });
    it("retorna vazio para vazio", () => {
      expect(maskCurrency("")).toBe("");
    });
  });

  describe("maskCRECI", () => {
    it("permite alfanumérico, barra e hífen", () => {
      expect(maskCRECI("F-12345/PR")).toBe("F-12345/PR");
    });
    it("trunca em 12 caracteres", () => {
      expect(maskCRECI("1234567890123")).toHaveLength(12);
    });
  });

  describe("maskNumero", () => {
    it("permite alfanumérico, barra e espaço", () => {
      expect(maskNumero("Lote 4/A")).toBe("Lote 4/A");
    });
    it("trunca em 10 caracteres", () => {
      expect(maskNumero("12345678901")).toHaveLength(10);
    });
  });

  describe("currencyToNumber", () => {
    it("converte 'R$ 1.000,00' → 1000", () => {
      expect(currencyToNumber("R$ 1.000,00")).toBe(100000 / 100);
    });
    it("converte '0' → 0", () => {
      expect(currencyToNumber("0")).toBe(0);
    });
  });
});

describe("Filtros", () => {
  describe("filterName", () => {
    it("mantém letras, acentos, espaços, apóstrofo, ponto, hífen", () => {
      expect(filterName("José D'Arc Jr.")).toBe("José D'Arc Jr.");
    });
    it("remove números e caracteres especiais", () => {
      expect(filterName("Test@123")).toBe("Test");
    });
  });

  describe("filterNumbers", () => {
    it("mantém apenas dígitos", () => {
      expect(filterNumbers("(45) 99901-2364")).toBe("45999012364");
    });
  });
});

describe("Validadores", () => {
  describe("validateEmail", () => {
    it("aceita email válido", () => {
      expect(validateEmail("rubiam@nexa.com")).toBe(true);
    });
    it("rejeita sem @", () => {
      expect(validateEmail("rubiamnexa.com")).toBe(false);
    });
    it("rejeita sem domínio", () => {
      expect(validateEmail("rubiam@")).toBe(false);
    });
    it("rejeita vazio", () => {
      expect(validateEmail("")).toBe(false);
    });
  });

  describe("validateCPF", () => {
    it("aceita CPF válido (dígitos verificadores corretos)", () => {
      expect(validateCPF("52998224725")).toBe(true);
    });
    it("rejeita CPF com dígitos repetidos", () => {
      expect(validateCPF("11111111111")).toBe(false);
    });
    it("rejeita CPF com verificador errado", () => {
      expect(validateCPF("12345678901")).toBe(false);
    });
    it("rejeita CPF curto", () => {
      expect(validateCPF("1234567")).toBe(false);
    });
    it("aceita CPF formatado", () => {
      expect(validateCPF("529.982.247-25")).toBe(true);
    });
  });

  describe("validateCNPJ", () => {
    it("aceita CNPJ válido", () => {
      expect(validateCNPJ("11222333000181")).toBe(true);
    });
    it("rejeita CNPJ com dígitos repetidos", () => {
      expect(validateCNPJ("11111111111111")).toBe(false);
    });
    it("rejeita CNPJ com verificador errado", () => {
      expect(validateCNPJ("12345678000190")).toBe(false);
    });
    it("rejeita CNPJ curto", () => {
      expect(validateCNPJ("1234567800")).toBe(false);
    });
  });
});

describe("Formatadores de display", () => {
  describe("formatCPF", () => {
    it("formata CPF válido", () => {
      expect(formatCPF("12345678909")).toBe("123.456.789-09");
    });
    it("retorna — para null", () => {
      expect(formatCPF(null)).toBe("—");
    });
  });

  describe("formatCNPJ", () => {
    it("formata CNPJ válido", () => {
      expect(formatCNPJ("12345678000190")).toBe("12.345.678/0001-90");
    });
    it("retorna — para null", () => {
      expect(formatCNPJ(null)).toBe("—");
    });
  });

  describe("formatPhone", () => {
    it("formata celular", () => {
      expect(formatPhone("45999012364")).toBe("(45) 99901-2364");
    });
    it("retorna — para null", () => {
      expect(formatPhone(null)).toBe("—");
    });
  });

  describe("formatCEP", () => {
    it("formata CEP", () => {
      expect(formatCEP("85801000")).toBe("85801-000");
    });
    it("retorna — para null", () => {
      expect(formatCEP(null)).toBe("—");
    });
  });

  describe("formatCurrency", () => {
    it("formata valor inteiro", () => {
      expect(formatCurrency(1035000)).toContain("1.035.000");
    });
    it("formata zero", () => {
      expect(formatCurrency(0)).toContain("0,00");
    });
    it("retorna — para null", () => {
      expect(formatCurrency(null)).toBe("—");
    });
    it("aceita Number() de string Supabase", () => {
      expect(formatCurrency(Number("948.75"))).toContain("948,75");
    });
  });
});

describe("Constantes", () => {
  it("UF_OPTIONS tem 27 estados", () => {
    expect(UF_OPTIONS).toHaveLength(27);
  });
  it("inclui SP e PR", () => {
    expect(UF_OPTIONS).toContain("SP");
    expect(UF_OPTIONS).toContain("PR");
  });
});
