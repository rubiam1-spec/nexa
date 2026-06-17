// Detecção de permuta em status/observação/cliente.
// Permuta entra como está (WON marcado), FORA do VGV monetário.
import { stripAccents } from "./text";

export function detectPermuta(...fields: Array<string | null | undefined>): boolean {
  const blob = stripAccents(fields.filter(Boolean).join(" ").toLowerCase());
  return blob.includes("permut") || blob.includes("%");
}
