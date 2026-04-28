# NEXA — TASK GATE

## Objetivo

Garantir que nenhuma feature seja desenvolvida sem passar por critérios mínimos de qualidade.

---

## Checklist obrigatório antes de desenvolver

### 1. Clareza

- [ ] O problema está claramente definido?
- [ ] Existe objetivo claro?

---

### 2. Domínio

- [ ] A regra de negócio está definida?
- [ ] Está claro onde isso vive (domain/app/infra/ui)?

---

### 3. Impacto

- [ ] Impacta mapa?
- [ ] Impacta reservas?
- [ ] Impacta propostas?
- [ ] Impacta outros módulos?

---

### 4. Dados

- [ ] Quais dados entram?
- [ ] Quais dados saem?
- [ ] Existe DTO definido?

---

### 5. Regras

- [ ] Existem validações?
- [ ] Existem exceções?
- [ ] Existem estados intermediários?

---

## Regra final

Se qualquer item acima for "não":

→ NÃO desenvolver

→ Voltar para definição

---

## Objetivo do Gate

Evitar:

- retrabalho
- código fraco
- inconsistência
- decisões improvisadas