# AUDITORIA — NexaSelect v2: as 8 Leis de UX (padrão de design system)

**Data:** 2026-07-11 · **Decisão de produto:** Rubiam + arquiteto
**Contexto:** NexaSelect v1 (migração global) foi reprovado na EXPERIÊNCIA:
nomes truncados por dica repetida, opção selecionável enterrada entre 29
desabilitadas, gatilho sem valor atual. O componente existia; faltava a
inteligência de uso. As leis abaixo são implementadas **uma vez no componente**
e valem automaticamente para TODAS as telas.

---

## As 8 Leis (padrão de DS — `src/shared/ui/NexaSelect.tsx`)

| Lei | O que o componente faz | Como |
|---|---|---|
| **L1 acionável primeiro** | selecionáveis sempre acima; desabilitadas depois | separa `enabled` (ordem natural/grupo) de `disabled` |
| **L2 ruído agrupa, não repete** | desabilitadas RECOLHIDAS sob cabeçalho por MOTIVO com contagem: "29 imobiliárias sem corretores ativos ▸"; expande ao clicar; itens sem repetir a frase | agrupa disabled por `hint`; `data-nexa-select="disabled-toggle"`; motivos heterogêneos → um cabeçalho por motivo |
| **L3 nome não trunca por metadado** | label tem prioridade de espaço; hint só à direita e curto; painel largo (min 320px) + max-height/scroll; `title` = nome completo | `minPanelWidth`, ellipsis no label, tooltip |
| **L4 gatilho conta a verdade** | fechado mostra o valor atual ("Todas", "Master Home…"), nunca "Selecionar…" quando há valor | `selectedOpt = options.find(value)`; placeholder só sem match |
| **L5 busca instantânea e honesta** | filtra acionáveis E desabilitadas (a desabilitada achada aparece na seção dela, com trecho realçado); zero-resultado com dica; foco automático | `<Highlight>`, disabled auto-expande na busca, "Nenhum resultado em {noun}…" |
| **L6 recentes no topo** | 3 últimas escolhas do usuário numa seção "Recentes" | `recentKey` (localStorage `nexa-recents:<key>`); só pessoas/filtros, NÃO dado de formulário |
| **L7 teclado impecável** | setas pulam desabilitadas, Enter seleciona, Esc fecha e devolve foco ao gatilho, typeahead fora da busca | navegação só sobre `navItems` (recentes+enabled) |
| **L8 o conjunto se explica** | rodapé acionável quando houver desabilitadas | prop `footer`; no Atribuir, "Convidar corretores →" migrou para cá |

Novas props: `noun`, `recentKey`, `footer`, `minPanelWidth`. API controlada, zero
regra de negócio (dados prontos do hook).

## Caso-farol — seletor de imobiliárias do Atribuir (validação)

Abre mostrando **"Todas" no gatilho** (L4), **Master Home no topo como única
acionável** (L1), **"29 imobiliárias sem corretores ativos ▸" recolhido** (L2),
**busca com foco automático** (L5), e o **"Convidar corretores →" no rodapé do
painel** (L8). `recentKey="assign-brokerage-filter"`, `noun="imobiliárias"`.

## Revisão do inventário — configuração por tela

Leis L1–L5, L7, L8 valem **automaticamente** para os ~63 seletores migrados
(busca aparece só quando > 8 opções; colapso de disabled só quando há
desabilitadas; gatilho sempre com valor). L6 (recentes) é **opt-in**:

| Categoria | Telas | Busca | Recentes (L6) |
|---|---|---|---|
| **Filtro de pessoas/recorrente** | Atribuir (imobiliária)★, Kanban (membro)★, Negociações (corretor)★, Contatos (responsável), Clientes (corretor), Relatório (membro) | auto | **SIM** — ★ já ativado; demais recomendados |
| **Formulário — dado** | tipo de parcela, UF, estado civil, regime, origem, perfil, topografia, água, doc, papel, índices | auto (>8) | **NÃO** (é dado, não preferência) |
| **Filtro simples** | status, temperatura, período, ordenar | conforme nº opções | não |

★ = `recentKey` ativado neste ciclo. Os demais de pessoas são recomendação
registrada (ativar por `recentKey` quando priorizado) — mudança de 1 linha,
sem risco.

## DoD

- **tsc 0 · build verde · check:contracts 9/9 · suíte 966** (+5 leis: gatilho,
  L1/L2 ordem+colapso, busca em desabilitadas, recentes, teclado, rodapé).
- Tokens Brand Book v7; zero emojis (ícones SVG). Zero regra em `.tsx`.
- Commits temáticos; WIP (22) intocado.
- **Deploy + prova de bundle:** (rodapé abaixo).

### Checklist para o Rubiam (hard refresh)
- **Atribuir lead** (o print): gatilho "Todas"; Master Home única acionável no topo;
  "29 imobiliárias sem corretores ativos ▸" recolhido (clica → expande, apagadas,
  sem repetir a frase); busca focada; "Convidar corretores →" no rodapé do painel.
- **Kanban (membro)** e **Negociações (corretor)**: seção "Recentes" após escolher.
- Qualquer select longo: teclado (setas pulam disabled, Esc volta ao gatilho),
  nome não trunca por causa de dica.
