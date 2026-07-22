// Modo FOCO do espelho — helpers PUROS. `focusIds` = null quando não há foco;
// caso contrário, o Set das unidades afetadas por um issue (drill-down).
export function isDimmedInFocus(unitId: string, focusIds: Set<string> | null): boolean {
  return focusIds != null && !focusIds.has(unitId);
}

export function isFocusActive(focusIds: Set<string> | null): boolean {
  return focusIds != null;
}

// Rótulo do banner de foco: "Mostrando N unidades: <issue>".
export function focusBannerLabel(count: number, issueLabel: string): string {
  return `Mostrando ${count} ${count === 1 ? "unidade" : "unidades"}: ${issueLabel}`;
}
