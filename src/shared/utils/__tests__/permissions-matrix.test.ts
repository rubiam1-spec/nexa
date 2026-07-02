import { describe, it, expect } from "vitest";
import {
  podeVerTodasNegociacoes,
  podeAprovarReserva,
  podeAcessarConfiguracoes,
  podeVerVGV,
  podeEditarMapa,
  ehPerfilComercial,
  podeGerenciarEmpreendimentos,
  podeGerenciarUsuarios,
  podeConvidarUsuarios,
  getPermissions,
  podeVerItem,
} from "../permissoes";


// ─── Matriz completa por função ───

describe("Matriz de permissões — podeVerTodasNegociacoes", () => {
  const allowed = ["owner", "director", "manager", "administrative"];
  const denied = ["commercial_consultant", "broker", "concierge"];
  allowed.forEach((r) => it(`${r} PODE`, () => expect(podeVerTodasNegociacoes(r)).toBe(true)));
  denied.forEach((r) => it(`${r} NÃO pode`, () => expect(podeVerTodasNegociacoes(r)).toBe(false)));
});

describe("Matriz de permissões — podeAprovarReserva", () => {
  // administrative pode aprovar reserva (decisão de produto — auditoria M9)
  const allowed = ["owner", "director", "manager", "administrative"];
  const denied = ["commercial_consultant", "broker", "concierge"];
  allowed.forEach((r) => it(`${r} PODE`, () => expect(podeAprovarReserva(r)).toBe(true)));
  denied.forEach((r) => it(`${r} NÃO pode`, () => expect(podeAprovarReserva(r)).toBe(false)));
});

describe("Matriz de permissões — podeAcessarConfiguracoes", () => {
  const allowed = ["owner", "director"];
  const denied = ["manager", "commercial_consultant", "broker", "administrative", "concierge"];
  allowed.forEach((r) => it(`${r} PODE`, () => expect(podeAcessarConfiguracoes(r)).toBe(true)));
  denied.forEach((r) => it(`${r} N��O pode`, () => expect(podeAcessarConfiguracoes(r)).toBe(false)));
});

describe("Matriz de permissões — podeVerVGV", () => {
  const allowed = ["owner", "director", "manager", "administrative", "concierge"];
  const denied = ["commercial_consultant", "broker"];
  allowed.forEach((r) => it(`${r} PODE`, () => expect(podeVerVGV(r)).toBe(true)));
  denied.forEach((r) => it(`${r} NÃO pode`, () => expect(podeVerVGV(r)).toBe(false)));
});

describe("Matriz de permiss��es — podeEditarMapa", () => {
  const allowed = ["owner", "director", "manager"];
  const denied = ["commercial_consultant", "broker", "administrative", "concierge"];
  allowed.forEach((r) => it(`${r} PODE`, () => expect(podeEditarMapa(r)).toBe(true)));
  denied.forEach((r) => it(`${r} NÃO pode`, () => expect(podeEditarMapa(r)).toBe(false)));
});

describe("Matriz de permissões — ehPerfilComercial", () => {
  const yes = ["commercial_consultant", "broker"];
  const no = ["owner", "director", "manager", "administrative", "concierge"];
  yes.forEach((r) => it(`${r} É comercial`, () => expect(ehPerfilComercial(r)).toBe(true)));
  no.forEach((r) => it(`${r} NÃO é comercial`, () => expect(ehPerfilComercial(r)).toBe(false)));
});

describe("Matriz de permissões — podeGerenciarEmpreendimentos", () => {
  const allowed = ["owner", "director", "manager"];
  const denied = ["commercial_consultant", "broker", "administrative", "concierge"];
  allowed.forEach((r) => it(`${r} PODE`, () => expect(podeGerenciarEmpreendimentos(r)).toBe(true)));
  denied.forEach((r) => it(`${r} NÃO pode`, () => expect(podeGerenciarEmpreendimentos(r)).toBe(false)));
});

describe("Matriz de permissões — podeGerenciarUsuarios", () => {
  const allowed = ["owner", "director", "manager"];
  const denied = ["commercial_consultant", "broker", "administrative", "concierge"];
  allowed.forEach((r) => it(`${r} PODE`, () => expect(podeGerenciarUsuarios(r)).toBe(true)));
  denied.forEach((r) => it(`${r} NÃO pode`, () => expect(podeGerenciarUsuarios(r)).toBe(false)));
});

