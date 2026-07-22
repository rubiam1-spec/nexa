import { useLocation } from "react-router-dom";

// Voltar preserva a ORIGEM (Lei 3). O EntityLink injeta {from, fromLabel} no
// state ao navegar; a casa de destino lê aqui. Sem origem → fallback = a casa da
// lista da entidade.
export function useReturnTo(fallback: { to: string; label: string }): { to: string; label: string } {
  const location = useLocation();
  const state = (location.state ?? null) as { from?: string; fromLabel?: string } | null;
  return {
    to: state?.from ?? fallback.to,
    label: state?.fromLabel ?? fallback.label,
  };
}
