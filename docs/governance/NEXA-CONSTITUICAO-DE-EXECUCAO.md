# NEXA — CONSTITUIÇÃO DE EXECUÇÃO

## 1. Objetivo

Estabelecer as regras fundamentais de desenvolvimento do sistema NEXA (RR CRM), garantindo:

- consistência arquitetural
- previsibilidade de evolução
- controle de complexidade
- escalabilidade do produto

---

## 2. Princípios Fundamentais

### 2.1 Arquitetura orientada a domínio

Todo o sistema deve ser organizado a partir do domínio de negócio, não da interface.

Estrutura obrigatória:

- domain → regras de negócio puras
- app → orquestração de casos de uso
- infra → acesso a dados e serviços externos
- ui → interface do usuário

---

### 2.2 Separação de responsabilidades

É proibido:

- lógica de negócio dentro da UI
- acesso direto ao banco dentro da UI
- regras espalhadas fora do domínio

---

### 2.3 Fonte única de verdade

Toda regra de negócio deve existir em apenas um lugar.

Evitar:

- duplicação de regras
- cálculos replicados em múltiplas camadas

---

### 2.4 Sistema orientado a eventos

Ações críticas devem refletir no sistema inteiro:

Exemplo:
- proposta criada → atualiza mapa
- reserva feita → bloqueia unidade
- venda concluída → altera status global

---

### 2.5 Configuração por cliente

O sistema deve permitir:

- regras diferentes por incorporadora
- parametrização sem alterar código base

---

## 3. Regras de Desenvolvimento

### 3.1 Nenhuma feature nasce sem definição

Antes de qualquer implementação, deve existir:

- objetivo claro
- impacto no sistema
- regras de negócio definidas

---

### 3.2 Proibição de código improvisado

Não é permitido:

- “ajuste rápido”
- lógica temporária sem definição
- decisões sem documentação

---

### 3.3 Evolução incremental controlada

Cada entrega deve:

- respeitar a arquitetura
- não quebrar fluxos existentes
- manter consistência entre módulos

---

## 4. Estrutura de Decisão

Toda decisão deve responder:

- qual problema resolve?
- onde isso vive no sistema?
- qual impacto nos outros módulos?

---

## 5. Objetivo Final do Produto

O NEXA não é apenas um CRM.

É um sistema completo de operação comercial imobiliária:

- gestão de clientes
- gestão de corretores
- simulação
- proposta
- reserva
- venda
- controle de unidades
- materiais comerciais

Tudo conectado por um único motor.

---

## 6. Regra de Ouro

Se não está claro:
- não implementar

Se não está estruturado:
- não codar

Se não está alinhado com o domínio:
- está errado