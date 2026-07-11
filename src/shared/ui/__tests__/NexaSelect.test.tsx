import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { NexaSelect, type NexaSelectOption } from "../NexaSelect";

const OPTS: NexaSelectOption[] = [
  { value: "a", label: "Alfa" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gama", disabled: true, hint: "sem corretores ativos" },
];

function open() {
  fireEvent.click(screen.getByRole("button"));
}

describe("NexaSelect — trigger e seleção", () => {
  it("mostra placeholder e abre o painel (listbox em portal)", () => {
    render(<NexaSelect options={OPTS} value={null} onChange={() => {}} placeholder="Selecionar..." />);
    expect(screen.getByRole("button")).toHaveTextContent("Selecionar...");
    open();
    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("selecionar chama onChange com o value", () => {
    const onChange = vi.fn();
    render(<NexaSelect options={OPTS} value={null} onChange={onChange} />);
    open();
    fireEvent.click(screen.getByText("Beta"));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("item selecionado aparece no trigger", () => {
    render(<NexaSelect options={OPTS} value="a" onChange={() => {}} />);
    expect(screen.getByRole("button")).toHaveTextContent("Alfa");
  });
});

describe("NexaSelect — item desabilitado NUNCA é mudo", () => {
  it("tem aria-disabled, exibe o hint e NÃO seleciona ao clicar", () => {
    const onChange = vi.fn();
    render(<NexaSelect options={OPTS} value={null} onChange={onChange} />);
    open();
    const gama = screen.getByText("Gama").closest('[role="option"]')!;
    expect(gama.getAttribute("aria-disabled")).toBe("true");
    expect(within(gama as HTMLElement).getByText("sem corretores ativos")).toBeTruthy();
    fireEvent.click(gama);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("NexaSelect — teclado", () => {
  it("ArrowDown + Enter seleciona o primeiro habilitado e pula o desabilitado", () => {
    const onChange = vi.fn();
    render(<NexaSelect options={OPTS} value={null} onChange={onChange} />);
    const btn = screen.getByRole("button");
    fireEvent.keyDown(btn, { key: "ArrowDown" }); // abre + ativa 1º habilitado (Alfa)
    fireEvent.keyDown(btn, { key: "ArrowDown" }); // Beta
    fireEvent.keyDown(btn, { key: "ArrowDown" }); // pula Gama (disabled) → volta Alfa
    fireEvent.keyDown(btn, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("Escape fecha o painel", () => {
    render(<NexaSelect options={OPTS} value={null} onChange={() => {}} />);
    open();
    expect(screen.queryByRole("listbox")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("NexaSelect — busca automática (> 8 opções)", () => {
  const many: NexaSelectOption[] = Array.from({ length: 12 }, (_, i) => ({ value: `v${i}`, label: `Item ${i}` }));
  it("mostra campo de busca e filtra", () => {
    render(<NexaSelect options={many} value={null} onChange={() => {}} />);
    open();
    const input = screen.getByPlaceholderText("Buscar...");
    fireEvent.change(input, { target: { value: "Item 1" } });
    // "Item 1", "Item 10" e "Item 11"
    expect(screen.getAllByRole("option").length).toBe(3);
  });

  it("não mostra busca com poucas opções", () => {
    render(<NexaSelect options={OPTS} value={null} onChange={() => {}} />);
    open();
    expect(screen.queryByPlaceholderText("Buscar...")).toBeNull();
  });
});

describe("NexaSelect — grupos", () => {
  const grouped: NexaSelectOption[] = [
    { value: "x", label: "Ivo", group: "Alfa Imóveis" },
    { value: "y", label: "Ana", group: "Alfa Imóveis" },
    { value: "z", label: "Zeca", group: "Beta Corretora" },
  ];
  it("renderiza cabeçalhos de grupo", () => {
    render(<NexaSelect options={grouped} value={null} onChange={() => {}} />);
    open();
    expect(screen.getByText("Alfa Imóveis")).toBeTruthy();
    expect(screen.getByText("Beta Corretora")).toBeTruthy();
  });
});

describe("NexaSelect — estados", () => {
  it("vazio", () => {
    render(<NexaSelect options={[]} value={null} onChange={() => {}} emptyLabel="Nenhuma opção" />);
    open();
    expect(screen.getByText("Nenhuma opção")).toBeTruthy();
  });
  it("erro", () => {
    render(<NexaSelect options={[]} value={null} onChange={() => {}} error="Falha ao carregar" />);
    open();
    expect(screen.getByText("Falha ao carregar")).toBeTruthy();
  });
  it("carregando: trigger desabilitado e rótulo Carregando", () => {
    render(<NexaSelect options={[]} value={null} onChange={() => {}} loading />);
    const btn = screen.getByRole("button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn).toHaveTextContent("Carregando...");
  });
});
