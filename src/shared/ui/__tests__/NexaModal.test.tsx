import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NexaModal } from "../NexaModal";

const Card = () => (
  <div data-testid="card" style={{ background: "#111" }}>
    <input placeholder="campo" />
    <button>ok</button>
  </div>
);

describe("NexaModal — ancorado na viewport (não na página)", () => {
  it("renderiza em PORTAL no document.body, escapando de ancestral com transform", () => {
    // Simula a página rolada / card animado: um ancestral com transform re-ancora
    // `position:fixed` — o portal p/ body é o que garante a viewport.
    render(
      <div style={{ transform: "translateY(400px)", position: "relative" }}>
        <NexaModal onClose={() => {}}><Card /></NexaModal>
      </div>,
    );
    const backdrop = document.body.querySelector('[data-nexa-modal="backdrop"]') as HTMLElement;
    expect(backdrop).toBeTruthy();
    expect(backdrop.parentElement).toBe(document.body); // fora do ancestral transformado
    expect(backdrop.style.position).toBe("fixed");
    expect(backdrop.style.inset).toBe("0px");
    expect(Number(backdrop.style.zIndex)).toBeGreaterThanOrEqual(9000);
  });

  it("Esc fecha", () => {
    const onClose = vi.fn();
    render(<NexaModal onClose={onClose}><Card /></NexaModal>);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("clique no backdrop fecha; clique no conteúdo NÃO fecha", () => {
    const onClose = vi.fn();
    render(<NexaModal onClose={onClose}><Card /></NexaModal>);
    fireEvent.click(screen.getByTestId("card"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(document.body.querySelector('[data-nexa-modal="backdrop"]')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("trava o scroll da página enquanto aberto e restaura ao fechar", () => {
    const { unmount } = render(<NexaModal onClose={() => {}}><Card /></NexaModal>);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("foco inicial no primeiro campo", () => {
    render(<NexaModal onClose={() => {}}><Card /></NexaModal>);
    expect(document.activeElement).toBe(screen.getByPlaceholderText("campo"));
  });
});
