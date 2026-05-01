import { describe, it, expect } from "vitest";
import { LEADERSHIP_ROLES } from "../useCentral";

describe("LEADERSHIP_ROLES — branch isManager na useCentral", () => {
  it("inclui administrative (fix do bug: admin caia em !isManager e via Minhas=0)", () => {
    expect(LEADERSHIP_ROLES).toContain("administrative");
  });

  it("contém os 4 roles de visão plena da conta e nada além", () => {
    expect([...LEADERSHIP_ROLES].sort()).toEqual(
      ["administrative", "director", "manager", "owner"],
    );
  });

  it("broker, commercial_consultant e concierge continuam fora (filtro por ownership)", () => {
    expect(LEADERSHIP_ROLES).not.toContain("broker");
    expect(LEADERSHIP_ROLES).not.toContain("commercial_consultant");
    expect(LEADERSHIP_ROLES).not.toContain("concierge");
  });
});
