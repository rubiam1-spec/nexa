import { describe, it, expect } from "vitest";
import {
  PERMISSION_META,
  PERMISSION_PRESETS,
  resolvePermission,
  resolveAllPermissions,
  diffFromPreset,
} from "../permissionPresets";

describe("PERMISSION_META", () => {
  it("contém as 33 flags canônicas (30 anteriores + 3 sociais: create_social_post, moderate_social, interact_social)", () => {
    expect(PERMISSION_META).toHaveLength(33);
  });

  it("can_manage_brokers e can_manage_brokerages estão na categoria action", () => {
    const brokers = PERMISSION_META.find((m) => m.flag === "can_manage_brokers");
    const brokerages = PERMISSION_META.find((m) => m.flag === "can_manage_brokerages");
    expect(brokers?.category).toBe("action");
    expect(brokerages?.category).toBe("action");
  });

  it("can_view_own_negotiations está na categoria vision", () => {
    const m = PERMISSION_META.find((x) => x.flag === "can_view_own_negotiations");
    expect(m).toBeDefined();
    expect(m?.category).toBe("vision");
  });
});

describe("PERMISSION_PRESETS — can_view_own_negotiations", () => {
  it("owner/director/manager têm true", () => {
    expect(PERMISSION_PRESETS.owner.can_view_own_negotiations).toBe(true);
    expect(PERMISSION_PRESETS.director.can_view_own_negotiations).toBe(true);
    expect(PERMISSION_PRESETS.manager.can_view_own_negotiations).toBe(true);
  });

  it("commercial_consultant tem true (vê próprias negociações)", () => {
    expect(PERMISSION_PRESETS.commercial_consultant.can_view_own_negotiations).toBe(true);
  });

  it("broker tem true (vê próprias negociações mesmo com can_view_all=false)", () => {
    expect(PERMISSION_PRESETS.broker.can_view_own_negotiations).toBe(true);
    expect(PERMISSION_PRESETS.broker.can_view_all_negotiations).toBe(false);
  });

  it("administrative tem false (já vê tudo via can_view_all_negotiations)", () => {
    expect(PERMISSION_PRESETS.administrative.can_view_own_negotiations).toBe(false);
    expect(PERMISSION_PRESETS.administrative.can_view_all_negotiations).toBe(true);
  });

  it("concierge tem ambas false (não é perfil comercial)", () => {
    expect(PERMISSION_PRESETS.concierge.can_view_own_negotiations).toBe(false);
    expect(PERMISSION_PRESETS.concierge.can_view_all_negotiations).toBe(false);
  });
});

describe("Gate do sidebar — OR entre can_view_all_negotiations e can_view_own_negotiations", () => {
  const sidebarFlags = ["can_view_all_negotiations", "can_view_own_negotiations"] as const;

  function sidebarVisible(role: keyof typeof PERMISSION_PRESETS): boolean {
    return sidebarFlags.some((f) => PERMISSION_PRESETS[role][f]);
  }

  it.each([
    ["owner", true],
    ["director", true],
    ["manager", true],
    ["commercial_consultant", true],
    ["broker", true],
    ["administrative", true],
    ["concierge", false],
  ] as const)("%s → sidebar pipeline/negociações visivel = %s", (role, expected) => {
    expect(sidebarVisible(role)).toBe(expected);
  });
});

describe("PERMISSION_PRESETS — can_manage_brokers / can_manage_brokerages", () => {
  it("owner tem ambas true", () => {
    expect(PERMISSION_PRESETS.owner.can_manage_brokers).toBe(true);
    expect(PERMISSION_PRESETS.owner.can_manage_brokerages).toBe(true);
  });

  it("director tem ambas true", () => {
    expect(PERMISSION_PRESETS.director.can_manage_brokers).toBe(true);
    expect(PERMISSION_PRESETS.director.can_manage_brokerages).toBe(true);
  });

  it("manager tem ambas true", () => {
    expect(PERMISSION_PRESETS.manager.can_manage_brokers).toBe(true);
    expect(PERMISSION_PRESETS.manager.can_manage_brokerages).toBe(true);
  });

  it("commercial_consultant tem brokers=true e brokerages=false (preserva direito legado de canCreateBroker)", () => {
    expect(PERMISSION_PRESETS.commercial_consultant.can_manage_brokers).toBe(true);
    expect(PERMISSION_PRESETS.commercial_consultant.can_manage_brokerages).toBe(false);
  });

  it("concierge tem ambas true (resolve bloqueio da Gabrielly)", () => {
    expect(PERMISSION_PRESETS.concierge.can_manage_brokers).toBe(true);
    expect(PERMISSION_PRESETS.concierge.can_manage_brokerages).toBe(true);
  });

  it("administrative tem ambas false", () => {
    expect(PERMISSION_PRESETS.administrative.can_manage_brokers).toBe(false);
    expect(PERMISSION_PRESETS.administrative.can_manage_brokerages).toBe(false);
  });

  it("broker tem ambas false", () => {
    expect(PERMISSION_PRESETS.broker.can_manage_brokers).toBe(false);
    expect(PERMISSION_PRESETS.broker.can_manage_brokerages).toBe(false);
  });
});

describe("resolvePermission — 3 camadas com as novas flags", () => {
  it("resolve preset de concierge para true sem overrides", () => {
    expect(resolvePermission("can_manage_brokers", "concierge")).toBe(true);
    expect(resolvePermission("can_manage_brokerages", "concierge")).toBe(true);
  });

  it("individual override prevalece sobre preset (desliga concierge)", () => {
    expect(
      resolvePermission("can_manage_brokers", "concierge", { can_manage_brokers: false }),
    ).toBe(false);
  });

  it("role override liga broker que estava false no preset", () => {
    expect(
      resolvePermission("can_manage_brokers", "broker", null, { can_manage_brokers: true }),
    ).toBe(true);
  });

  it("individual override vence role override", () => {
    expect(
      resolvePermission(
        "can_manage_brokers",
        "broker",
        { can_manage_brokers: false },
        { can_manage_brokers: true },
      ),
    ).toBe(false);
  });
});

describe("resolveAllPermissions — inclui as 2 flags novas", () => {
  it("concierge devolve objeto com 33 flags resolvidas (30 anteriores + 3 sociais)", () => {
    const all = resolveAllPermissions("concierge");
    expect(all.can_manage_brokers).toBe(true);
    expect(all.can_manage_brokerages).toBe(true);
    expect(Object.keys(all)).toHaveLength(33);
  });

  it("broker com role override apenas em brokerages preserva demais flags", () => {
    const all = resolveAllPermissions("broker", null, { can_manage_brokerages: true });
    expect(all.can_manage_brokers).toBe(false);
    expect(all.can_manage_brokerages).toBe(true);
  });
});

describe("diffFromPreset — não duplica valor default", () => {
  it("setar brokers=true para concierge devolve null (= preset)", () => {
    expect(diffFromPreset("concierge", { can_manage_brokers: true })).toBeNull();
  });

  it("setar brokers=false para concierge devolve diff com a flag", () => {
    expect(diffFromPreset("concierge", { can_manage_brokers: false })).toEqual({
      can_manage_brokers: false,
    });
  });

  it("setar brokerages=true para consultant devolve diff (preset é false)", () => {
    expect(diffFromPreset("commercial_consultant", { can_manage_brokerages: true })).toEqual({
      can_manage_brokerages: true,
    });
  });
});
