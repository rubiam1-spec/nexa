// Troca de categoria (tipo) em um toque (Onda 1). Tocar no chip de tipo do card
// abre esta folha; escolher um tipo aplica via callback (switchKind no pai, que
// preserva valores compatíveis). Sem etapa 1 do modal, sem regra aqui.
import { BottomSheet, TypeChipGrid } from "./mobileKit";
import type { ActivityKind } from "../../../infra/repositories/activityKindsRepository";

type GroupedKinds = {
  comercial: ActivityKind[];
  interno: ActivityKind[];
  operacional: ActivityKind[];
};

export default function TypeSheet({
  open,
  onClose,
  kinds,
  selectedKey,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  kinds: GroupedKinds;
  selectedKey?: string | null;
  onPick: (k: ActivityKind) => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Mudar tipo">
      <TypeChipGrid
        kinds={kinds}
        selectedKey={selectedKey}
        onPick={(k) => { onPick(k); onClose(); }}
      />
    </BottomSheet>
  );
}
