// NEXA — Engrenagem de Partes v1 — Fase 3
// Modal compartilhado para vincular cônjuge: ou busca cliente existente
// ou cadastra um novo mínimo (nome + CPF) herdando marital_status e
// regime_casamento do cliente principal.
//
// Padrão visual: NexaModal (portal p/ body, overlay escuro com dismiss, Esc,
// scroll lock, card centralizado, mobile full-screen). Todos os hooks chamados
// ANTES de qualquer early return (Rules of Hooks — lição do fix React #310).

import { useCallback, useEffect, useMemo, useState } from "react";
import { NexaModal } from "../../../shared/ui/NexaModal";
import { useAccount } from "../../../app/contexts/AccountContext";
import { useAuth } from "../../../app/contexts/AuthContext";
import { useIsMobile } from "../../../shared/hooks/useIsMobile";
import { useSpouseLink } from "../hooks/useSpouseLink";
import {
  createClient,
  searchSpouseCandidates,
} from "../../../infra/repositories/clientsSupabaseRepository";
import type { LegalRegime } from "../../../shared/types/client";
import { maskCPF } from "../../../shared/utils/masks";

export interface SpouseLinkModalProps {
  open: boolean;
  /** Cliente principal (o que está "casando"). */
  clientId: string;
  clientName: string;
  /** Regime herdado. Se ausente, o novo cônjuge fica com regime null e o
   *  usuário pode completar depois no perfil dele. */
  clientRegimeCasamento?: LegalRegime | null;
  onClose: () => void;
  onLinked?: (spouseClientId: string) => void;
}

type Tab = "search" | "create";

type Candidate = {
  id: string;
  name: string;
  fullName: string | null;
  cpf: string | null;
};

