# CLAUDE.md — NEXA Platform
> Leia este arquivo inteiro antes de qualquer ação. Ele define identidade, arquitetura, regras e restrições do projeto.

---

## 1. IDENTIDADE DO PRODUTO

**Nome:** NEXA
**Tagline:** Velocidade para vender. Controle para crescer.
**Natureza:** Plataforma comercial imobiliária multi-tenant. NÃO é um CRM genérico.

O NEXA é um **motor operacional** que organiza o fluxo comercial de empreendimentos imobiliários:
negociação → proposta → reserva → venda, com a **unidade como ativo central**.

**Público-alvo:** Incorporadoras e urbanizadoras (foco em empreendimentos horizontais).
**Produto vendável** para múltiplos clientes, não apenas uso interno.

---

## 2. DIRETIVAS ABSOLUTAS (NUNCA VIOLAR)

```
NÃO recriar arquitetura do zero
NÃO abrir fluxo paralelo ao documentado
NÃO mudar nome do produto
NÃO fazer redesign sem necessidade objetiva
NÃO mover regra de negócio para componente React
NÃO acessar Supabase diretamente da UI
NÃO criar rotas fora da estrutura existente sem necessidade explícita
NÃO simplificar o sistema a ponto de descaracterizar o motor comercial
NÃO tratar fila, reserva e venda como estados soltos
NÃO ignorar contexto de conta e empreendimento em qualquer operação
NÃO assumir permissão apenas pela tela — validar sempre no domínio
NÃO quebrar consistência entre unidade, negociação, proposta e venda
NÃO introduzir features fora do cronograma atual
```

---

## 3. STACK OBRIGATÓRIA

```
Frontend:   React + TypeScript + Vite
Roteamento: React Router
Backend:    Supabase (Auth + PostgreSQL + Storage)
Deploy:     Vercel
```

---

## 4. ARQUITETURA DE PASTAS (OBRIGATÓRIA)

```
src/
├── app/
│   ├── router/           → rotas e proteção de navegação
│   ├── providers/        → AuthProvider, AccountContext, DevelopmentContext
│   └── layout/           → layout principal com sidebar
│
├── modules/
│   ├── auth/
│   ├── dashboard/
│   ├── negotiations/
│   ├── proposals/
│   ├── reservations/
│   ├── sales/
│   ├── units/
│   ├── developments/
│   ├── clients/
│   ├── brokers/
│   ├── brokerages/
│   ├── users/
│   └── settings/
│
├── domain/
│   ├── entities/         → Negotiation, Proposal, Reservation, Sale, Unit, Client, Broker
│   ├── enums/            → UnitStatus, NegotiationStatus, ProposalStatus, ReservationStatus, SaleStatus, UserRole
│   ├── services/         → regras de negócio, engine de regras configurável
│   └── rules/            → validações de transição de estado
│
├── infrastructure/
│   ├── supabase/         → client Supabase
│   ├── repositories/     → mock + Supabase com MESMO contrato
│   └── mappers/          → Row → DTO → Domain (nunca pular etapas)
│
├── shared/
│   ├── components/       → UI reutilizável
│   ├── hooks/            → hooks genéricos
│   ├── utils/            → utilitários
│   ├── types/            → tipos comuns
│   └── constants/
│
└── styles/               → tokens CSS, variáveis globais
```

### Separação de camadas — OBRIGATÓRIA

| Camada | Responsabilidade |
|---|---|
| `domain/` | Regras de negócio, enums, entidades com comportamento |
| `infrastructure/` | Persistência, mapeamento, integração Supabase |
| `modules/` | Apresentação, hooks locais, lógica de UI |
| `app/` | Composição global, roteamento, providers |

**Nenhuma camada pode depender diretamente da estrutura de outra.**

---

## 5. CONTEXTO OPERACIONAL OBRIGATÓRIO

Todo módulo comercial exige:

```
login → conta ativa (account_id) → empreendimento ativo (development_id) → operação
```

- `AuthContext` — usuário autenticado
- `AccountContext` — conta ativa selecionada
- `DevelopmentContext` — empreendimento ativo selecionado

**Nenhuma operação comercial pode ocorrer fora desse contexto.**
A autorização considera SEMPRE o perfil **E** o vínculo em `user_account_access`.

---

## 6. PERFIS OPERACIONAIS

