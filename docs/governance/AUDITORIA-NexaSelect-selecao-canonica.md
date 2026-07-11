# AUDITORIA — NexaSelect: componente de seleção canônico + migração global

**Data:** 2026-07-11 · **Decisão de produto:** Rubiam + arquiteto
**Objetivo:** os dropdowns eram `<select>` NATIVOS do navegador — fora da
identidade (highlight do SO, fonte de sistema), sem feedback em itens
desabilitados, sem busca em listas longas, inconsistentes entre telas. Caso do
print: seletor de imobiliárias do modal Atribuir (L1.9) com 30+ itens
desabilitados mudos. Solução: UM componente canônico + migração de TODAS as
ocorrências.

---

## Parte 0 — Inventário

Varredura (`grep <select`): **80 ocorrências em 28 arquivos**. Componentes custom
pré-existentes: `SearchableSelect.tsx` (portal + busca, sem grupos/disabled/teclado
/aria) e `ImportCombobox.tsx` (WIP importador). Decisão: **evoluir** a base de
portal/posicionamento do `SearchableSelect` para o canônico `NexaSelect`.

Fora de escopo:
- `SimuladorPage.backup.tsx` (4) — código morto (governança R-08), não migrado.
- WIP do importador — `ImportCombobox.tsx` (1) e `NegotiationImportWizard.tsx` (5) — intocáveis.
- `NegotiationDetailPage.tsx` (5) — em WIP (git M), intocável neste ciclo.

Alvo efetivo: ~65 ocorrências em ~24 arquivos (flagship + 23 via migração).

## Parte 1 — Componente `src/shared/ui/NexaSelect.tsx`

- **Anatomia:** trigger nos tokens (Carbon/line `--border-default`, foco com anel
  Sprout sutil `rgba(74,222,128,.35)`, chevron SVG) + painel em `createPortal`
  (position fixed, viewport-aware: abre p/ cima quando falta espaço; largura mín =
  trigger). Nunca cortado por overflow de modal.
- **Enterprise:** teclado (setas, Enter/Espaço, Esc, Home/End, typeahead), busca
  automática > 8 opções, grupos com cabeçalho, **item desabilitado nunca mudo**
  (hint à direita: "sem corretores ativos"), estados vazio/carregando(skeleton)/
  erro, aria listbox/option + aria-selected/disabled, check discreto no selecionado,
  scroll interno com altura máx.
- **API tipada e controlada** (`NexaSelectOption {value,label,hint?,disabled?,group?,
  sublabel?}`), zero regra de negócio (dados vêm prontos do hook).
- **Testes:** 12 casos (teclado, busca, grupos, disabled+hint, estados, aria).

## Parte 2 — Migração global

- **Flagship:** modal Atribuir (filtro de imobiliárias) — o caso do print. Item
  desabilitado agora mostra o hint "sem corretores ativos" (antes: sufixo mudo).
- Demais telas migradas 1:1 (mesmos values/handlers) — ver commits por área.

Migração via 5 subagentes paralelos (por área) + flagship. **63 selects nativos
migrados** em 23 arquivos, todos 1:1 (mesmos values/handlers/ordem):

| Área | Arquivos | Selects |
|---|---|---|
| Negociações | NegotiationsPage, KanbanPage | 5 |
| Clientes/Contatos | ClientDetailPage, ClientsPage, ContatoFormPage, ContatosPage, ImportarContatosPage | 25 |
| Atividades/Config | AtividadesPage, SettingsPage, UsersPage, EditorMapaPins, ConfiguracoesTab | 12 |
| Imóveis/Corretores | ThirdPartyPropertyFormPage(7), ThirdPartyPropertyDetailPage, BrokerageDetailPage, BrokersPage, BrokerDetailPage | 15 |
| Modais shared | CancelNegotiationModal, LostReasonModal, QueueEntryModal, RelatorioIndividual, BannerTemplateEditorModal | 5 |
| Flagship | LeadActionModals (Atribuir) | 1 |

`ActivitiesList.tsx` já usava `PillDropdown` custom (0 nativos — só comentários).

### Casos exóticos / decisões
- **Nenhum select `multiple`** no sistema; nenhuma migração forçada.
- **Autofocus (NegotiationsPage → Unidade):** o select usava `ref` para focar ao
  abrir o form. NexaSelect não é `forwardRef`; em vez de perder o comportamento,
  **adicionamos a prop `autoFocus`** ao componente (foca o trigger ao montar) e a
  usamos com `autoFocus={showForm}`. Comportamento preservado; ref morto removido.
- **Prompts vs filtros:** `<option value="">Selecione...</option>` não-selecionável
  virou `placeholder`; `value=""` que é filtro real ("Todos"/"Nenhum"/"—") foi
  mantido como opção. Distinção aplicada caso a caso pelos agentes.

## Regra de governança (novo cânone)

> **Proibido `<select>` nativo novo fora do `NexaSelect`.** Toda seleção passa pelo
> componente canônico (`src/shared/ui/NexaSelect`), que já resolve tokens, portal,
> teclado, busca, grupos, disabled-com-hint, estados e acessibilidade. Comentário
> de governança no topo do componente. (`SearchableSelect` permanece por ora onde já
> usado; convergência futura para o NexaSelect.)

## DoD

- **tsc 0** · **build verde** · **check:contracts 9/9** · **suíte 961** (+12 do
  NexaSelect). Zero regra em `.tsx` (componente controlado, dados do hook). Tokens
  Brand Book v7; zero emojis (ícones via SVG inline).
- Commits temáticos: componente · flagship · 5 de migração por área. WIP (22) intocado.
- **Deploy:** push ff `e2d1750..b2111b0` → main → **`dpl_B46cqeLPn3R2GsWQv3LcnuDb7TCZ` READY**
  (production, sha `b2111b0`, `app.nexacomercial.com.br`).
- **Prova de bundle** (`/assets/index-D5620_zU.js`): `data-nexa-select` presente
  (marker do componente; minificado `{ref:w,"data-nexa-select":"root",...}`) +
  `sem corretores ativos` (hint do disabled no modal Atribuir, agora via NexaSelect).
  Rollback = instant rollback p/ `dpl_4J8vbS6u` (`e2d1750`) ou revert do range.

### Checklist de validação por tela (para o Rubiam)
Abrir e conferir que o dropdown é o NexaSelect (fundo Carbon, foco anel Sprout,
chevron, abre em portal sem corte), teclado (setas/Enter/Esc), busca quando > 8:
- **Atribuir lead** (/leads e Kanban) — imobiliárias, disabled com hint "sem corretores ativos" ✔ caso do print
- **Negociações** — Unidade, Cliente, Corretor, Ordenar · **Kanban** — filtro de membro
- **Clientes/Contatos** — filtros e formulários (estado civil, origem, perfil, etc.)
- **Atividades** — período, modo, consultor, ordenar · **Configurações/Usuários** — papéis, índices, fontes
- **Imóveis (form 3º)** — origem, UF, topografia, acesso, água, doc · **Corretores/Imobiliárias** — UF, vínculos
- **Modais** — Cancelar negociação, Motivo da perda, Fila, Relatório individual, Banner (abrem sobre o modal, sem corte)
