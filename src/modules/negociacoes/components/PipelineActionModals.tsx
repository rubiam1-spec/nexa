import { useState } from "react";
import { createPortal } from "react-dom";
import type { KanbanCard } from "../hooks/useKanbanData";

const fm = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function Wrap({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const mobile = typeof window !== "undefined" && window.innerWidth < 768;
  return createPortal(<><div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9998, opacity: open ? 1 : 0, pointerEvents: open ? "all" : "none", transition: "opacity 0.2s" }} /><div style={mobile ? { position: "fixed", inset: 0, zIndex: 9999, opacity: open ? 1 : 0, pointerEvents: open ? "all" : "none", transition: "opacity 0.2s", overflowY: "auto", WebkitOverflowScrolling: "touch" } : { position: "fixed", top: "50%", left: "50%", transform: open ? "translate(-50%,-50%)" : "translate(-50%,-48%)", zIndex: 9999, width: 480, maxWidth: "95vw", opacity: open ? 1 : 0, pointerEvents: open ? "all" : "none", transition: "all 0.2s" }}>{children}</div></>, document.body);
}
function Card({ children }: { children: React.ReactNode }) { const mobile = typeof window !== "undefined" && window.innerWidth < 768; return <div style={{ background: "var(--surface-raised)", border: mobile ? "none" : "1px solid var(--border-default)", borderRadius: mobile ? 0 : 16, overflow: "hidden", boxShadow: mobile ? "none" : "0 24px 64px rgba(0,0,0,0.5)", minHeight: mobile ? "100vh" : "auto", display: mobile ? "flex" : "block", flexDirection: "column" }}>{children}</div>; }
function Head({ title, sub, onClose }: { title: string; sub?: string; onClose: () => void }) { return <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border-default)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div><div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-secondary)" }}>{title}</div>{sub ? <div style={{ fontSize: 12, color: "var(--text-disabled)", marginTop: 3, fontFamily: "var(--font-mono)" }}>{sub}</div> : null}</div><button type="button" onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-disabled)", cursor: "pointer", fontSize: 20, padding: "0 4px", lineHeight: 1 }}>x</button></div>; }
function Info({ card }: { card: KanbanCard }) { return <div style={{ margin: "0 24px 16px", background: "var(--surface-base)", borderRadius: 10, padding: "12px 14px", border: "1px solid var(--border-default)" }}><div style={{ fontSize: 10, color: "var(--text-disabled)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginBottom: 4 }}>NEGOCIAÇÃO</div><div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-secondary)" }}>{card.clienteNome || "Cliente"}</div><div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, fontFamily: "var(--font-mono)" }}>Q{card.quadra} · L{card.lote} · {fm(card.valor ?? 0)}</div></div>; }
function Foot({ onClose, onConfirm, label, cor, loading }: { onClose: () => void; onConfirm: () => void; label: string; cor: string; loading: boolean }) { return <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-default)", display: "flex", gap: 10 }}><button type="button" onClick={onClose} disabled={loading} style={{ flex: 1, padding: "11px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>Cancelar</button><button type="button" onClick={onConfirm} disabled={loading} style={{ flex: 2, padding: "11px", borderRadius: 8, border: "none", background: cor, color: "var(--interactive-on-primary)", fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>{loading ? "Processando..." : label}</button></div>; }

// ── Criar Proposta ──
export function CriarPropostaModal({ open, card, onClose, onConfirm }: { open: boolean; card: KanbanCard | null; onClose: () => void; onConfirm: (d: { entradaPct: number; parcelas: number }) => Promise<void> }) {
  const [entPct, setEntPct] = useState(20);
  const [parc, setParc] = useState(36);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  if (!card) return null;
  const valor = card.valor ?? 0, ent = Math.round(valor * entPct / 100), saldo = valor - ent, parcV = parc > 0 ? Math.round(saldo / parc) : 0;
  const go = async () => { setErro(""); setLoading(true); try { await onConfirm({ entradaPct: entPct, parcelas: parc }); onClose(); } catch (e: unknown) { setErro(e instanceof Error ? e.message : "Erro"); } finally { setLoading(false); } };
  return <Wrap open={open} onClose={onClose}><Card><Head title="Criar Proposta" sub="Formalizar condição comercial" onClose={onClose} /><div style={{ padding: "0 0 4px" }}><Info card={card} /><div style={{ padding: "0 24px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
    <div><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 13, color: "var(--text-muted)" }}>Entrada</span><span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{entPct}% — {fm(ent)}</span></div><input type="range" min={10} max={80} value={entPct} onChange={(e) => setEntPct(Number(e.target.value))} style={{ width: "100%", accentColor: "#4ADE80" }} /></div>
    <div><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 13, color: "var(--text-muted)" }}>Parcelas</span><span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>{parc}x de {fm(parcV)}</span></div><input type="range" min={12} max={120} value={parc} onChange={(e) => setParc(Number(e.target.value))} style={{ width: "100%", accentColor: "#4ADE80" }} /></div>
    <div style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 10, padding: "12px 16px" }}><div style={{ fontSize: 10, color: "#4ADE80", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginBottom: 4 }}>PARCELA MENSAL</div><div style={{ fontSize: 28, fontWeight: 800, color: "#4ADE80", fontFamily: "var(--font-mono)" }}>{fm(parcV)}</div></div>
    {erro ? <div style={{ fontSize: 12, color: "#F87171", background: "rgba(248,113,113,0.08)", borderRadius: 8, padding: "8px 12px" }}>{erro}</div> : null}
  </div></div><Foot onClose={onClose} onConfirm={() => void go()} label="Criar proposta" cor="#FBBF24" loading={loading} /></Card></Wrap>;
}

