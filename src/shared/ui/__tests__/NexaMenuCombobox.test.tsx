import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NexaMenu } from "../NexaMenu";
import { NexaCombobox } from "../NexaCombobox";

const FEW = Array.from({ length: 4 }, (_, i) => ({ value: `v${i}`, label: `Opt ${i}` }));
const MANY = Array.from({ length: 12 }, (_, i) => ({ value: `v${i}`, label: `Opt ${i}` }));

describe("NexaMenu — listas curtas, SEM busca", () => {
  it("não renderiza campo de busca e seleciona", () => {
    const onChange = vi.fn();
    render(<NexaMenu options={FEW} value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    // sem campo de busca VISÍVEL (o input de typeahead existe mas é sr-only)
    expect(screen.getByPlaceholderText("Buscar...").className).toContain("nexa-select-input-hidden");
    fireEvent.click(screen.getByText("Opt 2"));
    expect(onChange).toHaveBeenCalledWith("v2");
  });
});

describe("NexaCombobox — listas longas, COM busca", () => {
  it("renderiza busca e filtra", () => {
    render(<NexaCombobox options={MANY} value={null} onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByPlaceholderText("Buscar...");
    fireEvent.change(input, { target: { value: "Opt 1" } });
    // Opt 1, Opt 10, Opt 11
    expect(screen.getAllByRole("option").length).toBe(3);
  });
});
