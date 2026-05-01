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
} from "../permissoes";

describe("Permissões por perfil", () => {
  describe("podeVerTodasNegociacoes", () => {
    it("director pode", () => expect(podeVerTodasNegociacoes("director")).toBe(true));
    it("manager pode", () => expect(podeVerTodasNegociacoes("manager")).toBe(true));
    it("owner pode", () => expect(podeVerTodasNegociacoes("owner")).toBe(true));
    it("administrative pode", () => expect(podeVerTodasNegociacoes("administrative")).toBe(true));
    it("broker NÃO pode", () => expect(podeVerTodasNegociacoes("broker")).toBe(false));
    it("consultant NÃO pode", () => expect(podeVerTodasNegociacoes("commercial_consultant")).toBe(false));
    it("null retorna false", () => expect(podeVerTodasNegociacoes(null)).toBe(false));
  });

  describe("podeAprovarReserva", () => {
    it("director pode", () => expect(podeAprovarReserva("director")).toBe(true));
    it("manager pode", () => expect(podeAprovarReserva("manager")).toBe(true));
    it("broker NÃO pode", () => expect(podeAprovarReserva("broker")).toBe(false));
    it("consultant NÃO pode", () => expect(podeAprovarReserva("commercial_consultant")).toBe(false));
  });

  describe("podeAcessarConfiguracoes", () => {
    it("director pode", () => expect(podeAcessarConfiguracoes("director")).toBe(true));
    it("owner pode", () => expect(podeAcessarConfiguracoes("owner")).toBe(true));
    it("manager NÃO pode", () => expect(podeAcessarConfiguracoes("manager")).toBe(false));
  });

  describe("podeVerVGV", () => {
    it("director pode", () => expect(podeVerVGV("director")).toBe(true));
    it("administrative pode", () => expect(podeVerVGV("administrative")).toBe(true));
    it("concierge pode", () => expect(podeVerVGV("concierge")).toBe(true));
    it("broker NÃO pode", () => expect(podeVerVGV("broker")).toBe(false));
  });

  describe("podeEditarMapa", () => {
    it("director pode", () => expect(podeEditarMapa("director")).toBe(true));
    it("broker NÃO pode", () => expect(podeEditarMapa("broker")).toBe(false));
  });

  describe("ehPerfilComercial", () => {
    it("broker é comercial", () => expect(ehPerfilComercial("broker")).toBe(true));
    it("commercial_consultant é comercial", () => expect(ehPerfilComercial("commercial_consultant")).toBe(true));
    it("director NÃO é comercial", () => expect(ehPerfilComercial("director")).toBe(false));
    it("manager NÃO é comercial", () => expect(ehPerfilComercial("manager")).toBe(false));
  });

  describe("podeGerenciarEmpreendimentos", () => {
    it("director pode", () => expect(podeGerenciarEmpreendimentos("director")).toBe(true));
    it("broker NÃO pode", () => expect(podeGerenciarEmpreendimentos("broker")).toBe(false));
  });

  describe("podeGerenciarUsuarios", () => {
    it("manager pode", () => expect(podeGerenciarUsuarios("manager")).toBe(true));
    it("broker NÃO pode", () => expect(podeGerenciarUsuarios("broker")).toBe(false));
  });

  describe("podeConvidarUsuarios", () => {
    it("manager pode", () => expect(podeConvidarUsuarios("manager")).toBe(true));
    it("broker NÃO pode", () => expect(podeConvidarUsuarios("broker")).toBe(false));
  });

  describe("getPermissions", () => {
    it("director tem permissões amplas", () => {
      const p = getPermissions("director");
      expect(p.canViewFullDashboard).toBe(true);
      expect(p.canApproveReservation).toBe(true);
      expect(p.canCompleteSale).toBe(true);
      expect(p.canCreateNegotiation).toBe(true);
    });

    it("broker tem permissões limitadas", () => {
      const p = getPermissions("broker");
      expect(p.canViewFullDashboard).toBe(false);
      expect(p.canApproveReservation).toBe(false);
      expect(p.canCreateNegotiation).toBe(true);
      expect(p.canRequestReservation).toBe(true);
    });

    it("null retorna permissões mínimas", () => {
      const p = getPermissions(null);
      expect(p.canViewFullDashboard).toBe(false);
      expect(p.canApproveReservation).toBe(false);
      expect(p.canCreateNegotiation).toBe(false);
    });
  });
});
