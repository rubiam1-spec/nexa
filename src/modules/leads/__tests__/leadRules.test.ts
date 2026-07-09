import { describe, it, expect } from "vitest";
import { canAssignLeads, canViewAllLeads, canWorkLead, resolveConvertOwner } from "../leadRules";

describe("leadRules — permissões (Leads L1)", () => {
  it("atribuir: concierge/manager/director/owner sim; consultant/broker/administrative não", () => {
    for (const r of ["owner", "director", "manager", "concierge"]) expect(canAssignLeads(r)).toBe(true);
    for (const r of ["commercial_consultant", "broker", "administrative", null]) expect(canAssignLeads(r)).toBe(false);
  });

  it("broker só vê os próprios; demais veem todos", () => {
    expect(canViewAllLeads("broker")).toBe(false);
    for (const r of ["owner", "director", "manager", "concierge", "commercial_consultant", "administrative"]) {
      expect(canViewAllLeads(r)).toBe(true);
    }
  });

  it("trabalhar o lead: o atribuído OU papel que pode atribuir", () => {
    // consultant atribuído pode trabalhar; consultant não-atribuído não
    expect(canWorkLead("commercial_consultant", true)).toBe(true);
    expect(canWorkLead("commercial_consultant", false)).toBe(false);
    // broker atribuído pode; broker não-atribuído não
    expect(canWorkLead("broker", true)).toBe(true);
    expect(canWorkLead("broker", false)).toBe(false);
    // manager pode mesmo sem ser o atribuído
    expect(canWorkLead("manager", false)).toBe(true);
  });

  it("dono na conversão: atribuído; fallback = quem converte", () => {
    expect(resolveConvertOwner({ assignedTo: "prof-A" }, "prof-B")).toBe("prof-A");
    expect(resolveConvertOwner({ assignedTo: null }, "prof-B")).toBe("prof-B");
    expect(resolveConvertOwner({ assignedTo: null }, null)).toBeNull();
  });
});
