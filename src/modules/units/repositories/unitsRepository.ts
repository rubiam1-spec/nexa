import type { Unidade } from "../../../domain/unidade/Unidade";
import { unitsMock } from "../mocks/unitsMock";

export function getUnits(accountId: string, developmentId: string) {
  return unitsMock.filter(
    (unit) =>
      unit.accountId === accountId && unit.empreendimentoId === developmentId,
  );
}

export function updateUnitStatus(unitId: string, status: Unidade["status"]) {
  const unit = unitsMock.find((item) => item.id === unitId);

  if (!unit) {
    throw new Error("Unit not found in mock repository.");
  }

  unit.status = status;
  unit.updatedAt = new Date();

  return unit;
}