function formatCpfPartial(cpf: string | null): string {
  if (!cpf) return "CPF —";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length < 3) return "CPF —";
  if (digits.length >= 11) return `CPF ***.***.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  return `CPF ${digits.slice(0, 3)}.***.***-**`;
}

export default function SpouseLinkModal({
  open,
  clientId,
  clientName,
  clientRegimeCasamento,
  onClose,
  onLinked,
}: SpouseLinkModalProps) {
  // Hooks — SEMPRE antes de qualquer early return.
  const { account } = useAccount();
  const { authenticatedProfile } = useAuth();
  const mobile = useIsMobile();
  const accountId = account?.accountId ?? null;
  const createdBy = authenticatedProfile?.id ?? undefined;
  const { linkSpouses, isMutating: linking, errorMessage: linkError } = useSpouseLink();

  const [tab, setTab] = useState<Tab>("search");
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);

  // Form "Cadastrar novo"
  const [newName, setNewName] = useState("");
  const [newCpf, setNewCpf] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  // Memoriza o ID do cliente recém-criado para que o retry do "Cadastrar e
  // vincular" não chame createClient novamente (evita duplicação de cônjuge).
  const [createdSpouseId, setCreatedSpouseId] = useState<string | null>(null);

  const showError = createErr || linkError || searchErr;

  // Busca com debounce simples (300ms). Resetada quando modal fecha.
  useEffect(() => {
    if (!open || tab !== "search") return;
    const trimmed = search.trim();
    if (trimmed.length < 2 || !accountId) {
      setCandidates([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      setSearching(true);
      setSearchErr(null);
      try {
        const results = await searchSpouseCandidates(accountId, clientId, trimmed);
        setCandidates(results);
      } catch (e) {
        setSearchErr(e instanceof Error ? e.message : "Falha ao buscar.");
        setCandidates([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [open, tab, search, accountId, clientId]);

  // Reset total ao fechar o modal.
  useEffect(() => {
    if (!open) {
      setTab("search");
      setSearch("");
      setCandidates([]);
      setSearchErr(null);
      setNewName("");
      setNewCpf("");
      setNewEmail("");
      setNewPhone("");
      setCreateErr(null);
      setCreatedSpouseId(null);
    }
  }, [open]);

  const handleLinkExisting = useCallback(
    async (candidateId: string) => {
      const ok = await linkSpouses(clientId, candidateId);
      if (ok) {
        onLinked?.(candidateId);
        onClose();
      }
    },
    [clientId, linkSpouses, onLinked, onClose],
  );

  const cpfDigits = useMemo(() => newCpf.replace(/\D/g, ""), [newCpf]);
  const canCreate = newName.trim().length >= 3 && cpfDigits.length === 11 && !creating && !linking;

  const handleCreateAndLink = useCallback(async () => {
    if (!accountId || creating || linking) return;
    if (!canCreate && !createdSpouseId) return;
    setCreating(true);
    setCreateErr(null);
    try {
      // Etapa 1 — criar cliente, idempotente. Se já criamos numa tentativa
      // anterior dentro deste mesmo ciclo, reutiliza o ID em vez de criar
      // um novo (evita duplicação quando linkSpouses falha e usuário clica
      // novamente no botão).
      let spouseId = createdSpouseId;
      if (!spouseId) {
        const created = await createClient({
          accountId,
          name: newName.trim(),
          cpf: cpfDigits || undefined,
          email: newEmail.trim() || undefined,
          phone: newPhone.trim() || undefined,
          maritalStatus: "casado",
          regimeCasamento: clientRegimeCasamento ?? undefined,
          origin: "conjuge_cadastrado",
          createdBy,
        });
        if (!created?.id) {
          setCreateErr("Não foi possível cadastrar o cônjuge.");
          return;
        }
        spouseId = created.id;
        setCreatedSpouseId(spouseId);
      }

      // Etapa 2 — vincular. useSpouseLink captura erro do repositório em
      // errorMessage (exposto como linkError), retorna false.
      const linked = await linkSpouses(clientId, spouseId);
      if (linked) {
        onLinked?.(spouseId);
        setCreatedSpouseId(null);
        onClose();
        return;
      }

      // Falha no vínculo — expor o motivo real (do repo via useSpouseLink)
      // concatenado com orientação: cônjuge já está salvo, não clicar
      // repetidamente (protegido pelo guard acima) e pode ser vinculado
      // depois pelo perfil do cliente principal.
      const realReason = linkError
        ?? "Verifique se o cliente principal está marcado como casado/união estável.";
      setCreateErr(
        `${realReason} O cônjuge JÁ foi cadastrado e está disponível em Contatos.`,
      );
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : "Falha ao cadastrar cônjuge.");
    } finally {
      setCreating(false);
    }
  }, [
    accountId,
    creating,
    linking,
    canCreate,
    createdSpouseId,
    cpfDigits,
    newName,
    newEmail,
    newPhone,
    clientRegimeCasamento,
    createdBy,
    clientId,
    linkSpouses,
    linkError,
    onLinked,
    onClose,
  ]);

  if (!open) return null;

  return (
    <NexaModal onClose={onClose} ariaLabel={`Cadastrar cônjuge de ${clientName}`}>
      <div
        style={
          mobile
            ? {
                position: "fixed",
                inset: 0,
                background: "var(--surface-raised)",
                display: "flex",
                flexDirection: "column",
              }
            : {
                width: 520,
                maxWidth: "95vw",
                background: "var(--surface-raised)",
                border: "1px solid var(--border-default)",
                borderRadius: 16,
                boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                maxHeight: "90vh",
              }
        }
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border-default)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-secondary)" }}>
                Cadastre o cônjuge de {clientName}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-disabled)", marginTop: 3, fontFamily: "var(--font-mono)" }}>
                Vincule um cliente existente ou cadastre um novo
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{ background: "none", border: "none", color: "var(--text-disabled)", cursor: "pointer", fontSize: 20, padding: "4px 8px", lineHeight: 1 }}
              aria-label="Fechar"
            >
              ×
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border-default)", padding: "0 24px" }}>
          {([
            ["search", "Buscar cliente existente"],
            ["create", "Cadastrar novo"],
          ] as const).map(([k, l]) => {
            const active = tab === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: active ? "var(--color-sprout)" : "var(--text-disabled)",
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "14px 16px",
                  cursor: "pointer",
                  borderBottom: active ? "2px solid var(--color-sprout)" : "2px solid transparent",
                  marginBottom: -1,
                }}
              >
                {l}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div style={{ padding: 24, flex: 1, overflowY: "auto" }}>
          {tab === "search" ? (
            <>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Digite nome ou CPF (mín. 2 caracteres)..."
                autoFocus
                style={{
                  width: "100%",
                  background: "var(--surface-base)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 8,
                  padding: "12px 14px",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ fontSize: 11, color: "var(--text-disabled)", marginTop: 8, fontFamily: "var(--font-mono)" }}>
                Excluímos clientes já casados com outra pessoa.
              </div>

              <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
                {searching ? (
                  <div style={{ color: "var(--color-fog)", fontSize: 13, fontStyle: "italic" }}>Buscando...</div>
                ) : candidates.length === 0 && search.trim().length >= 2 ? (
                  <div style={{ color: "var(--color-fog)", fontSize: 13, fontStyle: "italic" }}>
                    Ninguém encontrado. Tente a aba "Cadastrar novo".
                  </div>
                ) : (
                  candidates.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      disabled={linking}
                      onClick={() => void handleLinkExisting(c.id)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        background: "var(--surface-base)",
                        border: "1px solid var(--border-default)",
                        borderRadius: 8,
                        padding: "12px 14px",
                        cursor: linking ? "not-allowed" : "pointer",
                        opacity: linking ? 0.55 : 1,
                        transition: "border-color 150ms ease, background 150ms ease",
                      }}
                      onMouseEnter={(e) => { if (!linking) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-sprout)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-default)"; }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                        {c.fullName || c.name}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-disabled)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
                        {formatCpfPartial(c.cpf)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, color: "var(--text-disabled)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em", marginBottom: 16 }}>
                Só nome e CPF são obrigatórios. Complete os outros dados depois no perfil do cliente.
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                <SpouseField label="Nome completo *">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Maria Silva"
                    style={INPUT_STYLE}
                  />
                </SpouseField>
                <SpouseField label="CPF *">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={newCpf}
                    onChange={(e) => setNewCpf(maskCPF(e.target.value))}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    style={INPUT_STYLE}
                  />
                </SpouseField>
                <SpouseField label="E-mail (opcional)">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="maria@email.com"
                    style={INPUT_STYLE}
                  />
                </SpouseField>
                <SpouseField label="Telefone (opcional)">
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="(11) 98888-7777"
                    style={INPUT_STYLE}
                  />
                </SpouseField>
              </div>
            </>
          )}

          {showError ? (
            <div style={{ marginTop: 16, fontSize: 12, color: "var(--color-red)", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, padding: "10px 14px" }}>
              {showError}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-default)", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              color: "var(--text-disabled)",
              border: "none",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              padding: "8px 0",
            }}
          >
            Pular por enquanto
          </button>
          {tab === "create" ? (
            <button
              type="button"
              onClick={() => void handleCreateAndLink()}
              disabled={!canCreate}
              style={{
                background: canCreate ? "var(--color-sprout)" : "var(--color-stone)",
                color: canCreate ? "var(--color-ink)" : "var(--color-fog)",
                border: "none",
                borderRadius: 8,
                padding: "0 16px",
                height: 36,
                fontSize: 13,
                fontWeight: 700,
                cursor: canCreate ? "pointer" : "not-allowed",
                WebkitAppearance: "none",
                appearance: "none",
              }}
            >
              {creating || linking ? "Cadastrando..." : "Cadastrar e vincular"}
            </button>
          ) : null}
        </div>
      </div>
    </NexaModal>
  );
}

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  background: "var(--surface-base)",
  border: "1px solid var(--border-default)",
  borderRadius: 8,
  padding: "10px 14px",
  color: "var(--text-primary)",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

function SpouseField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        style={{
          fontSize: 10,
          color: "var(--text-disabled)",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          display: "block",
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
