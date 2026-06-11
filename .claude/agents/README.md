# Time de agentes NEXA (.claude/agents)

Estes subagentes dão sequência ao projeto com disciplina de continuidade. Invoque-os no Claude Code dentro do repositório. A fonte de verdade de todos é o `CLAUDE.md` na raiz.

## Os agentes

- **nexa-diagnostico** — investiga causa raiz no banco (Supabase MCP) e no código ANTES de qualquer mudança. Read-only. Sempre o primeiro passo.
- **nexa-implementador** — implementa o próximo passo do backlog respeitando arquitetura, regra fora da UI e consistência mock/Supabase.
- **nexa-revisor** — revisa o diff quanto à aderência (RLS, multi-tenant, fluxo, build) antes do commit/deploy.

## Orquestração ponta a ponta (fluxo recomendado)

Para qualquer feature/correção do backlog, peça ao Claude Code para seguir esta sequência:

1. **nexa-diagnostico** confirma a realidade e entrega os "fatos pré-confirmados".
2. **nexa-implementador** implementa apenas o passo necessário, com base nesses fatos.
3. **nexa-revisor** valida a entrega; se reprovar, volta ao implementador.
4. Só então: commit temático + `npm run build && npx vercel deploy --prod --yes`.

Ordem de prioridade (nunca inverter): consistência do fluxo comercial > unidade como ativo > integridade/rastreabilidade > aderência documental > evolução incremental > UX > estética.

## Fila de prioridade atual do backlog

P1 Distribuição de Leads (round-robin com peso) · P2 Documentos/Contratos (checklist) · P3 Motor de Inteligência Sprints 4–5 (alertas IA + briefing via Claude Haiku) · P4 Links curtos com slug · P5 Teste ponta a ponta com dados reais (Bomm) · P6 App Capacitor (Apple Store) · P7 Redesign do site institucional.
