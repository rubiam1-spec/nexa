import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { contactRoute, negotiationRoute, brokerRoute, unitRoute, entityRoute, routeLabel, openActionLabel, ENTITY_LIST_HOME } from "../entityRoutes";
import { useReturnTo } from "../useReturnTo";

describe("entityRoutes — builders canônicos", () => {
  it("uma casa por entidade", () => {
    expect(contactRoute("c1")).toBe("/contatos/c1");
    expect(negotiationRoute("n1")).toBe("/negociacoes/n1");
    expect(brokerRoute("b1")).toBe("/corretores/b1");
    expect(unitRoute("u1")).toBe("/unidades?unidade=u1");
  });

  it("entityRoute despacha por tipo", () => {
    expect(entityRoute("contact", "c1")).toBe("/contatos/c1");
    expect(entityRoute("negotiation", "n1")).toBe("/negociacoes/n1");
    expect(entityRoute("unit", "u1")).toBe("/unidades?unidade=u1");
    expect(entityRoute("broker", "b1")).toBe("/corretores/b1");
  });

  it("routeLabel mapeia origens conhecidas", () => {
    expect(routeLabel("/leads")).toBe("Leads");
    expect(routeLabel("/negociacoes")).toBe("Negociações");
    expect(routeLabel("/negociacoes/abc")).toBe("Negociações");
    expect(routeLabel("/contatos")).toBe("Contatos");
    expect(routeLabel("/unidades?unidade=x")).toBe("Unidades");
    expect(routeLabel("/")).toBe("Central");
    expect(routeLabel("/algo-desconhecido")).toBe("Voltar");
  });

  it("openActionLabel nomeia a entidade destino (Lei 4)", () => {
    expect(openActionLabel("contact")).toBe("abrir contato");
    expect(openActionLabel("negotiation")).toBe("abrir negociação");
    expect(openActionLabel("unit")).toBe("abrir unidade");
    expect(openActionLabel("broker")).toBe("abrir corretor");
  });

  it("ENTITY_LIST_HOME cobre as 4 entidades", () => {
    expect(ENTITY_LIST_HOME.contact).toEqual({ to: "/contatos", label: "Contatos" });
    expect(ENTITY_LIST_HOME.negotiation.to).toBe("/negociacoes");
  });
});

describe("useReturnTo — origem no state, fallback na casa da lista", () => {
  const wrap = (initial: { pathname: string; state?: unknown }) =>
    ({ children }: { children: ReactNode }) =>
      createElement(MemoryRouter, { initialEntries: [initial] }, children);

  it("usa a origem quando o state traz from/fromLabel", () => {
    const { result } = renderHook(() => useReturnTo(ENTITY_LIST_HOME.contact), {
      wrapper: wrap({ pathname: "/contatos/c1", state: { from: "/leads", fromLabel: "Leads" } }),
    });
    expect(result.current).toEqual({ to: "/leads", label: "Leads" });
  });

  it("cai no fallback (casa da lista) quando não há origem", () => {
    const { result } = renderHook(() => useReturnTo(ENTITY_LIST_HOME.contact), {
      wrapper: wrap({ pathname: "/contatos/c1" }),
    });
    expect(result.current).toEqual({ to: "/contatos", label: "Contatos" });
  });
});
