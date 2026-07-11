import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NexaSelect, type NexaSelectOption } from "../NexaSelect";

const OPTS: NexaSelectOption[] = [
  { value: "a", label: "Alfa" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gama", disabled: true, hint: "sem corretores ativos" },
  { value: "d", label: "Delta", disabled: true, hint: "sem corretores ativos" },
];

beforeEach(() => localStorage.clear());
const open = () => fireEvent.click(screen.getByRole("button"));

describe("L4 — o gatilho conta a verdade", () => {
  it("mostra o valor atual (não placeholder) quando há valor", () => {
    render(<NexaSelect options={OPTS} value="a" onChange={() => {}} placeholder="Selecionar..." />);
    expect(screen.getByRole("button")).toHaveTextContent("Alfa");
  });
  it("value='' com opção 'Todas' mostra 'Todas', não o placeholder", () => {
    const opts = [{ value: "", label: "Todas" }, ...OPTS];
    render(<NexaSelect options={opts} value="" onChange={() => {}} placeholder="Selecionar..." />);
    const btn = screen.getByRole("button");
    expect(btn).toHaveTextContent("Todas");
    expect(btn).not.toHaveTextContent("Selecionar...");
  });
  it("placeholder só quando genuinamente vazio", () => {
    render(<NexaSelect options={OPTS} value={null} onChange={() => {}} placeholder="Selecionar..." />);
    expect(screen.getByRole("button")).toHaveTextContent("Selecionar...");
  });
});

describe("L1/L2 — acionável primeiro; ruído recolhido sob cabeçalho por motivo", () => {
  it("desabilitadas NÃO aparecem até expandir; cabeçalho traz contagem + motivo + noun", () => {
    render(<NexaSelect options={OPTS} value={null} onChange={() => {}} noun="imobiliárias" />);
    open();
    // acionáveis visíveis
    expect(screen.getByText("Alfa")).toBeTruthy();
    expect(screen.getByText("Beta")).toBeTruthy();
    // desabilitadas ocultas sob cabeçalho único (sem repetir a frase em cada item)
    expect(screen.queryByText("Gama")).toBeNull();
    expect(screen.getByText("2 imobiliárias sem corretores ativos")).toBeTruthy();
  });
  it("expande o cabeçalho e revela os itens desabilitados (não selecionáveis)", () => {
    const onChange = vi.fn();
    render(<NexaSelect options={OPTS} value={null} onChange={onChange} noun="imobiliárias" />);
    open();
    fireEvent.click(screen.getByText("2 imobiliárias sem corretores ativos"));
    const gama = screen.getByText("Gama").closest('[role="option"]')!;
    expect(gama.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(gama);
    expect(onChange).not.toHaveBeenCalled();
  });
  it("acionável selecionável fica ANTES do bloco desabilitado (ordem no DOM)", () => {
    render(<NexaSelect options={OPTS} value={null} onChange={() => {}} noun="imobiliárias" />);
    open();
    const panel = screen.getByRole("listbox");
    const html = panel.innerHTML;
    expect(html.indexOf("Beta")).toBeLessThan(html.indexOf("sem corretores ativos"));
  });
});

describe("L5 — busca instantânea e honesta", () => {
  const many: NexaSelectOption[] = [
    ...Array.from({ length: 8 }, (_, i) => ({ value: `e${i}`, label: `Ativa ${i}` })),
    { value: "z", label: "Zumbi Imóveis", disabled: true, hint: "sem corretores ativos" },
  ];
  it("filtra e a desabilitada encontrada aparece na seção dela (expandida na busca)", () => {
    render(<NexaSelect options={many} value={null} onChange={() => {}} noun="imobiliárias" />);
    open();
    fireEvent.change(screen.getByPlaceholderText("Buscar..."), { target: { value: "Zumbi" } });
    // realce quebra o texto em nós (<mark>), então checamos o conteúdo do painel.
    expect(screen.getByRole("listbox").textContent).toContain("Zumbi Imóveis"); // desabilitada revelada pela busca
    expect(screen.queryByText("Ativa 0")).toBeNull();
  });
  it("zero resultados: mensagem clara com o domínio", () => {
    render(<NexaSelect options={many} value={null} onChange={() => {}} noun="imobiliárias" />);
    open();
    fireEvent.change(screen.getByPlaceholderText("Buscar..."), { target: { value: "xyzabc" } });
    expect(screen.getByText(/Nenhum resultado em imobiliárias para/)).toBeTruthy();
  });
});

describe("L6 — recentes no topo (persistência por usuário)", () => {
  it("após selecionar, a seção Recentes aparece ao reabrir", () => {
    const onChange = vi.fn();
    render(<NexaSelect options={OPTS} value={null} onChange={onChange} recentKey="test-key" />);
    open();
    fireEvent.click(screen.getByText("Beta"));
    expect(onChange).toHaveBeenCalledWith("b");
    open(); // reabre
    expect(screen.getByText("Recentes")).toBeTruthy();
    expect(localStorage.getItem("nexa-recents:test-key")).toContain("b");
  });
  it("sem recentKey não há seção Recentes", () => {
    render(<NexaSelect options={OPTS} value={null} onChange={() => {}} />);
    open();
    expect(screen.queryByText("Recentes")).toBeNull();
  });
});

describe("L7 — teclado impecável", () => {
  it("setas navegam SÓ acionáveis (pulam desabilitadas) e Enter seleciona", () => {
    const onChange = vi.fn();
    render(<NexaSelect options={OPTS} value={null} onChange={onChange} />);
    const btn = screen.getByRole("button");
    fireEvent.keyDown(btn, { key: "ArrowDown" }); // abre, ativo=Alfa(0)
    fireEvent.keyDown(btn, { key: "ArrowDown" }); // Beta(1)
    fireEvent.keyDown(btn, { key: "ArrowDown" }); // volta Alfa(0) — só 2 navegáveis
    fireEvent.keyDown(btn, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("a");
  });
  it("Esc fecha o painel", () => {
    render(<NexaSelect options={OPTS} value={null} onChange={() => {}} />);
    open();
    expect(screen.queryByRole("listbox")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("L8 — o conjunto se explica (rodapé)", () => {
  it("mostra o rodapé quando há desabilitadas", () => {
    render(<NexaSelect options={OPTS} value={null} onChange={() => {}} footer={<a href="#">Convidar corretores →</a>} />);
    open();
    expect(screen.getByText("Convidar corretores →")).toBeTruthy();
  });
  it("sem desabilitadas, sem rodapé", () => {
    render(<NexaSelect options={[{ value: "a", label: "Alfa" }]} value={null} onChange={() => {}} footer={<a href="#">Convidar corretores →</a>} />);
    open();
    expect(screen.queryByText("Convidar corretores →")).toBeNull();
  });
});

describe("estados e básicos", () => {
  it("selecionar chama onChange", () => {
    const onChange = vi.fn();
    render(<NexaSelect options={OPTS} value={null} onChange={onChange} />);
    open();
    fireEvent.click(screen.getByText("Beta"));
    expect(onChange).toHaveBeenCalledWith("b");
  });
  it("carregando: trigger desabilitado", () => {
    render(<NexaSelect options={[]} value={null} onChange={() => {}} loading />);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });
  it("erro", () => {
    render(<NexaSelect options={[]} value={null} onChange={() => {}} error="Falha ao carregar" />);
    open();
    expect(screen.getByText("Falha ao carregar")).toBeTruthy();
  });
});
