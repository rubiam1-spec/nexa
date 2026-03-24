import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useDevelopment } from "../../../app/contexts/DevelopmentContext";
import { useUnits } from "../../units/hooks/useUnits";

const parcelasOptions = [12, 24, 36, 48, 60];

function calcPrice(principal: number, rateMonthly: number, months: number) {
  if (principal <= 0 || months <= 0) return 0;
  if (rateMonthly <= 0) return principal / months;
  const factor = Math.pow(1 + rateMonthly, months);
  return principal * (rateMonthly * factor) / (factor - 1);
}

export default function SimuladorPage() {
  const navigate = useNavigate();
  const { account } = useAccount();
  const { development } = useDevelopment();
  const useMock = false;
  const { units, isLoading } = useUnits(
    account?.accountId ?? null,
    development?.developmentId ?? null,
    useMock,
  );

  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [entradaPct, setEntradaPct] = useState(true);
  const [entradaValue, setEntradaValue] = useState("20");
  const [parcelas, setParcelas] = useState(36);
  const [taxa, setTaxa] = useState("0");

  const selectedUnit = units.find((u) => u.id === selectedUnitId) ?? null;
  const valorUnidade = selectedUnit?.valor ?? 0;

  const result = useMemo(() => {
    const entradaNum = Number(entradaValue) || 0;
    const entradaReais = entradaPct
      ? (valorUnidade * entradaNum) / 100
      : entradaNum;
    const financiado = Math.max(valorUnidade - entradaReais, 0);
    const taxaNum = (Number(taxa) || 0) / 100;
    const parcela = calcPrice(financiado, taxaNum, parcelas);
    const total = entradaReais + parcela * parcelas;

    return {
      entrada: entradaReais,
      financiado,
      parcela,
      total,
    };
  }, [valorUnidade, entradaValue, entradaPct, parcelas, taxa]);

  function fmt(v: number) {
    return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function handleUseInNegotiation() {
    if (!selectedUnitId) return;
    navigate(`/negociacoes?unitId=${selectedUnitId}`);
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-bone)", margin: 0 }}>
          Simulador comercial
        </h1>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-fog)", marginTop: 4 }}>
          {development?.developmentName ?? "—"} · {units.length} unidades
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        {/* Input card */}
        <div className="nexa-card">
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-sprout)", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600, marginBottom: 16 }}>
            Parâmetros da simulação
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            <label>
              <span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Unidade</span>
              <select autoFocus value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value)}>
                <option value="">{isLoading ? "Carregando..." : "Selecione uma unidade"}</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    Quadra {u.quadra} - Lote {u.lote} — R$ {u.valor.toLocaleString("pt-BR")}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Valor da unidade</span>
              <input
                type="text"
                readOnly
                value={valorUnidade > 0 ? `R$ ${fmt(valorUnidade)}` : "—"}
                style={{ color: "var(--color-bone)", fontWeight: 600 }}
              />
            </label>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span className="nexa-label">Entrada</span>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (entradaPct && valorUnidade > 0) {
                        const pctVal = Number(entradaValue) || 0;
                        setEntradaValue(Math.round(valorUnidade * pctVal / 100).toString());
                      }
                      setEntradaPct(false);
                    }}
                    style={{
                      background: !entradaPct ? "var(--color-sprout-muted)" : "transparent",
                      color: !entradaPct ? "var(--color-sprout)" : "var(--color-fog)",
                      border: "1px solid var(--color-stone)", borderRadius: 4,
                      padding: "2px 8px", fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)",
                    }}
                  >
                    R$
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!entradaPct && valorUnidade > 0) {
                        const reaisVal = Number(entradaValue) || 0;
                        setEntradaValue(Math.round(reaisVal / valorUnidade * 100).toString());
                      }
                      setEntradaPct(true);
                    }}
                    style={{
                      background: entradaPct ? "var(--color-sprout-muted)" : "transparent",
                      color: entradaPct ? "var(--color-sprout)" : "var(--color-fog)",
                      border: "1px solid var(--color-stone)", borderRadius: 4,
                      padding: "2px 8px", fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)",
                    }}
                  >
                    %
                  </button>
                </div>
              </div>
              <input
                type="number"
                value={entradaValue}
                onChange={(e) => setEntradaValue(e.target.value)}
                min="0"
                step={entradaPct ? "1" : "1000"}
                placeholder={entradaPct ? "20" : "70000"}
              />
            </div>

            <label>
              <span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Parcelas</span>
              <select value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))}>
                {parcelasOptions.map((p) => (
                  <option key={p} value={p}>{p}x</option>
                ))}
              </select>
            </label>

            <label>
              <span className="nexa-label" style={{ display: "block", marginBottom: 6 }}>Taxa de juros mensal (%)</span>
              <input
                type="number"
                value={taxa}
                onChange={(e) => setTaxa(e.target.value)}
                min="0"
                step="0.01"
                placeholder="0"
              />
            </label>
          </div>
        </div>

        {/* Result card */}
        <div className="nexa-card">
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-sprout)", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600, marginBottom: 24 }}>
            Resultado da simulação
          </div>

          {valorUnidade <= 0 ? (
            <p style={{ color: "var(--color-fog)", fontSize: 13 }}>Selecione uma unidade para simular.</p>
          ) : (
            <>
              <div style={{ display: "grid", gap: 20 }}>
                {/* Parcela — highlight */}
                <div style={{ background: "var(--color-sprout-glow)", border: "1px solid var(--color-sprout-muted)", borderRadius: 12, padding: "20px 24px", textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-sprout)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>
                    Valor da parcela
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: "var(--color-sprout)" }}>
                    R$ {fmt(result.parcela)}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-fog)", marginTop: 4 }}>
                    {parcelas}x {Number(taxa) > 0 ? `· ${taxa}% a.m.` : "· sem juros"}
                  </div>
                </div>

                {/* Details */}
                <div style={{ display: "grid", gap: 12 }}>
                  <ResultRow label="Valor da unidade" value={`R$ ${fmt(valorUnidade)}`} />
                  <ResultRow label="Entrada" value={`R$ ${fmt(result.entrada)}`} sub={entradaPct ? `${entradaValue}%` : undefined} />
                  <ResultRow label="Valor financiado" value={`R$ ${fmt(result.financiado)}`} />
                  <ResultRow label="Total a pagar" value={`R$ ${fmt(result.total)}`} highlight />
                </div>
              </div>

              <button
                type="button"
                onClick={handleUseInNegotiation}
                disabled={!selectedUnitId}
                style={{
                  background: "var(--color-sprout)", color: "var(--color-ink)", border: "none",
                  borderRadius: 8, padding: "0 20px", height: 40, fontSize: 14, fontWeight: 700,
                  width: "100%", marginTop: 24,
                }}
              >
                Usar nesta negociação
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultRow({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "8px 0", borderBottom: "1px solid var(--color-stone)" }}>
      <span className="nexa-label">{label}</span>
      <div style={{ textAlign: "right" }}>
        <span style={{ fontSize: 15, fontWeight: highlight ? 700 : 600, color: highlight ? "var(--color-bone)" : "var(--color-dust)" }}>{value}</span>
        {sub ? <span style={{ fontSize: 11, color: "var(--color-fog)", marginLeft: 6 }}>{sub}</span> : null}
      </div>
    </div>
  );
}