describe("Matriz de permiss��es — podeConvidarUsuarios", () => {
  const allowed = ["owner", "director", "manager"];
  const denied = ["commercial_consultant", "broker", "administrative", "concierge"];
  allowed.forEach((r) => it(`${r} PODE`, () => expect(podeConvidarUsuarios(r)).toBe(true)));
  denied.forEach((r) => it(`${r} NÃO pode`, () => expect(podeConvidarUsuarios(r)).toBe(false)));
});

// ─── getPermissions — todas as flags por perfil ───

describe("getPermissions — director (acesso amplo)", () => {
  const p = getPermissions("director");
  it("canViewFullDashboard", () => expect(p.canViewFullDashboard).toBe(true));
  it("canCustomizeDashboard", () => expect(p.canCustomizeDashboard).toBe(true));
  it("canCreateNegotiation", () => expect(p.canCreateNegotiation).toBe(true));
  it("canEditNegotiation", () => expect(p.canEditNegotiation).toBe(true));
  it("canCreateProposal", () => expect(p.canCreateProposal).toBe(true));
  it("canRequestReservation", () => expect(p.canRequestReservation).toBe(true));
  it("canApproveReservation", () => expect(p.canApproveReservation).toBe(true));
  it("canCancelReservation", () => expect(p.canCancelReservation).toBe(true));
  it("canCompleteSale", () => expect(p.canCompleteSale).toBe(true));
  it("canCancelSale", () => expect(p.canCancelSale).toBe(true));
  it("canAlterQueuePriority", () => expect(p.canAlterQueuePriority).toBe(true));
  it("canManageBrokers", () => expect(p.canManageBrokers).toBe(true));
  it("canCreateBroker", () => expect(p.canCreateBroker).toBe(true));
  it("canViewBrokers", () => expect(p.canViewBrokers).toBe(true));
  it("canInviteBroker", () => expect(p.canInviteBroker).toBe(true));
  it("canDeactivateBroker", () => expect(p.canDeactivateBroker).toBe(true));
  it("canViewUnitStatus", () => expect(p.canViewUnitStatus).toBe(true));
  it("canViewVGV", () => expect(p.canViewVGV).toBe(true));
  it("canManageUsers", () => expect(p.canManageUsers).toBe(true));
  it("canAccessSettings", () => expect(p.canAccessSettings).toBe(true));
});

describe("getPermissions — broker (acesso restrito)", () => {
  const p = getPermissions("broker");
  it("canViewFullDashboard = false", () => expect(p.canViewFullDashboard).toBe(false));
  it("canCreateNegotiation = true", () => expect(p.canCreateNegotiation).toBe(true));
  it("canEditNegotiation = false", () => expect(p.canEditNegotiation).toBe(false));
  it("canCreateProposal = true", () => expect(p.canCreateProposal).toBe(true));
  it("canRequestReservation = true", () => expect(p.canRequestReservation).toBe(true));
  it("canApproveReservation = false", () => expect(p.canApproveReservation).toBe(false));
  it("canCancelReservation = false", () => expect(p.canCancelReservation).toBe(false));
  it("canCompleteSale = false", () => expect(p.canCompleteSale).toBe(false));
  it("canCancelSale = false", () => expect(p.canCancelSale).toBe(false));
  it("canAlterQueuePriority = false", () => expect(p.canAlterQueuePriority).toBe(false));
  it("canManageBrokers = false", () => expect(p.canManageBrokers).toBe(false));
  it("canManageUsers = false", () => expect(p.canManageUsers).toBe(false));
  it("canAccessSettings = false", () => expect(p.canAccessSettings).toBe(false));
});

describe("getPermissions — commercial_consultant", () => {
  const p = getPermissions("commercial_consultant");
  it("canCreateNegotiation", () => expect(p.canCreateNegotiation).toBe(true));
  it("canEditNegotiation", () => expect(p.canEditNegotiation).toBe(true));
  it("canCreateProposal", () => expect(p.canCreateProposal).toBe(true));
  it("canRequestReservation", () => expect(p.canRequestReservation).toBe(true));
  it("canApproveReservation = false", () => expect(p.canApproveReservation).toBe(false));
  it("canCompleteSale = false", () => expect(p.canCompleteSale).toBe(false));
  it("canAlterQueuePriority = false", () => expect(p.canAlterQueuePriority).toBe(false));
  it("canCreateBroker", () => expect(p.canCreateBroker).toBe(true));
  it("canViewBrokers", () => expect(p.canViewBrokers).toBe(true));
  it("canManageBrokers = false", () => expect(p.canManageBrokers).toBe(false));
});