// ── Solicitar Reserva ──
export function SolicitarReservaModal({ open, card, onClose, onConfirm }: { open: boolean; card: KanbanCard | null; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  if (!card) return null;
  const go = async () => { setErro(""); setLoading(true); try { await onConfirm(); onClose(); } catch (e: unknown) { setErro(e instanceof Error ? e.message : "Erro"); } finally { setLoading(false); } };
  return <Wrap open={open} onClose={onClose}><Card><Head title="Solicitar Reserva" sub="Bloquear unidade temporariamente" onClose={onClose} /><div style={{ padding: "4px 0" }}><Info card={card} /><div style={{ padding: "0 24px 16px" }}><div style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 10, padding: "14px 16px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>A solicitação será enviada para aprovação do gestor. Após aprovada, a unidade ficará bloqueada.</div>{erro ? <div style={{ fontSize: 12, color: "#F87171", marginTop: 12 }}>{erro}</div> : null}</div></div><Foot onClose={onClose} onConfirm={() => void go()} label="Solicitar reserva" cor="#A78BFA" loading={loading} /></Card></Wrap>;
}

// ── Aprovar Reserva ──
export function AprovarReservaModal({ open, card, onClose, onConfirm }: { open: boolean; card: KanbanCard | null; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  if (!card) return null;
  const go = async () => { setErro(""); setLoading(true); try { await onConfirm(); onClose(); } catch (e: unknown) { setErro(e instanceof Error ? e.message : "Erro"); } finally { setLoading(false); } };
  return <Wrap open={open} onClose={onClose}><Card><Head title="Aprovar Reserva" sub="Bloquear unidade para este cliente" onClose={onClose} /><div style={{ padding: "4px 0" }}><Info card={card} /><div style={{ padding: "0 24px 16px" }}><div style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 10, padding: "14px 16px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>Ao aprovar, a unidade será bloqueada e o prazo de reserva começa a contar.</div>{erro ? <div style={{ fontSize: 12, color: "#F87171", marginTop: 12 }}>{erro}</div> : null}</div></div><Foot onClose={onClose} onConfirm={() => void go()} label="Aprovar e reservar" cor="#A78BFA" loading={loading} /></Card></Wrap>;
}

// ── Registrar Venda ──
export function RegistrarVendaModal({ open, card, onClose, onConfirm }: { open: boolean; card: KanbanCard | null; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  if (!card) return null;
  const go = async () => { setErro(""); setLoading(true); try { await onConfirm(); onClose(); } catch (e: unknown) { setErro(e instanceof Error ? e.message : "Erro"); } finally { setLoading(false); } };
  return <Wrap open={open} onClose={onClose}><Card><Head title="Registrar Venda" sub="Confirmar fechamento comercial" onClose={onClose} /><div style={{ padding: "4px 0" }}><Info card={card} /><div style={{ padding: "0 24px 16px" }}><div style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}><div style={{ fontSize: 12, color: "#4ADE80", fontFamily: "var(--font-mono)", marginBottom: 6 }}>VALOR DA VENDA</div><div style={{ fontSize: 24, fontWeight: 800, color: "#4ADE80", fontFamily: "var(--font-mono)" }}>{fm(card.valor ?? 0)}</div></div><div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>A unidade será marcada como vendida e removida do estoque.</div>{erro ? <div style={{ fontSize: 12, color: "#F87171", marginTop: 12 }}>{erro}</div> : null}</div></div><Foot onClose={onClose} onConfirm={() => void go()} label="Confirmar venda" cor="#4ADE80" loading={loading} /></Card></Wrap>;
}
