# AUDITORIA — NexaSelect v3: motor re-plataformado (Radix + cmdk + match-sorter)

**Data:** 2026-07-11 · **Decisão de produto/arquitetura:** Rubiam + arquiteto
**Contexto:** NexaSelect v2 tinha API única, 8 leis e migração global — mas a
FLUIDEZ foi reprovada (micro-atritos de interação; gatilho com visual de "pill
claro"). Diagnóstico: a mecânica **artesanal** (posicionamento manual, teclado à
mão) é o problema. O padrão sênior de mercado (Linear/shadcn/Adobe/OpenAI) é
**motor headless**: Radix + cmdk.

## Decisão de arquitetura (cânone)

> O **NexaSelect mantém**: API pública (`options {value,label,hint,disabled,group,
> sublabel}`, controlado, props `recentKey`/`noun`/`footer`/`autoFocus`), as **8
> leis de UX** e a **pele NEXA**. **Troca o MOTOR interno** por primitivos
> battle-tested. **Não é framework novo** — é parar de reinventar mecânica de
> interação.

- **@radix-ui/react-popover** `^1.1.19` — posicionamento com **detecção de
  colisão** (abre p/ cima/baixo sozinho, nunca corta na viewport, funciona dentro
  de modais via portal), foco/Esc/dismiss acessíveis. Peer react `^19` ✓.
- **cmdk** `^1.1.1` — lista/busca/teclado acessíveis (role listbox/option,
  setas pulando disabled, Enter, foco no input). Peer react `^18||^19` ✓.
- **match-sorter** `^8.3.0` — ranking **fuzzy** ("mast" acha "Master Home"),
  agnóstico de framework. Aplicado sob **`useDeferredValue`** → digitação nunca
  trava (filtragem não-bloqueante).
- **Lockfile:** +664 linhas em `package-lock.json` (as 3 diretas + transitivas
  Radix). Nenhum conflito de peer dep; build e suíte verdes.

## As 8 leis, reimplementadas sobre o motor novo

L1 acionáveis primeiro · L2 desabilitadas recolhidas sob cabeçalho por motivo com
contagem (cmdk `disabled` → fora da navegação) · L3 label sem truncar por metadado
(painel `min-width: max(320px, --radix-popover-trigger-width)`, tooltip) · L4
gatilho com o valor atual · L5 busca fuzzy + realce + foco automático (Radix
`onOpenAutoFocus` → cmdk input) + zero-resultado honesto · L6 recentes
(localStorage) · L7 teclado (Radix/cmdk nativos; Esc devolve foco ao gatilho pelo
Radix; setas pulam disabled validado em teste) · L8 rodapé acionável.

## A pele (o print do Rubiam) — `NexaSelect.css`

- **Gatilho:** fundo **Carbon** (`--color-carbon`), borda **--line 1px**
  (`--color-stone`), raio **8px**, foco com **anel Sprout sutil**
  (`0 0 0 3px rgba(74,222,128,.15)`). **Sem gradiente/pill claro** (causa do print).
- **Painel:** Carbon, sombra profunda discreta, **animação 140ms fade+scale
  0.98→1** na abertura (100ms no fechamento via Radix `data-state`), sem layout
  shift; `transform-origin` = `--radix-popover-content-transform-origin`;
  `prefers-reduced-motion` respeitado.
- **Toque:** itens `min-height: 44px` (antecipa o Capítulo M); hover sutil;
  selecionado com check discreto.

## Compatibilidade de API — telas migradas não mudam

Nenhuma das ~63 ocorrências migradas (v1/v2) foi tocada: a API pública é idêntica.
O farol (Atribuir) segue com `noun="imobiliárias"`, `recentKey`, `footer`.

## Validação (jsdom)

Testes de comportamento das 8 leis (18) rodam em jsdom com polyfills
(`ResizeObserver`/`IntersectionObserver` como classes, pointer capture,
`scrollIntoView`) em `src/test/setup.ts`. **Posicionamento/colisão do Radix não é
verificável em jsdom** (sem layout real) — validação **manual** no checklist.

## DoD

- **tsc 0 · build verde · check:contracts 9/9 · suíte 966+ (18 no NexaSelect).**
- Bundle +~85KB (Radix+cmdk+match-sorter) — troca consciente pela fluidez.
- Zero regra em `.tsx`; tokens Brand Book; zero emojis.
- Commits temáticos; WIP (22) intocado.
- **Deploy + prova de bundle:** (rodapé abaixo).

### Caso-farol + checklist para o Rubiam (hard refresh)
- **Atribuir → imobiliárias:** abre **instantâneo** com animação suave; gatilho
  Carbon (sem pill claro); "Todas" no gatilho; **busca fuzzy** ("mast" → Master
  Home); Master Home no topo; "29 imobiliárias sem corretores ativos ▸" colapsado;
  "Convidar corretores →" no rodapé. Abre sem cortar mesmo dentro do modal.
- **Qualquer select:** teclado (setas pulam disabled, Esc volta ao gatilho), abre
  p/ cima quando perto do rodapé da tela, foco automático na busca.
