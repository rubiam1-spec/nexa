Antes de qualquer implementação neste projeto, siga este protocolo obrigatório:

1. Leia primeiro:
- AGENTS.md na raiz do projeto
- docs/governance/NEXA-CONSTITUICAO-DE-EXECUCAO.md
- docs/governance/TASK-GATE.md
- docs/architecture/INDEX.md

2. Considere como documentos soberanos os PDFs listados em docs/architecture/INDEX.md.

3. Antes de escrever código, valide:
- se a task está alinhada aos documentos soberanos
- se existe conflito com arquitetura, modelo de dados ou ordem de execução
- se a task cria retrabalho estrutural
- se depende de contexto real ainda não implementado

4. Se houver qualquer conflito, lacuna documental ou risco de retrabalho:
- pare
- não implemente
- explique o conflito objetivamente
- proponha a correção antes de seguir

5. Durante a implementação:
- respeite separação entre domain, app, infra e ui
- não coloque regra de negócio em UI
- não acesse banco direto da UI
- não crie solução rápida fora do padrão existente

6. Ao finalizar:
- rode build
- rode validações necessárias
- explique quais documentos sustentaram a decisão
- diga claramente se houve algum ponto ainda mockado ou provisório

Agora, antes de continuar a task atual, faça uma validação de aderência documental e me diga:
- se a task pode seguir
- quais documentos a sustentam
- quais riscos ainda existem