import { describe, it, expect } from "vitest";
import {
  interactionStartsService,
  isRealContactInteraction,
  LeadQualificationStatus as S,
} from "../leadQualification";

describe("interactionStartsService — interação inicia atendimento (L1.8 B3)", () => {
  it("contato real (ligação/whatsapp/visita/reunião/email) em lead NEW inicia", () => {
    for (const t of ["phone_call", "whatsapp", "visit_client", "meeting_external", "email"]) {
      expect(interactionStartsService(t, S.NEW)).toBe(true);
    }
  });

  it("nota e follow-up NÃO iniciam (não são contato real)", () => {
    expect(interactionStartsService("note", S.NEW)).toBe(false);
    expect(interactionStartsService("follow_up", S.NEW)).toBe(false);
  });

  it("só inicia quando o lead está NEW (não em IN_SERVICE/QUALIFIED/CONVERTED)", () => {
    expect(interactionStartsService("phone_call", S.IN_SERVICE)).toBe(false);
    expect(interactionStartsService("phone_call", S.QUALIFIED)).toBe(false);
    expect(interactionStartsService("phone_call", S.CONVERTED)).toBe(false);
  });

  it("isRealContactInteraction classifica corretamente", () => {
    expect(isRealContactInteraction("phone_call")).toBe(true);
    expect(isRealContactInteraction("note")).toBe(false);
    expect(isRealContactInteraction("follow_up")).toBe(false);
  });
});
