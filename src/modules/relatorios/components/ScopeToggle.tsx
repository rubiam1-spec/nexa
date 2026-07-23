// Alternador de escopo dos Relatórios — agora um FINO wrapper sobre o padrão
// único (shared/components/ScopeToggle, Lei 4). Mantém a API por ReportScope e
// os rótulos do domínio; o visual é fonte única. NÃO decide papel — só organiza.
import { ScopeToggle as BaseScopeToggle } from "../../../shared/components/ScopeToggle";
import type { ReportScope } from "../domain/reportRegistry";

const SCOPE_LABELS: Record<ReportScope, string> = {
  self: "Minhas métricas",
  team: "Equipe",
  global: "Geral",
};

interface Props {
  scopes: ReportScope[];
  value: ReportScope;
  onChange: (scope: ReportScope) => void;
}

export default function ScopeToggle({ scopes, value, onChange }: Props) {
  return (
    <BaseScopeToggle
      options={scopes.map((s) => ({ value: s, label: SCOPE_LABELS[s] }))}
      value={value}
      onChange={onChange}
      ariaLabel="Escopo do relatório"
    />
  );
}