```
director           → acesso total, configurações estruturais, intervenção na fila
manager            → aprovação de reservas, acompanhamento de pipeline, configurações limitadas
commercial_consultant → criação de negociações e propostas, solicitação de reserva
broker             → negociações próprias, propostas, solicitação de reserva, ver só sua posição na fila
administrative     → suporte pós-venda, materiais, acessos
```

**Autorização nunca depende apenas de `profiles.role`.**
Sempre validar também pelo vínculo em `user_account_access` com a conta ativa.

---

## 7. FLUXO COMERCIAL CENTRAL (IMUTÁVEL)

```
negociação → proposta → reserva/solicitação → [fila quando aplicável] → venda
```

### Estados das entidades

**Negociação:**
```
OPEN | IN_PROGRESS | WON | LOST | CANCELLED
```

**Proposta:**
```
DRAFT | SENT | UNDER_ANALYSIS | ACCEPTED | REJECTED | EXPIRED
```

**Reserva:**
```
ATIVA | EXPIRADA | CANCELADA | CONVERTIDA
```

**Unidade (fonte de verdade: tabela `units`):**
```
DISPONIVEL | EM_NEGOCIACAO | RESERVADO | VENDIDO
```

**Venda:**
```
aguardando_documentacao | aguardando_contrato | aguardando_pagamento | concluida | cancelada
```

**Fila:**
```
ativa | promovida | removida | encerrada
```

### Hierarquia de prioridade da unidade

```
1. Venda concluída
2. Reserva ativa
3. Proposta em análise
4. Negociação ativa
5. Disponível
```

O status da unidade deve sempre refletir o nível mais alto de prioridade ativo.

---

## 8. REGRAS DE NEGÓCIO CRÍTICAS

### Unidade
- Não pode estar em mais de uma reserva ativa simultânea
- Unidade vendida não retorna a disponível sem ação administrativa
- Status deve refletir o estado mais crítico ativo

### Reserva
- Corretor **solicita** — nunca efetiva diretamente
- Efetivação depende de aprovação (manager ou director)
- Possui prazo obrigatório (configurável por conta/empreendimento)
- Ao expirar: alerta ao gestor → unidade volta a disponível → fila é acionada (se ativa)

### Fila
- Opcional, ativada por `queueEnabled` na configuração
- Ordem cronológica automática — sem reordenação manual padrão
- Corretor vê apenas sua posição
- Manager/consultant veem fila completa
- Apenas director pode alterar ordem (exceção)
- Quando reserva cai: próximo da fila assume automaticamente como pré-proposta

### Proposta
- Deve estar vinculada a uma negociação ativa
- Apenas uma proposta pode ser aceita por negociação
- Proposta aceita pode gerar reserva ou venda

### Venda
- Só pode ser criada a partir de reserva ativa ou proposta aceita
- Conclusão altera unidade para VENDIDO de forma definitiva

---

## 9. MODELO DE DADOS — TABELAS OBRIGATÓRIAS

### Primeira onda (fundação)
```sql
accounts
profiles
user_account_access
developments
units
clients
brokerages
brokers
negotiations
```

### Segunda onda (motor comercial)
```sql
proposals
proposal_assets
reservation_requests
reservations
sales
unit_queue
unit_status_history
activity_logs
account_settings
development_settings
materials
```

### Campos críticos de rastreabilidade (toda tabela comercial)
```
account_id        → segregação multi-tenant obrigatória
development_id    → contexto de empreendimento
actor_profile_id  → quem executou a ação
created_at        → timestamp imutável
updated_at        → última atualização
```

---

## 10. CONFIGURAÇÕES POR CLIENTE (ENGINE DE REGRAS)

### account_settings
```typescript
type AccountSettings = {
  accountId: string
  allowBrokerCreateNegotiation: boolean
  allowConsultantCounterProposal: boolean
  reservationApprovalRequired: boolean
  enableUnitQueue: boolean
}
```

### development_settings
```typescript
type DevelopmentSettings = {
  developmentId: string
  reservationExpirationDays: number
  requireFullClientData: boolean
  requireDocumentsForReservation: boolean
}
```

**Todas as regras passam pela engine — nunca espalhadas na UI.**

---

## 11. CONTRATOS DE DADOS (MAPEAMENTO OBRIGATÓRIO)

```
Database Row → DTO → Domain Entity → View Model
```

```typescript
// Database → DTO: snake_case → camelCase, strings → enums, strings → Date
// DTO → Domain: adiciona comportamento (métodos, validações)
// Domain → View: prepara para exibição (labels, cores, aggregações)
```

