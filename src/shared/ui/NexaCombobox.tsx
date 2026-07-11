// NexaCombobox — DS v4, camada de LISTAS LONGAS SIMPLES (8+ homogêneas). Busca
// com foco automático + realce + teclado (motor cmdk) + fuzzy (match-sorter).
// SEM filtros, SEM recentes.
import { NexaSelect, type NexaSelectProps } from "./NexaSelect";

export type NexaComboboxProps = Omit<NexaSelectProps, "searchable" | "recentKey">;

export function NexaCombobox(props: NexaComboboxProps) {
  return <NexaSelect {...props} searchable />;
}

export default NexaCombobox;
