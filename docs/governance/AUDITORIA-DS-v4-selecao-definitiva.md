# AUDITORIA — DS v4: padrão DEFINITIVO de seleção (3 camadas + EntityPicker aprovado)

**Data:** 2026-07-11 · **Decisão de produto/arquitetura:** Rubiam + arquiteto
**Contexto:** o motor v3 (Radix Popover + cmdk + match-sorter) foi **aprovado e
fica**. O que o Rubiam reprovou foi a **composição/UX** do picker (filtro
aninhado dentro do picker, Recentes duplicando item, cabeçalho parecendo item,
hierarquia lavada, **clique morto**). Após 3 protótipos iterados COM o Rubiam, o
comportamento foi **aprovado em protótipo funcional**; a produção o reproduz.

## Diagnóstico obrigatório — o "clique morto" da v3 (causa)

O `cmdk.Command.Item.onSelect` só dispara para o item **destacado**
(`data-selected`), destaque que o cmdk define por `pointermove`/estado interno.
Dentro do **Focus Scope + camada dismissable do Radix** (e agravado por **valores
duplicados** quando "Recentes" repetia o item), o `pointermove` se perde / o mapa
de itens fica ambíguo → o clique não acha item destacado e **no-opa**. É um
defeito de **foco/pointer do cmdk dentro do Radix**, não do clique em si.

**Correção:** no EntityPicker, as linhas acionáveis são **`<button onClick>`
nativos** — o clique deixa de depender do destaque do cmdk (T3 garante que não
regride). O motor Radix (posição) + match-sorter (fuzzy) permanece; cmdk fica no
NexaCombobox (listas homogêneas, sem duplicação, onde o clique é confiável).

## Três componentes, uma família (sobre o motor atual)

| Componente | Uso | Busca | Grupos | Recentes | Motor |
|---|---|---|---|---|---|
| **NexaMenu** | listas curtas (≤7): período, ordenação, enums de formulário | não | não | não | Radix + lista |
| **NexaCombobox** | listas longas simples (8+ homogêneas) | sim (foco auto) | opcional | não | Radix + cmdk + match-sorter |
| **NexaEntityPicker** | pessoas/entidades (o Atribuir) | sim + Filtros + token | por visão | não (decisão i) | Radix (menu) + match-sorter + linhas nativas |

`NexaSelect` permanece como **fachada** que roteia Menu (≤8) ou Combobox (>8) por
contagem — as ~63 telas migradas na v1/v2 **não mudam** (compat total).

## EntityPicker — comportamento aprovado (o farol: Atribuir)

a. Barra: busca ("Buscar por nome ou imobiliária...") + botão **Filtros** (funil).
   Sem chips fixos, **sem select aninhado** (T4).
b. Filtros abre menu: Equipe interna (N) · Imobiliárias → (submenu com busca
   própria; só as com corretor ativo são tocáveis + contagem; as demais apagadas
   "· sem ativos") · Autônomos (N) = brokers sem `brokerage_id`.
c. Filtro = **token verde removível** sob a busca ("Imobiliária: Master Home ×");
   botão Filtros **aceso** enquanto há filtro; **Esc remove o filtro** antes de
   fechar o picker.
d. **Lei do escopo:** com filtro, a busca procura só dentro dele; sem filtro,
   procura em tudo (nome + imobiliária).
e. **Sugestão inteligente:** sem filtro de imobiliária, termo 3+ que casa
   imobiliária **com** ativos → item tracejado "FILTRO · Filtrar pela imobiliária
   {nome}"; clique converte a digitação em token e limpa a busca.
f. Linha: avatar de iniciais · nome (14.5px) · subtítulo apagado (11.5px) · carga
   "N ativos" mono à direita (âmbar quando >0); hover; **clique nativo** atribui.
g. Grupos (só sem filtro): cabeçalhos mono 10px CAIXA ALTA — `<div>`, sem
   hover/clique/foco (T2).
h. Rodapé: "N corretores ainda sem acesso" + "Convidar →".
i. **Sem Recentes** nesta versão (só volta se houver volume que justifique —
   registrado).

## Regras duras → testes bloqueantes (dos defeitos reprovados)

- **T1** nenhuma entidade aparece duas vezes · **T2** cabeçalho de grupo não é
  interativo (`<div>`) · **T3** todo item acionável responde ao clique (integração
  real do onPick — o clique morto não regride) · **T4** não existe select/dropdown
  dentro do EntityPicker (estrutural) · **T5** com filtro Autônomos, "jefte" →
  vazio (lei do escopo) · **T6** "master" sem filtro exibe a sugestão; clicá-la
  aplica o token e lista só a Master Home. **Todos verdes.**

## Reclassificação do inventário (~63 ocorrências)

O motor/fachada roteia por contagem; o quadro por categoria:

| Categoria | Telas (exemplos) | Componente | Justificativa |
|---|---|---|---|
| Enum de formulário / lista curta | estado civil, regime, UF-menu, topografia, água, acesso, papel, índices, período, ordenação, modo | **NexaMenu** | ≤7 opções, sem necessidade de busca |
| Lista longa homogênea | Unidade, Cliente, listas de imobiliária, UF (27), fontes | **NexaCombobox** | 8+ opções homogêneas; busca fuzzy ajuda |
| Filtros de pessoa | Kanban (membro), Negociações (corretor), Contatos (responsável), Relatório (membro) | **NexaCombobox** | filtro simples de valor; **sem** carga/filtros-menu que justifiquem o EntityPicker (candidatos a evoluir p/ EntityPicker se ganharem essa riqueza) |
| Seleção de pessoas rica | **Atribuir lead** (farol) | **NexaEntityPicker** | tem carga, imobiliárias, autônomos, convite — o comportamento aprovado |

## Processo (novo rito de governança)

> **Protótipo funcional aprovado ANTES do código** para todo componente visual
> novo/redesenhado. O DS v4 nasceu de 3 protótipos iterados com o Rubiam; a
> produção deve ser **indistinguível** do protótipo aprovado. Passa a valer para
> todo componente visual.

## DoD

- **tsc 0 · build verde · check:contracts 9/9 · suíte 979** (+T1–T6, +3 componentes,
  +buildPickerModel). Zero regra de negócio nos componentes (modelo via
  `buildPickerModel`, contagens em batch pela hook). Tokens Brand Book; zero emojis.
- Deps do motor já no lock (v3). Commits temáticos; WIP (22) intocado.
- **Deploy + prova de bundle:** (rodapé abaixo).

### Checklist para o Rubiam validar CONTRA O PROTÓTIPO (lado a lado)
- **Atribuir:** barra busca + Filtros; Filtros → Equipe interna/Imobiliárias→/Autônomos;
  aplicar = token verde removível; Esc remove token; escopo (com filtro busca só
  dentro); digitar "master" → sugestão tracejada → vira token e lista só Master
  Home; linha com avatar/carga; clique atribui (sem clique morto); rodapé Convidar.
- **Menus curtos** (período/ordenação): abre discreto, check na atual, sem busca.
- **Combobox longos** (unidade/cliente/corretor): busca fuzzy, realce, teclado.
