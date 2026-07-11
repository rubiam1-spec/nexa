import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NexaEntityPicker } from "../NexaEntityPicker";
import type { PickerModel } from "../../../modules/leads/assignmentGrouping";

const MODEL: PickerModel = {
  internal: [{ id: "i1", name: "Ana Gestora", subtitle: "Gestor(a)", activeLeads: 2 }],
  brokerages: [
    {
      brokerage: { id: "b1", name: "Master Home", activeCount: 2 },
      people: [
        { id: "p1", name: "Ivo Silva", subtitle: "Master Home", activeLeads: 0 },
        { id: "p2", name: "Jefte Souza", subtitle: "Master Home", activeLeads: 1 },
      ],
    },
  ],
  autonomos: [{ id: "a1", name: "Nina Autonoma", subtitle: "Autônomo", activeLeads: 0 }],
  inactiveBrokerages: [
    { id: "b2", name: "Beta Corretora", activeCount: 0 },
    { id: "b3", name: "Gama Negócios", activeCount: 0 },
  ],
};

const renderPicker = (onPick = vi.fn()) => ({ onPick, ...render(<NexaEntityPicker model={MODEL} onPick={onPick} pendingLabel="29 imobiliárias · 253 corretores cadastrados ainda sem acesso" onInvite={() => {}} />) });
const mainSearch = () => screen.getByPlaceholderText("Buscar por nome ou imobiliária...");
// Cabeçalho de grupo (div) e item de menu (button) têm o mesmo texto — pega o do menu.
const clickMenu = (label: string) => {
  const el = screen.getAllByText(new RegExp(label)).find((e) => e.closest("button"));
  fireEvent.click(el!);
};

describe("NexaEntityPicker — regras duras (testes bloqueantes)", () => {
  it("T1 — nenhuma entidade aparece duas vezes", () => {
    renderPicker();
    for (const n of ["Ana Gestora", "Ivo Silva", "Jefte Souza", "Nina Autonoma"]) {
      expect(screen.getAllByText(n)).toHaveLength(1);
    }
  });

  it("T2 — cabeçalho de grupo não é interativo (é <div>, sem role button)", () => {
    renderPicker();
    const header = screen.getByText("Equipe interna");
    expect(header.tagName).toBe("DIV");
    expect(header.closest("button")).toBeNull();
  });

  it("T3 — clique numa pessoa dispara onPick (o 'clique morto' não regride)", () => {
    const { onPick } = renderPicker();
    fireEvent.click(screen.getByText("Ivo Silva"));
    expect(onPick).toHaveBeenCalledWith("p1", "Ivo Silva");
  });

  it("T4 — não existe <select> nem NexaSelect dentro do EntityPicker", () => {
    const { container } = renderPicker();
    expect(container.querySelector("select")).toBeNull();
    expect(container.querySelector('[data-nexa-select="root"]')).toBeNull();
  });

  it("T5 — com filtro Autônomos, buscar 'jefte' retorna vazio (lei do escopo)", () => {
    renderPicker();
    fireEvent.click(screen.getByText("Filtros"));
    clickMenu("Autônomos");
    fireEvent.change(mainSearch(), { target: { value: "jefte" } });
    expect(screen.queryByText("Jefte Souza")).toBeNull();
    expect(screen.getByText(/Nenhum resultado/)).toBeTruthy();
  });

  it("T6 — 'master' sem filtro mostra a sugestão; clicá-la aplica o token e lista só Master Home", () => {
    renderPicker();
    fireEvent.change(mainSearch(), { target: { value: "master" } });
    const sug = screen.getByText(/Filtrar pela imobiliária Master Home/);
    expect(sug).toBeTruthy();
    fireEvent.click(sug);
    expect(screen.getByText(/Imobiliária: Master Home/)).toBeTruthy(); // token
    expect(screen.getByText("Ivo Silva")).toBeTruthy();
    expect(screen.queryByText("Ana Gestora")).toBeNull(); // fora do escopo do filtro
  });
});

describe("NexaEntityPicker — comportamento aprovado", () => {
  it("escopo sem filtro busca em nome E imobiliária", () => {
    renderPicker();
    fireEvent.change(mainSearch(), { target: { value: "master" } });
    // Ivo/Jefte casam por imobiliária mesmo sem 'master' no nome
    expect(screen.getByText("Ivo Silva")).toBeTruthy();
    expect(screen.queryByText("Nina Autonoma")).toBeNull();
  });

  it("token removível volta à visão agrupada; Esc remove o filtro", () => {
    renderPicker();
    fireEvent.click(screen.getByText("Filtros"));
    clickMenu("Equipe interna");
    expect(screen.getByText(/Imobiliária:|Equipe interna/)).toBeTruthy();
    // Esc remove o filtro (não fecha o modal)
    fireEvent.keyDown(screen.getByPlaceholderText("Buscar por nome ou imobiliária..."), { key: "Escape" });
    expect(screen.getAllByText("Nina Autonoma")).toHaveLength(1); // voltou à visão completa
  });

  it("rodapé com síntese + Convidar", () => {
    renderPicker();
    expect(screen.getByText(/ainda sem acesso/)).toBeTruthy();
    expect(screen.getByText("Convidar →")).toBeTruthy();
  });
});
