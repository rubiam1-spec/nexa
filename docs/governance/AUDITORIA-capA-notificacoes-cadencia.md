# AUDITORIA — Capítulo A: o sininho virou ruído (negotiation_stale)

**Data:** 2026-07-11 · **Decisão de produto:** Rubiam + arquiteto
**Objetivo:** a notificação de cadência repetia diariamente para as MESMAS
negociações, com nome vazio ("Cliente ()"), enterrando as urgentes (new_lead,
reservation_requested). Silenciar o ruído sem perder o sinal.

---

## Diagnóstico (verdade do banco via MCP + código)

`notifications` (225 registros):

| type | total | não lidas | "nome vazio" | período |
|---|---|---|---|---|
| **negotiation_stale** | **170** | **89** | **48** | 13/04 → 11/07 (diário) |
| activity_reminder | 24 | 7 | 0 | — |
| demais (ação) | ≤10 cada | — | 0 | — |

**Produtor — e NÃO é edge function.** O único gerador de `negotiation_stale` é o
hook **client-side** `src/shared/hooks/useCadenceAlerts.ts` (roda quando um
manager/director abre o app). As edges `daily-briefing`/`intelligence-alerts`
**não** produzem esse tipo (grep do literal só retornou o hook + telas de
exibição). Nenhuma edge foi alterada neste ciclo.

**Bug 1 — nome vazio "()"** (`useCadenceAlerts.ts:115`, versão antiga):
```
message: `${cl?.name || "Cliente"} (${un ? `Q${un.quadra}/L${un.lote}` : ""}) sem atividade há ${days} dias.`
```
Sem unidade (`un` null) → renderiza `Cliente ()`. Os 48 casos são negociações sem
unidade. Mesmo padrão latente em `reservation_expiring` (linha 130).

**Bug 2 — metralhadora** (`useCadenceAlerts.ts:110-111`, versão antiga): a
supressão era **por conta/dia** (`existingStale` = existe QUALQUER stale da conta
criado hoje?). Cada novo dia sem registro → inseria um **lote** de até 10 para as
mesmas negociações. Sem supressão por não-lido, sem cooldown → 170 em ~90 dias.

---

## Correções (código — app, deploy pelo rito git)

**1. Nome NUNCA vazio** — helper único e testado
`src/shared/notifications/notificationSubject.ts`:
- cliente + unidade → `Fulano · Q4·L14`
- só cliente → `Fulano`
- **cliente ausente + unidade → `Sem cliente · Q4·L14`**
- ausente + sem unidade → `Negociação #1a2b3c4d` (código)
- nada → `Sem cliente`
- **Proibido `()`**: teste varre todas as combinações contra `/\(\s*\)/`.
Aplicado ao `stale` (via digest) e ao `reservation_expiring`.

**2. Fim da metralhadora — supressão** (`staleDigest.ts`, constantes nomeadas):
- `STALE_TYPE = "negotiation_stale"`, `STALE_COOLDOWN_DAYS = 7`.
- `shouldSuppressStale(last, now)`: sem histórico → cria; **não lido → suprime**;
  lido dentro de 7d → suprime; lido além de 7d → pode recriar.
- **Âncora do cooldown = `created_at`** (a tabela `notifications` **não tem
  `read_at`; decisão: sem DDL neste ciclo**). Trade-off documentado: mede 7 dias
  desde a criação da última, gated em lida — suficiente para matar o ruído sem
  alterar schema.

**3. Digest diário** (`buildStaleDigest`): UMA notificação por destinatário —
`"N negociações paradas — a mais antiga há Xd (assunto)."`, `title
"Negociações paradas"`, `action_url` = `/negociacoes?view=kanban`.
- **Decisão de action_url:** o Kanban já sinaliza visualmente os cards "fora do
  ritmo" (badge via `thresholdDays`); não há filtro por URL dedicado. Para não
  estourar escopo, o digest leva ao Kanban (sinal visual já existe); um filtro
  `?ritmo=` dedicado fica como candidato futuro.

**4. Urgentes intactos:** `activity_reminder`, `reservation_expiring` e demais
tipos de AÇÃO seguem individuais e imediatos (teste de invariância de fonte).

**Prova de digest real (dados de produção, 2026-07-11, conta 16d4b82f):** as 2
negociações paradas têm `client_name = NULL` (exatamente o caso que dava
"Cliente ()"). Pela função real `buildStaleDigest`:
```
Sem cliente · Q1·L6
Negociação #99862a29
DIGEST: "2 negociações paradas — a mais antiga há 8d (Sem cliente · Q1·L6)."   ← sem "()"
```

---

## Limpeza do passado (DADOS — aguarda checkpoint humano; NÃO executado)

89 `negotiation_stale` não lidas são o passivo do ruído. Plano guardado:

**Dump-alvo ANTES** (salvaguarda):
```sql
-- Guardar as linhas que serão tocadas, para rollback
select id, recipient_id, account_id, title, message, read, created_at
from notifications where type='negotiation_stale' and read=false;
```

**UPDATE idempotente** — marcar como lidas as `negotiation_stale` não lidas
SUPERSEDIDAS, mantendo a **mais recente por destinatário** (o digest é por
destinatário; granularidade por-negociação foi substituída):
```sql
with ranked as (
  select id, row_number() over (
    partition by recipient_id order by created_at desc
  ) as rn
  from notifications
  where type='negotiation_stale' and read=false
)
update notifications set read=true
where id in (select id from ranked where rn > 1);
```
- Idempotente (re-rodar não muda nada: já lidas saem do conjunto).
- Guarda `read=false` no filtro. Mantém a mais recente de cada destinatário
  (para o sino não ficar "zerado à força"; a próxima passagem do produtor
  reconcilia com o digest).

**Checkpoint:** ÚLTIMO passo do ciclo. Só executa com **"GO" do Rubiam**.

---

## DoD

- tsc 0 · `check:contracts` 9/9 · suíte **949** (+21 novos) · build verde.
- Testes: `notificationSubject` (nome nunca vazio / proibido "()"), `staleDigest`
  (digest, singular/plural, código na falta), `shouldSuppressStale` (não-lido +
  cooldown 7d), invariantes de fonte (urgentes intactos).
- Deploy: app pelo rito git (push feat→main). Edge functions: **nenhuma alterada**.

## Deploy + prova de bundle (2026-07-11)

- Push ff sem squash `d46c81b..26e9301` → `main`.
- **`dpl_EJuP3tTE1aHYhqkLXJjXhTCvizXZ` READY**, target production, sha `26e9301`,
  aliasado a `app.nexacomercial.com.br`.
- **Prova de bundle** (`/assets/index-BASjlDYa.js`):
  ```
  "a mais antiga há"    → 1×   (template do digest)
  "Negociações paradas" → 2×   (título)
  "Sem cliente"         → 3×   (fallback do notificationSubject)
  minificado: ${a} — a mais antiga há ${r}d (${i}).   ← buildStaleDigest
  ```
- Sem DDL. Rollback = instant rollback p/ `dpl_7CRSY8s9` (`d46c81b`) ou revert do range.
