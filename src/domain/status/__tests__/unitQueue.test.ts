import { describe, it, expect } from "vitest";
import {
  UnitQueueStatus,
  UnitQueueDbStatus,
  UnitQueueStatusFromDb,
  toUnitQueueDb,
} from "../unitQueue";

describe("unit_queue — vocabulário canônico (Fase 3 — Etapa 5)", () => {
  it("escrita canônica em lowercase", () => {
    expect(toUnitQueueDb(UnitQueueStatus.WAITING)).toBe("waiting");
    expect(toUnitQueueDb(UnitQueueStatus.PROMOTED)).toBe("promoted");
    expect(toUnitQueueDb(UnitQueueStatus.REMOVED)).toBe("removed");
    expect(UnitQueueDbStatus[UnitQueueStatus.WAITING]).toBe("waiting");
  });

  it("leitura ESTRITA: só lowercase canônico é reconhecido (UPPER legado não)", () => {
    expect(UnitQueueStatusFromDb["waiting"]).toBe(UnitQueueStatus.WAITING);
    expect(UnitQueueStatusFromDb["promoted"]).toBe(UnitQueueStatus.PROMOTED);
    // Tolerância removida: valores UPPER não são mais reconhecidos.
    expect(UnitQueueStatusFromDb["WAITING"]).toBeUndefined();
    expect(UnitQueueStatusFromDb["PROMOTED"]).toBeUndefined();
  });
});
