import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LoginMural from "../components/LoginMural";
import type { LoginMuralItem } from "../types/loginMural";

const base: LoginMuralItem = {
  kind: "manifesto",
  headline: "Onde o terreno bruto vira patrimônio rastreável.",
  subline: "Plataforma comercial imobiliária.",
  badge_label: null,
  badge_color: null,
  cta_label: null,
  cta_url: null,
};

describe("<LoginMural />", () => {
  it("renderiza headline e subline", () => {
    render(<LoginMural item={base} />);
    expect(screen.getByText(/terreno bruto/i)).toBeInTheDocument();
    expect(screen.getByText(/plataforma comercial/i)).toBeInTheDocument();
  });

  it("não renderiza badge quando badge_label é null", () => {
    render(<LoginMural item={base} />);
    // badge só existe se item.badge_label está preenchido
    expect(screen.queryByText(/NOVIDADE/i)).not.toBeInTheDocument();
  });

  it("renderiza badge quando badge_label existe", () => {
    render(
      <LoginMural
        item={{ ...base, badge_label: "Novidade", badge_color: "sprout" }}
      />,
    );
    expect(screen.getByText("Novidade")).toBeInTheDocument();
  });

  it("renderiza CTA em modo não-compact", () => {
    render(
      <LoginMural
        item={{ ...base, cta_label: "Ver detalhes", cta_url: "/central" }}
      />,
    );
    const link = screen.getByText("Ver detalhes");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")?.getAttribute("href")).toBe("/central");
  });

  it("NÃO renderiza CTA em modo compact (mobile)", () => {
    render(
      <LoginMural
        item={{ ...base, cta_label: "Ver detalhes", cta_url: "/central" }}
        compact
      />,
    );
    expect(screen.queryByText("Ver detalhes")).not.toBeInTheDocument();
  });
});
