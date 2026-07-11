import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// Invariantes de FONTE do único produtor de notificações de cadência
// (useCadenceAlerts.ts): garante que a correção do cap. A não regrida.
const SRC = readFileSync("src/shared/hooks/useCadenceAlerts.ts", "utf8");

describe("useCadenceAlerts — invariantes do cap. A", () => {
  it("negotiation_stale usa DIGEST + supressão (não mais lote individual)", () => {
    expect(SRC).toMatch(/buildStaleDigest/);
    expect(SRC).toMatch(/shouldSuppressStale/);
  });

  it("some o padrão bugado de parênteses vazios `(${... ? ... : \"\"})`", () => {
    // O template antigo interpolava unidade opcional entre parênteses, gerando "()".
    expect(SRC).not.toMatch(/\(\$\{un \? /);
    expect(SRC).not.toMatch(/: ""\}\)/);
  });

  it("mensagens de cliente/unidade passam por notificationSubject", () => {
    expect(SRC).toMatch(/notificationSubject/);
  });

  it("URGENTES INTACTOS: reservation_expiring e activity_reminder seguem individuais e imediatos", () => {
    expect(SRC).toMatch(/type: "reservation_expiring"/);
    expect(SRC).toMatch(/type: "activity_reminder"/);
    // digest/supressão são exclusivos do stale — não envolvem os urgentes
    const staleIdx = SRC.indexOf("buildStaleDigest");
    const resIdx = SRC.indexOf('type: "reservation_expiring"');
    expect(staleIdx).toBeGreaterThan(-1);
    expect(resIdx).toBeGreaterThan(-1);
    expect(resIdx).toBeGreaterThan(staleIdx); // reservas ficam depois do bloco stale, sem digest
  });
});
