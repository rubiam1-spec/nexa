# PROMPT R-07 — Corretor visível e editável na atividade (UX "Visita corretor")

Achado dos robôs (R-20260611-07). Hoje o corretor de uma atividade vive na coluna `activities.broker_id`, mas o modal de DETALHE não o mostra nem permite adicioná-lo — só existe "+ Adicionar" na EQUIPE, que é equipe interna e exclui corretores de propósito. Resultado: é fácil salvar "Visita corretor" sem corretor e o usuário tenta (em vão) adicioná-lo na EQUIPE.

Cole no Claude Code (raiz do repo):

```
TAREFA: Corrigir a experiência do "corretor" nas Atividades do NEXA. Só frontend. NÃO mudar regra de negócio, RLS nem o fato de que a EQUIPE é equipe interna (corretores são excluídos da EQUIPE DE PROPÓSITO — ver src/modules/atividades/constants/teamScope.ts; manter assim).

CONTEXTO CONFIRMADO (não reinvestigar do zero):
- O corretor da atividade é a coluna activities.broker_id (FK brokers); o nome chega em activity.brokers?.name (join). NÃO é participant nem membro de EQUIPE.
- Modal de detalhe: src/shared/components/ActivityDetailModal.tsx — renderiza bloco de participantes + EQUIPE (participant_type 'user', via onAddTeamMember/onRemoveTeamMember + teamProfiles) + CHECKLIST + RESULTADO. NÃO renderiza broker_id em lugar nenhum (esse é o bug).
- Form de criação/edição: RegistrationModal em src/modules/atividades/pages/AtividadesPage.tsx. O campo de corretor já existe via EntityPicker entity="broker" (renderiza quando o kind tem "corretor" em fields; visit_broker tem). No save: effBrokerId = brokerSel?.id ?? null; insert usa broker_id (linha ~1154), update usa broker_id (linha ~1044). A busca é searchBrokersLite(accountId, q) em src/infra/repositories/activityFieldsRepository.ts (filtra account_id + status='active').
- O schema de tipos (src/modules/atividades/config/activityTypeSchema.ts) marca visit_broker com needs ["broker"]. Use isso para saber quando o corretor é esperado.

MUDANÇA 1 — Mostrar o corretor no detalhe (ActivityDetailModal.tsx):
- Quando activity.broker_id existir, renderizar uma linha/seção "CORRETOR" com o nome (activity.brokers?.name), no mesmo estilo do bloco de participantes (cor de broker já existe em PCOLORS.broker = #4ADE80). Posicionar acima da EQUIPE.

MUDANÇA 2 — Permitir adicionar/trocar o corretor pelo detalhe (sem precisar ir em Editar), só para quem tem canEdit:
- Adicionar uma prop nova onSetBroker?: (broker: { id: string; name: string } | null) => void.
- Se a atividade espera corretor (tipo com needs broker — ex.: visit_broker) OU já tem broker_id: mostrar na seção CORRETOR um controle para definir/trocar/remover o corretor usando o mesmo seletor de busca dos formulários: src/modules/atividades/fields/EntityPicker.tsx (entity="broker", accountId). Ao escolher, chamar onSetBroker. Manter padrão toque-primeiro, tokens T.*, zero emojis, createPortal se abrir overlay.
- Em AtividadesPage.tsx, implementar onSetBroker: atualizar activities.broker_id (via o mesmo repositório/caminho de update já usado pelas ações do detalhe — NÃO acessar supabase direto no componente; usar o hook/repo de atividades existente), refazer o fetch (sem reload) e toast "Corretor atualizado ✓". Registrar evento em activity_logs/activity events como as outras edições (repoLogActivityEvent action 'updated', fields ['broker_id']).

MUDANÇA 3 — Avisar ao salvar "Visita corretor" sem corretor (RegistrationModal em AtividadesPage.tsx):
- No submit de criação/edição, se o kind/type espera corretor (needs broker ou kind.fields inclui "corretor") e effBrokerId é null: antes de inserir, mostrar uma confirmação leve ("Salvar sem informar o corretor?") com opções Continuar / Voltar. Não bloquear de vez — só evitar o save silencioso. Reaproveitar o padrão de confirmação leve já usado no módulo (ex.: o usado ao concluir por arraste), nada de window.confirm.

MUDANÇA 4 — Clareza da EQUIPE (ActivityDetailModal.tsx e onde o rótulo aparecer no form):
- Trocar o rótulo "EQUIPE" por "EQUIPE INTERNA" (ou manter "EQUIPE" com um subtítulo curto "equipe comercial interna") para não induzir o usuário a procurar o corretor ali. Não mudar o comportamento, só o texto/affordance.

VALIDAÇÃO:
1. Abrir uma "Visita corretor" SEM corretor (ex.: as criadas em 11/06): detalhe mostra a seção CORRETOR com ação para adicionar; ao buscar e escolher um corretor, salva em broker_id, aparece o nome, e some o estado vazio — sem reload.
2. Abrir a "Visita corretora Fernanda Souto" (já tem broker_id): detalhe mostra "CORRETOR: Fernanda Souto Martins".
3. Criar uma nova "Visita corretor" sem preencher o corretor → aparece o aviso "Salvar sem informar o corretor?".
4. EQUIPE continua sendo só equipe interna (corretor não entra ali); rótulo mais claro.
5. Segregação/permissão intactas (canEdit controla a edição do corretor). Build verde; tsc limpo.

DEPLOY: npm run build && npx vercel deploy --prod --yes
Reporte arquivos alterados por camada e o resultado das validações.
```

## O que testar depois (você)
Abrir as "Visita corretor" de 11/06, adicionar o corretor pelo próprio detalhe e ver o nome aparecer; criar uma nova sem corretor e conferir o aviso.
