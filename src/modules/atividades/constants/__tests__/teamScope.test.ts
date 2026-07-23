// Parte B · testes do escopo (gate por papel + default mine + dual-profile).
import { describe, it, expect } from "vitest";
import { canManageScope, resolveScopeMode, isCommercialInternalRole } from "../teamScope";

describe("canManageScope — só owner/director/manager alternam escopo", () => {
  it("libera owner/director/manager", () => {
    for (const r of ["owner", "director", "manager"]) expect(canManageScope(r)).toBe(true);
  });
  it("bloqueia consultora, corretor, administrativo, concierge, null", () => {
    for (const r of ["commercial_consultant", "broker", "administrative", "concierge", null, undefined, ""]) {
      expect(canManageScope(r)).toBe(false);
    }
  });
});

describe("resolveScopeMode — default 'mine' para TODOS; só gestão vê 'team'", () => {
  it("não-gestor é SEMPRE 'mine', mesmo pedindo 'team'", () => {
    expect(resolveScopeMode("commercial_consultant", "team")).toBe("mine");
    expect(resolveScopeMode("broker", "team")).toBe("mine");
    expect(resolveScopeMode("commercial_consultant", "mine")).toBe("mine");
  });
  it("gestão respeita o toggle (mine↔team)", () => {
    expect(resolveScopeMode("manager", "mine")).toBe("mine"); // abre no pessoal (honesto)
    expect(resolveScopeMode("manager", "team")).toBe("team");
    expect(resolveScopeMode("owner", "team")).toBe("team");
    expect(resolveScopeMode("director", "team")).toBe("team");
  });
  it("owner/director também alternam (o bug do isManager=manager-only está corrigido)", () => {
    expect(resolveScopeMode("owner", "mine")).toBe("mine");
    expect(resolveScopeMode("director", "team")).toBe("team");
  });
});

describe("dual-profile do Rubiam — o escopo segue o PERFIL ATIVO", () => {
  it("como owner: vê o toggle e pode 'team'; como broker: preso em 'mine'", () => {
    // mesmo usuário, papel do perfil ativo decide
    expect(canManageScope("owner")).toBe(true);
    expect(resolveScopeMode("owner", "team")).toBe("team");
    expect(canManageScope("broker")).toBe(false);
    expect(resolveScopeMode("broker", "team")).toBe("mine");
  });
});

describe("isCommercialInternalRole — ranking interno (inalterado)", () => {
  it("consultora é interna; corretor não", () => {
    expect(isCommercialInternalRole("commercial_consultant")).toBe(true);
    expect(isCommercialInternalRole("broker")).toBe(false);
  });
});
