// Hook da verdade única de vendas (E3). Consome o repositório (sales ∪ WON) e
// expõe itens, totais, série mensal e labels — a MESMA fonte para Central,
// Funil e Individual. refetch invalida após registrar venda pela Ficha.
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSalesTruth, type SalesTruthLabels } from "../../infra/repositories/salesTruthSupabaseRepository";
import { salesTruthTotals, salesTruthMonthly, type SaleTruthItem, type SaleTruthSaleRow } from "../../domain/venda/salesTruth";

const EMPTY_LABELS: SalesTruthLabels = { clientName: {}, unitLabel: {} };

export function useSalesTruth(accountId: string | null, developmentId: string | null) {
  const [items, setItems] = useState<SaleTruthItem[]>([]);
  const [saleRows, setSaleRows] = useState<SaleTruthSaleRow[]>([]);
  const [labels, setLabels] = useState<SalesTruthLabels>(EMPTY_LABELS);
  const [isLoading, setIsLoading] = useState(false);
  const [nonce, setNonce] = useState(0);
  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!accountId) { setItems([]); setSaleRows([]); setLabels(EMPTY_LABELS); return; }
    let alive = true;
    setIsLoading(true);
    getSalesTruth(accountId, developmentId)
      .then((r) => { if (alive) { setItems(r.items); setSaleRows(r.saleRows); setLabels(r.labels); } })
      .catch(() => { if (alive) { setItems([]); setSaleRows([]); setLabels(EMPTY_LABELS); } })
      .finally(() => { if (alive) setIsLoading(false); });
    return () => { alive = false; };
  }, [accountId, developmentId, nonce]);

  const totals = useMemo(() => salesTruthTotals(items), [items]);
  const monthly = useMemo(() => salesTruthMonthly(items, Date.now(), 12), [items]);

  return { items, saleRows, labels, totals, monthly, isLoading, refetch };
}
