# AUDITORIA — Modais ancorados na viewport (NexaModal) + varredura global

**Data:** 2026-07-11 · **Decisão:** Rubiam + arquiteto
**Bug (print):** o modal "Descartar lead" ficava preso ao topo da PÁGINA ao rolar
— posicionado no documento, não na viewport.

## Causa

Os modais usavam `position:fixed; inset:0` mas **renderizados INLINE** (sem
`createPortal`). Quando um ancestral tem `transform`/`filter`/`perspective` (cards
animados do Kanban, containers com animação), `position:fixed` passa a ancorar
**nesse ancestral**, não na viewport → o modal "gruda" na página. Isso **viola a
regra canônica** já existente do projeto.

## Regra canônica (REAFIRMADA)

> Todo overlay (modal/sheet/confirm) passa pelo **`src/shared/ui/NexaModal.tsx`**:
> `createPortal(document.body)` + wrapper `position:fixed; inset:0; zIndex ≥ 9000`
> centralizando o conteúdo, com **backdrop com dismiss**, **Esc fecha**, **scroll
> da página travado** enquanto aberto e **foco inicial no primeiro campo**. NUNCA
> renderizar overlay inline (o `transform` de um ancestral quebra o `fixed`).

`NexaModal` é o **base fino** (o card é do chamador). Comentário-cânone no topo do
componente.

## Flagship (o bug reportado)

`LeadActionModals` — **AssignModal** (Atribuir) e **DiscardModal** (Descartar)
migrados para `NexaModal`. Teste de regressão: render dentro de container com
`transform: translateY(400px)` → o backdrop é filho de `document.body` (portal),
`position:fixed`, `inset:0`, `zIndex ≥ 9000`.

## Varredura global — inventário (5 subagentes por área + flagship)

**Modais INLINE (b) → migrados para NexaModal (11):**
- `LeadActionModals` — **AssignModal**, **DiscardModal** (o bug do print).
- `BirthdayBannerModal` · `NegotiationsPage` (Novo cliente) · `KanbanPage`
  (Simulação) · `ClientDetailPage` (Registrar atendimento) · `UsersPage`
  (confirmação) · `BrokersPage` (Convidar + ação) · `DashboardPage` (Personalizar)
  · `UnitsPage` (Sair da fila).

**Já canônicos (a) — createPortal(body), grude-safe:**
- shared: QueueEntryModal, LostReasonModal, CancelNegotiationModal,
  ConfirmacaoDestructiva, ConfirmacaoNegociacaoModal, PipelineActionModals.
- relacionamento: BannerTemplateEditorModal, RecognitionBannerModal,
  ComunicadoBannerModal, PlanejamentoTab (Publicar).
- páginas: ClientDetailPage (rejeitar/converter/confirm), BrokerageDetailPage,
  BrokeragesPage, ThirdPartyPropertyDetailPage (aprovação/doc), AtividadesPage
  (vários), DevelopmentDetailPage.

**Padronizados (a → NexaModal) para herdar Esc/scroll-lock/foco (4):**
ActivityDetailModal, FollowUpModal, OnboardingWelcome, SpouseLinkModal — já eram
portalados (não sofriam o bug), migrados ao base por consistência.

**Não-modais (preservados):** toasts (Celebration, EditorMapaPins, Relacionamento…),
menus por coordenada (⋮ de card, ActionMenu, statusMenu), drawers laterais
(TeamMemberPanel, SpousePeek — já portalados).

**Follow-up registrado:** 3 **lightboxes/visores de mídia full-bleed** (FeedPage,
PublicPropertyPage, ThirdPartyPropertyDetailPage) são `fixed inset:0` mas o overlay
É o conteúdo (sem card centrado). NexaModal centraliza com padding — mudaria o
layout. Candidatos a um **wrapper portal-only** (sem centralização) num lote
dedicado; hoje já cobrem a viewport por inset:0.

## DoD

- tsc 0 · build verde · check:contracts · suíte + testes do NexaModal (regressão de
  viewport/portal). Zero regra de negócio. WIP (22) intocado.
- **Deploy:** push ff `b9e4ab0..ed8afee` → main → **`dpl_88VCvJVSXGQRv2X78dRCdz7naPQH` READY**
  (production, sha `ed8afee`, `app.nexacomercial.com.br`).
- **Prova de bundle** (`/assets/index-KIjgA4nT.js`): `data-nexa-modal` 1× (backdrop
  canônico; minificado `{ref:s,"data-nexa-modal":"backdrop",...}`), `aria-modal` 2×.
  Rollback = instant rollback p/ `dpl_DBwCFHrz` (`aaee82a`).

### Checklist para o Rubiam
- Abrir **Descartar** (e **Atribuir**) com a página **rolada** / a partir de um card
  do Kanban → o modal **centraliza na tela SEMPRE** (não gruda no topo).
- Esc fecha; clicar no fundo fecha; o scroll da página trava enquanto aberto.
