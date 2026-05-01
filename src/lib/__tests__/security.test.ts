import { describe, it, expect } from "vitest";
import {
  secureMaskCPF,
  secureMaskRG,
  secureMaskRenda,
  secureMaskEmail,
  secureMaskPhone,
} from "../security";

describe("secureMaskCPF", () => {
  it("mascara CPF mostrando últimos 2: 52998224725 → ***.***.***-25", () => {
    expect(secureMaskCPF("52998224725")).toBe("***.***.***-25");
  });
  it("aceita CPF formatado", () => {
    expect(secureMaskCPF("529.982.247-25")).toBe("***.***.***-25");
  });
  it("retorna vazio para null", () => {
    expect(secureMaskCPF(null)).toBe("");
  });
  it("retorna vazio para undefined", () => {
    expect(secureMaskCPF(undefined)).toBe("");
  });
  it("CPF curto retorna ***", () => {
    expect(secureMaskCPF("1")).toBe("***");
  });
});

describe("secureMaskRG", () => {
  it("mascara RG mostrando últimos 4: 1234567890 → ******7890", () => {
    expect(secureMaskRG("1234567890")).toBe("******7890");
  });
  it("RG com 4 ou menos caracteres retorna como está", () => {
    expect(secureMaskRG("1234")).toBe("1234");
  });
  it("retorna vazio para null", () => {
    expect(secureMaskRG(null)).toBe("");
  });
});

describe("secureMaskRenda", () => {
  it("até 3000", () => expect(secureMaskRenda(2500)).toBe("Até R$ 3.000"));
  it("faixa 3-5k", () => expect(secureMaskRenda(4000)).toBe("R$ 3.000 — R$ 5.000"));
  it("faixa 5-10k", () => expect(secureMaskRenda(7000)).toBe("R$ 5.000 — R$ 10.000"));
  it("faixa 10-20k", () => expect(secureMaskRenda(15000)).toBe("R$ 10.000 — R$ 20.000"));
  it("faixa 20-50k", () => expect(secureMaskRenda(30000)).toBe("R$ 20.000 — R$ 50.000"));
  it("acima 50k", () => expect(secureMaskRenda(80000)).toBe("Acima de R$ 50.000"));
  it("retorna vazio para null", () => expect(secureMaskRenda(null)).toBe(""));
  it("retorna vazio para 0", () => expect(secureMaskRenda(0)).toBe(""));
});

describe("secureMaskEmail", () => {
  it("mascara email: rubiam@gmail.com → r***@gmail.com", () => {
    expect(secureMaskEmail("rubiam@gmail.com")).toBe("r***@gmail.com");
  });
  it("email curto: a@b.com → a***@b.com", () => {
    expect(secureMaskEmail("a@b.com")).toBe("a***@b.com");
  });
  it("retorna vazio para null", () => {
    expect(secureMaskEmail(null)).toBe("");
  });
  it("retorna string sem @ como está", () => {
    expect(secureMaskEmail("no-at-sign")).toBe("no-at-sign");
  });
});

describe("secureMaskPhone", () => {
  it("mascara telefone mostrando últimos 4: (45) 99999-1234 → ••••••-1234", () => {
    expect(secureMaskPhone("(45) 99999-1234")).toBe("••••••-1234");
  });
  it("número curto retorna como está", () => {
    expect(secureMaskPhone("123")).toBe("123");
  });
  it("retorna vazio para null", () => {
    expect(secureMaskPhone(null)).toBe("");
  });
});