**Repositórios retornam sempre Domain Entity, nunca Row direto.**

### Interface de repositório (padrão)
```typescript
interface NegotiationRepository {
  findById(id: string): Promise<Negotiation>
  findByDevelopment(developmentId: string): Promise<Negotiation[]>
  create(data: CreateNegotiationInput): Promise<Negotiation>
  updateStatus(id: string, status: NegotiationStatus): Promise<void>
}
```

**Mock e Supabase implementam o mesmo contrato — nunca divergir silenciosamente.**

---

## 12. AUDITORIA E RASTREABILIDADE

Toda ação relevante gera log em `activity_logs`:

```typescript
type AuditLog = {
  id: string
  entity: string        // 'negotiation' | 'proposal' | 'reservation' | 'sale' | 'unit'
  entityId: string
  action: string        // 'created' | 'updated' | 'approved' | 'rejected' | 'expired' | 'cancelled'
  previousValue?: any
  newValue?: any
  userId: string
  userRole: string
  timestamp: string
  accountId: string
  developmentId?: string
}
```

**Logs são imutáveis — nunca editáveis ou deletáveis pela interface.**

---

## 13. ROTAS EXISTENTES

```
/entrar                     → login
/selecionar-empreendimento  → seleção de conta/empreendimento
/                           → dashboard
/negociacoes                → listagem de negociações
/negociacoes/:id            → detalhe da negociação
/clientes                   → gestão de clientes
/corretores                 → gestão de corretores
/imobiliarias               → gestão de imobiliárias
/usuarios                   → gestão de usuários
/configuracoes              → configurações da conta/empreendimento
```

**Novas rotas só se adicionadas com aderência explícita ao roadmap.**

---

## 14. RLS E SEGURANÇA NO SUPABASE

```sql
-- Padrão base de policy
SELECT role FROM profiles WHERE profiles.user_id = auth.uid()

-- Toda linha comercial DEVE ter account_id
-- Toda policy DEVE filtrar por account_id do usuário autenticado
-- user_account_access define quais contas o usuário pode acessar
```

**Antes de qualquer erro de frontend: verificar tabela → colunas → dados → policy → só depois componente.**

---

## 15. PADRÃO DE ESTADOS DE MÓDULO (UI)

Todo módulo usa estes estados:
```
idle | loading | ready | empty | error | mock
```

O estado `mock` é usado APENAS quando explicitamente configurado — nunca como fallback silencioso para erro de banco.

---

## 16. COMO TRABALHAR NESTE PROJETO

### Para cada tarefa:
1. Ler os arquivos relevantes antes de qualquer mudança
2. Identificar o passo seguinte dentro da ordem definida
3. Implementar apenas o necessário para esse passo
4. Preservar nomes, contratos e estruturas já adotados
5. Rodar build ao final
6. Reportar: o que mudou, o que está pronto, o que permanece provisório

### Quando encontrar incoerência:
1. Identificar a divergência
2. Preservar a direção do documento como fonte principal
3. Ajustar implementação ao documento
4. Registrar honestamente o que estava incoerente

### Quando houver erro de tela ligada ao Supabase:
```
1. Verificar se a tabela existe
2. Verificar se as colunas existem
3. Verificar se os dados existem
4. Verificar se a policy/RLS não bloqueia
5. Só depois revisar componente ou hook
```

---

## 17. ORDEM DE PRIORIDADE (NUNCA INVERTER)

```
1. Consistência do fluxo comercial
2. Unidade como ativo operacional
3. Integridade e rastreabilidade
4. Aderência documental
5. Evolução incremental
6. UX operacional
7. Refinamento estético
```

---

## 18. O QUE NÃO ENTRA NO ESCOPO ATUAL

```
app mobile
integrações externas complexas
automações avançadas
comissionamento detalhado
dashboards analíticos sofisticados
white-label avançado
BI completo
refatorações estéticas grandes sem necessidade funcional
```

---

## 19. CRITÉRIO DE QUALIDADE

Uma entrega só é boa se:
- Respeita os documentos estratégicos do projeto
- Não abre desvio de visão de produto
- Não cria retrabalho estrutural
- Não joga regra para a UI
- Não quebra fluxo existente
- Mantém consistência entre mock e Supabase
- Build passa sem erros
- Deixa o próximo passo mais claro

---

*Este arquivo é a fonte de verdade operacional do projeto NEXA para o Claude Code.*
*Versão: 1.0 — gerado em 2026-03-21*
