import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { UnidadeStatus } from "../../../domain/unidade/UnidadeStatus";
import { getUnidadeStatusLabel } from "../../../domain/unidade/UnidadeStatusLabel";
import NexaBadge from "../../../shared/components/NexaBadge";
import { useNegotiations } from "../../negociacoes/hooks/useNegotiations";
import { useUnits } from "../hooks/useUnits";

const statusStyle: Record<string, { bg: string; border: string; color: string }> = {
  [UnidadeStatus.DISPONIVEL]: { bg: "var(--color-sprout-muted)", border: "var(--color-sprout)", color: "var(--color-sprout)" },
  [UnidadeStatus.EM_NEGOCIACAO]: { bg: "var(--color-blue-muted)", border: "var(--color-blue)", color: "var(--color-blue)" },
  [UnidadeStatus.RESERVADO]: { bg: "var(--color-terracotta-muted)", border: "var(--color-terracotta)", color: "var(--color-terracotta)" },
  [UnidadeStatus.VENDIDO]: { bg: "var(--color-purple-muted)", border: "var(--color-purple)", color: "var(--color-purple)" },
};

const fallbackStyle = { bg: "var(--color-stone)", border: "var(--color-fog)", color: "var(--color-fog)" };

export default function UnitsPage() {
  const navigate = useNavigate();
  const { account, isUsingMock: isUsingMockAccount } = useAccount();
  const { development, isUsingMock: isUsingMockDev } = useDevelopment();
  const useMock = isUsingMockAccount || isUsingMockDev;
  const unitsState = useUnits(account?.accountId ?? null, development?.developmentId ?? null, useMock);
  const { units, isLoading } = unitsState;
  const negotiationsState = useNegotiations(account?.accountId ?? null, development?.developmentId ?? null, useMock, account?.role ?? null, unitsState);

  const [quadraFilter, setQuadraFilter] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  const quadras = useMemo(() => {
    const set = new Set(units.map((u) => u.quadra));
    return Array.from(set).sort();
  }, [units]);

  const filteredUnits = quadraFilter ? units.filter((u) => u.quadra === quadraFilter) : units;

  const unitsByQuadra = useMemo(() => {
    const map = new Map<string, typeof units>();
    for (const u of filteredUnits) {
      const arr = map.get(u.quadra) ?? [];
      arr.push(u);
      map.set(u.quadra, arr);
    }
    return map;
  }, [filteredUnits]);

  const selectedUnit = units.find((u) => u.id === selectedUnitId) ?? null;
  const selectedNeg = selectedUnit ? negotiationsState.negotiations.find((n) => n.unitId === selectedUnit.id) ?? null : null;

  function handleCellClick(unitId: string) {
    setSelectedUnitId(unitId === selectedUnitId ? null : unitId);
  }

  function handleNavigate() {
    if (!selectedUnit) return;
    if (selectedUnit.status === UnidadeStatus.DISPONIVEL) {
      navigate(`/negociacoes?unitId=${selectedUnit.id}`);
    } else if (selectedNeg) {
      navigate(`/negociacoes/${selectedNeg.id}`);
    }
  }

  if (isLoading || negotiationsState.isLoading) {
    return <p style={{ color: "var(--color-fog)" }}>Carregando mapa de unidades...</p>;
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-bone)", margin: 0 }}>Mapa de unidades</h1>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-fog)", marginTop: 4 }}>
          {development?.developmentName} · {units.length} unidades
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        {[
          { status: UnidadeStatus.DISPONIVEL, label: "Disponível" },
          { status: UnidadeStatus.EM_NEGOCIACAO, label: "Em negociação" },
          { status: UnidadeStatus.RESERVADO, label: "Reservado" },
          { status: UnidadeStatus.VENDIDO, label: "Vendido" },
        ].map((item) => {
          const s = statusStyle[item.status] ?? fallbackStyle;
          return (
            <div key={item.status} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: s.bg, border: `1px solid ${s.border}` }} />
              <span style={{ fontSize: 12, color: "var(--color-dust)" }}>{item.label}</span>
            </div>
          );
        })}
      </div>

      {/* Quadra filter */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        <button type="button" onClick={() => setQuadraFilter(null)} style={{
          padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: quadraFilter === null ? 600 : 400,
          border: "1px solid var(--color-stone)",
          background: quadraFilter === null ? "var(--color-sprout-muted)" : "transparent",
          color: quadraFilter === null ? "var(--color-sprout)" : "var(--color-dust)",
        }}>Todas</button>
        {quadras.map((q) => (
          <button key={q} type="button" onClick={() => setQuadraFilter(q)} style={{
            padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: quadraFilter === q ? 600 : 400,
            border: "1px solid var(--color-stone)",
            background: quadraFilter === q ? "var(--color-sprout-muted)" : "transparent",
            color: quadraFilter === q ? "var(--color-sprout)" : "var(--color-dust)",
          }}>Quadra {q}</button>
        ))}
      </div>

      {/* Map + Panel */}
      <div style={{ display: "grid", gridTemplateColumns: selectedUnit ? "1fr 300px" : "1fr", gap: 16 }}>
        {/* Grid */}
        <div>
          {Array.from(unitsByQuadra.entries()).map(([quadra, qUnits]) => (
            <div key={quadra} style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-sprout)", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600, marginBottom: 10 }}>
                Quadra {quadra}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {qUnits.map((u) => {
                  const s = statusStyle[u.status] ?? fallbackStyle;
                  const isSelected = u.id === selectedUnitId;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleCellClick(u.id)}
                      style={{
                        width: 56, height: 56, borderRadius: 8,
                        background: s.bg,
                        border: isSelected ? `2px solid ${s.color}` : `1px solid ${s.border}`,
                        color: s.color,
                        fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: isSelected ? `0 0 0 3px ${s.bg}` : "none",
                        transition: "box-shadow 150ms ease",
                      }}
                    >
                      L{u.lote}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {units.length === 0 ? (
            <div className="nexa-card"><p style={{ color: "var(--color-fog)" }}>Nenhuma unidade cadastrada.</p></div>
          ) : null}
        </div>

        {/* Side panel */}
        {selectedUnit ? (
          <div className="nexa-card" style={{ padding: 20, height: "fit-content", position: "sticky", top: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "var(--color-bone)" }}>
                Q{selectedUnit.quadra} L{selectedUnit.lote}
              </span>
              <NexaBadge entity="unit" status={selectedUnit.status} label={getUnidadeStatusLabel(selectedUnit.status)} />
            </div>
            <div style={{ display: "grid", gap: 12, fontSize: 13 }}>
              <div>
                <div className="nexa-label" style={{ marginBottom: 4 }}>Valor</div>
                <div style={{ color: "var(--color-bone)", fontWeight: 600 }}>R$ {selectedUnit.valor.toLocaleString("pt-BR")}</div>
              </div>
              <div>
                <div className="nexa-label" style={{ marginBottom: 4 }}>Status</div>
                <div style={{ color: "var(--color-dust)" }}>{getUnidadeStatusLabel(selectedUnit.status)}</div>
              </div>
              {selectedNeg ? (
                <div>
                  <div className="nexa-label" style={{ marginBottom: 4 }}>Negociação vinculada</div>
                  <div style={{ color: "var(--color-dust)", fontSize: 12 }}>{selectedNeg.id.slice(0, 8)}...</div>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleNavigate}
              style={{
                width: "100%", marginTop: 20, height: 36, borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: selectedUnit.status === UnidadeStatus.DISPONIVEL ? "var(--color-sprout)" : "transparent",
                color: selectedUnit.status === UnidadeStatus.DISPONIVEL ? "var(--color-ink)" : "var(--color-bone)",
                border: selectedUnit.status === UnidadeStatus.DISPONIVEL ? "none" : "1px solid var(--color-stone)",
              }}
            >
              {selectedUnit.status === UnidadeStatus.DISPONIVEL ? "Iniciar negociação" : "Ver negociação"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
