# NEXA — DOCUMENTOS DE ARQUITETURA

## 1. Objetivo

Centralizar e organizar os documentos oficiais que definem a arquitetura, regras e execução do sistema NEXA (RR CRM).

Este arquivo serve como ponto de entrada para qualquer decisão técnica ou de produto.

---

## 2. Documentos Oficiais

### 2.1 Execução

- NEXA — Plano de Execução (Sprint 0 e Sprint 1)

---

### 2.2 Setup Técnico

- NEXA — Plano de Setup Técnico (v1)

---

### 2.3 Domínio e Regras de Negócio

- NEXA — Arquitetura do Motor Comercial (v1)
- NEXA — Configurações por Cliente e Engine de Regras (v1)

---

### 2.4 Dados e Contratos

- NEXA — Contratos de Dados e Interfaces do Sistema (v1)

---

### 2.5 Planejamento

- NEXA — Backlog Inicial de Implementação (v1)

---

## 3. Regra de Uso

Todos os desenvolvimentos devem obrigatoriamente seguir a seguinte ordem:

1. Validar a tarefa no **TASK-GATE**
2. Conferir impacto nos documentos acima
3. Garantir alinhamento com a **Constituição de Execução**
4. Somente então iniciar implementação

---

## 4. Hierarquia de Decisão

Em caso de dúvida:

1. Constituição de Execução
2. Documentos de Arquitetura (este índice)
3. Task Gate
4. Código

O código nunca define regra. Ele apenas implementa.

---

## 5. Proibições

É proibido:

- implementar funcionalidades sem consultar estes documentos
- criar regras fora do domínio definido
- duplicar lógica em múltiplos lugares
- tomar decisões sem base documentada

---

## 6. Diretriz Final

Se não está documentado:
→ não existe

Se não está alinhado:
→ não deve ser implementado