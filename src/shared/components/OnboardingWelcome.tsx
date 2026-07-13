import { useState, useEffect } from "react";
import { NexaModal } from "../ui/NexaModal";

const STORAGE_KEY = "nexa_onboarding_done";

export function useOnboarding() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setShow(true);
  }, []);
  const dismiss = () => { localStorage.setItem(STORAGE_KEY, "1"); setShow(false); };
  return { show, dismiss };
}

const steps = [
  { icone: "\uD83C\uDFE0", titulo: "Empreendimentos", desc: "Cadastre seus empreendimentos e unidades para começar a vender." },
  { icone: "\uD83D\uDCCA", titulo: "Pipeline Comercial", desc: "Acompanhe negociações, propostas, reservas e vendas em tempo real." },
  { icone: "\uD83D\uDCB0", titulo: "Simulador", desc: "Simule condições de pagamento e envie propostas profissionais." },
];

export function OnboardingWelcome({ open, onDismiss }: { open: boolean; onDismiss: () => void }) {
  const [step, setStep] = useState(0);
  if (!open) return null;

  const s = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <NexaModal onClose={onDismiss} zIndex={10001} ariaLabel="Bem-vindo ao NEXA">
      <div style={{ width: 420, maxWidth: "92vw", background: "var(--surface-raised)", border: "1px solid var(--border-default)", borderRadius: 20, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.5)", animation: "celebrationSlideIn 0.4s cubic-bezier(0.32,0.72,0,1)" }}>
        {/* Progress dots */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", padding: "20px 0 0" }}>
          {steps.map((_, i) => (
            <div key={i} style={{ width: i === step ? 20 : 6, height: 6, borderRadius: 3, background: i === step ? "var(--interactive-primary)" : "var(--surface-hover)", transition: "all 0.3s" }} />
          ))}
        </div>

        <div style={{ padding: "32px 32px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{s.icone}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 }}>{s.titulo}</div>
          <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, maxWidth: 320, margin: "0 auto" }}>{s.desc}</div>
        </div>

        <div style={{ padding: "0 32px 24px", display: "flex", gap: 10 }}>
          {step > 0 ? (
            <button type="button" onClick={() => setStep(step - 1)} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>Voltar</button>
          ) : (
            <button type="button" onClick={onDismiss} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>Pular</button>
          )}
          <button type="button" onClick={() => isLast ? onDismiss() : setStep(step + 1)} style={{ flex: 2, padding: 12, borderRadius: 10, border: "none", background: "var(--interactive-primary)", color: "var(--interactive-on-primary)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {isLast ? "Começar" : "Próximo"}
          </button>
        </div>
      </div>
    </NexaModal>
  );
}
