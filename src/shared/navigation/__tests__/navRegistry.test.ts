import { describe, it, expect } from "vitest";
import {
  NAV_REGISTRY,
  visibleModules,
  visibleModulesBySection,
  mobilePrimaryModules,
  desktopVisibleIds,
  mobileReachableIds,
} from "../navRegistry";
import { PERMISSION_PRESETS } from "../../constants/permissionPresets";
import type { PermissionFlag } from "../../constants/permissionPresets";

const ROLES = Object.keys(PERMISSION_PRESETS);
const canFor = (role: string) => (flag: PermissionFlag) => PERMISSION_PRESETS[role][flag] === true;

describe("navRegistry — paridade desktop × mobile", () => {
  it("há papéis para testar", () => {
    expect(ROLES.length).toBeGreaterThan(0);
  });

  it.each(ROLES)("%s: todo módulo visível no desktop é alcançável no mobile", (role) => {
    const can = canFor(role);
    const desktop = [...desktopVisibleIds(can)].sort();
    const mobile = [...mobileReachableIds(can)].sort();
    // Nenhum módulo permitido ao role pode sumir no mobile.
    expect(mobile).toEqual(desktop);
    for (const id of desktop) expect(mobile).toContain(id);
  });

  it.each(ROLES)("%s: a tab bar (mobilePrimary) é subconjunto do alcançável no mobile", (role) => {
    const can = canFor(role);
    const primary = mobilePrimaryModules(can).map((m) => m.id);
    const reachable = mobileReachableIds(can);
    for (const id of primary) expect(reachable).toContain(id);
  });

  it("a tab bar respeita a ordem de mobilePrimary (Central, Negociações, Leads)", () => {
    const canAll = () => true; // role hipotético com tudo liberado
    const ids = mobilePrimaryModules(canAll).map((m) => m.id);
    expect(ids).toEqual(["central", "negociacoes", "leads"]);
  });

  it("Central é sempre visível (sem flags)", () => {
    const canNone = () => false;
    expect(visibleModules(canNone).map((m) => m.id)).toContain("central");
  });

  it("nenhum módulo usa o termo de UI 'Pipeline' nem rótulo abreviado", () => {
    for (const m of NAV_REGISTRY) {
      expect(m.label.toLowerCase()).not.toContain("pipeline");
      expect(m.label.endsWith(".")).toBe(false); // sem abreviação com ponto
    }
  });

  it("todo módulo tem id único e seção conhecida", () => {
    const ids = NAV_REGISTRY.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    const secoes = new Set(NAV_REGISTRY.map((m) => m.secao));
    for (const s of secoes) expect(["operacao", "comercial", "gestao", "sistema"]).toContain(s);
  });

  it("visibleModulesBySection omite seções vazias e preserva a ordem", () => {
    const can = () => true;
    const groups = visibleModulesBySection(can);
    expect(groups.map((g) => g.secao)).toEqual(["operacao", "comercial", "gestao", "sistema"]);
    for (const g of groups) expect(g.modules.length).toBeGreaterThan(0);
  });
});
