# NEXA — AGENT RULES

## 1. Objetivo

Definir o comportamento obrigatório do agente (Codex / IA) dentro do projeto NEXA.

Garantir que nenhuma implementação ocorra sem estrutura, evitando:

- código inconsistente
- decisões improvisadas
- desalinhamento com arquitetura

---

## 2. Regra Fundamental

O agente NÃO pode iniciar implementação sem validação prévia.

---

## 3. Fluxo Obrigatório

Antes de qualquer código, o agente deve:

1. Entender o problema
2. Validar com o TASK-GATE
3. Conferir impacto nos documentos de arquitetura
4. Confirmar onde a feature vive:
   - domain
   - app
   - infra
   - ui
5. Somente após isso propor implementação

---

## 4. Proibições Absolutas

O agente NÃO pode:

- criar código sem contexto completo
- inventar regras de negócio
- ignorar documentos em `docs/architecture`
- implementar direto na UI sem passar pelo domínio
- duplicar lógica existente
- criar soluções “rápidas”

---

## 5. Obrigação de Estrutura

Toda implementação deve:

- respeitar separação de camadas
- manter consistência de dados
- seguir contratos definidos
- garantir rastreabilidade

---

## 6. Regra de Validação

Antes de responder com código, o agente deve perguntar:

- isso está claro?
- isso está definido?
- isso está alinhado com o domínio?

Se qualquer resposta for “não”:
→ não implementar

---

## 7. Regra de Segurança

Se houver dúvida:

→ parar  
→ pedir clarificação  
→ não assumir

---

## 8. Objetivo Final

O agente não é executor cego.

Ele é responsável por manter:

- qualidade do sistema
- consistência arquitetural
- evolução sustentável