describe("getPermissions — administrative", () => {
  const p = getPermissions("administrative");
  it("canViewFullDashboard = false", () => expect(p.canViewFullDashboard).toBe(false));
  it("canCreateNegotiation = false", () => expect(p.canCreateNegotiation).toBe(false));
  it("canApproveReservation = true (M9)", () => expect(p.canApproveReservation).toBe(true));
  it("canManageUsers = false", () => expect(p.canManageUsers).toBe(false));
  it("canAccessSettings = false", () => expect(p.canAccessSettings).toBe(false));
});

describe("getPermissions — concierge", () => {
  const p = getPermissions("concierge");
  it("canManageBrokers", () => expect(p.canManageBrokers).toBe(true));
  it("canCreateBroker", () => expect(p.canCreateBroker).toBe(true));
  it("canViewBrokers", () => expect(p.canViewBrokers).toBe(true));
  it("canApproveReservation = false", () => expect(p.canApproveReservation).toBe(false));
  it("canAlterQueuePriority = false", () => expect(p.canAlterQueuePriority).toBe(false));
  it("canAccessSettings = false", () => expect(p.canAccessSettings).toBe(false));
});

describe("getPermissions — null (sem perfil)", () => {
  const p = getPermissions(null);
  it("nenhuma permissão ativa", () => {
    const allFalse = Object.values(p).every((v) => v === false);
    expect(allFalse).toBe(true);
  });
});

// ─── podeVerItem — visibilidade do sidebar ───

describe("podeVerItem — broker (sidebar restrito)", () => {
  const allowed = ["meudia", "notificacoes", "simulador", "contatos", "negociacoes", "pipeline", "unidades", "imoveis", "atividades", "feed", "materiais"];
  const denied = ["configuracoes", "empreendimentos", "usuarios", "corretores", "imobiliarias", "relatorios"];
  allowed.forEach((k) => it(`broker vê ${k}`, () => expect(podeVerItem(k, "broker")).toBe(true)));
  denied.forEach((k) => it(`broker NÃO v�� ${k}`, () => expect(podeVerItem(k, "broker")).toBe(false)));
});

describe("podeVerItem — commercial_consultant (sidebar amplo)", () => {
  const allowed = ["meudia", "notificacoes", "simulador", "contatos", "negociacoes", "pipeline", "unidades", "imoveis", "corretores", "imobiliarias", "atividades", "materiais", "feed", "relatorios"];
  const denied = ["configuracoes", "empreendimentos", "usuarios"];
  allowed.forEach((k) => it(`consultant vê ${k}`, () => expect(podeVerItem(k, "commercial_consultant")).toBe(true)));
  denied.forEach((k) => it(`consultant NÃO vê ${k}`, () => expect(podeVerItem(k, "commercial_consultant")).toBe(false)));
});

describe("podeVerItem — administrative (sem pipeline/empreendimentos/usuarios)", () => {
  const denied = ["pipeline", "empreendimentos", "usuarios"];
  const allowed = ["meudia", "negociacoes", "unidades", "atividades", "contatos", "simulador", "materiais"];
  denied.forEach((k) => it(`admin NÃO vê ${k}`, () => expect(podeVerItem(k, "administrative")).toBe(false)));
  allowed.forEach((k) => it(`admin vê ${k}`, () => expect(podeVerItem(k, "administrative")).toBe(true)));
});

describe("podeVerItem — concierge", () => {
  const allowed = ["meudia", "notificacoes", "simulador", "contatos", "pipeline", "unidades", "imoveis", "negociacoes", "corretores", "imobiliarias", "atividades", "feed", "relatorios", "materiais", "configuracoes"];
  allowed.forEach((k) => it(`concierge vê ${k}`, () => expect(podeVerItem(k, "concierge")).toBe(true)));
  it("concierge NÃO vê empreendimentos", () => expect(podeVerItem("empreendimentos", "concierge")).toBe(false));
  it("concierge NÃO vê usuarios", () => expect(podeVerItem("usuarios", "concierge")).toBe(false));
});

describe("podeVerItem — director (vê quase tudo)", () => {
  const allItems = ["meudia", "negociacoes", "pipeline", "unidades", "configuracoes", "empreendimentos", "usuarios", "atividades", "simulador"];
  allItems.forEach((k) => it(`director vê ${k}`, () => expect(podeVerItem(k, "director")).toBe(true)));
});

describe("podeVerItem — null retorna false para tudo", () => {
  const items = ["meudia", "negociacoes", "configuracoes"];
  items.forEach((k) => it(`null NÃO vê ${k}`, () => expect(podeVerItem(k, null)).toBe(false)));
});
