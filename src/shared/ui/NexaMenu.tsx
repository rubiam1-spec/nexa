// NexaMenu — DS v4, camada de LISTAS CURTAS (<=7: período, ordenação, enums de
// formulário). SEM busca, SEM grupos. Sobre o motor aprovado (Radix Popover).
import { NexaSelect, type NexaSelectProps } from "./NexaSelect";

export type NexaMenuProps = Omit<NexaSelectProps, "searchable">;

export function NexaMenu(props: NexaMenuProps) {
  return <NexaSelect {...props} searchable={false} />;
}

export default NexaMenu;
