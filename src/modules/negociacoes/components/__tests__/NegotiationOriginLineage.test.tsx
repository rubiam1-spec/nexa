import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import NegotiationOriginLineage from "../NegotiationOriginLineage";

describe("<NegotiationOriginLineage /> — linhagem do lead na negociação", () => {
  it("mostra canal (rótulo humano), campanha e data de conversão", () => {
    render(
      <NegotiationOriginLineage
        origin="landing_page"
        originDetail={null}
        utmCampaign="lancamento-q3"
        convertedAt="2026-04-24T12:32:13.000Z"
      />,
    );
    expect(screen.getByText("Origem")).toBeInTheDocument();
    expect(screen.getByText("Landing Page")).toBeInTheDocument(); // origin traduzido, não o valor cru
    expect(screen.getByText("lancamento-q3")).toBeInTheDocument();
    expect(screen.getByText("Convertido em")).toBeInTheDocument();
  });

  it("origem desconhecida cai no valor cru (não inventa rótulo)", () => {
    render(<NegotiationOriginLineage origin="tiktok_ads" utmCampaign={null} convertedAt={null} />);
    expect(screen.getByText("tiktok_ads")).toBeInTheDocument();
  });

  it("sem nenhum dado de origem/conversão → não renderiza (não polui a ficha)", () => {
    const { container } = render(
      <NegotiationOriginLineage origin={null} utmCampaign={null} convertedAt={null} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
