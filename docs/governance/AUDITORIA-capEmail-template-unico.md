# AUDITORIA — Capítulo E-mail: template único + migração

**Data:** 2026-07-13 · **Decisão de produto:** Rubiam (protótipo v2 aprovado)
**Cânone:** `supabase/functions/_shared/emailTemplate.ts` — `renderNexaEmail(...)`
reproduz o protótipo `docs/design/PROTO_emails-nexa_v2.html` (tabelas + inline,
fundo claro, cores exatas). 12 testes. **Regra:** best-effort NUNCA silencioso.

## Parte 0 — Inventário

| Origem | Template atual | Idioma | Destino |
|---|---|---|---|
| `send-notification-email` (hub) — propostas, reservas (família), venda, weekly, brokerage, e **fallback** de todos | **tema ESCURO** (`wrap`, bg #12110F), Resend `noreply@nexacomercial.com.br`, assunto `NEXA — {title}` | PT-BR | e-mail do usuário |
| `receive-lead` v9 → `new_lead` | cai no `renderGeneric` (escuro, sem grade) | PT-BR | gestores |
| `invite-user` / `invite-broker` | próprio/hub | PT-BR | convidado |
| `daily-briefing`, `birthday-digest`, `weekly-report` | Resend próprio | PT-BR | — |
| **Recuperação de senha** | `supabase.auth.resetPasswordForEmail()` → **template do Supabase Auth (dashboard)**, provável **EN** | EN | usuário |

### Parte 0.2 — Recuperação de senha (decisão)
Gerada pelo **Auth do Supabase (dashboard)**, sem edge. **Não há código a mudar.**
HTML PT-BR pronto (esqueleto único, com `{{ .ConfirmationURL }}`) em
`docs/governance/email-recovery-ptbr-supabase-dashboard.html` → **Rubiam cola** em
Authentication → Email Templates → **Reset Password**. **A recuperação em inglês
morre aqui.**

## Parte 1 — O esqueleto único (cânone) ✓
`renderNexaEmail({ badge{label,color}, timestamp, title, meta, dataGrid[{label,
value,link?}], highlightBand?{label,value,note}, nextStep?, ctas[{label,url,
primary?}], ruler?, footer{account,development,preferencesUrl} })` → HTML idêntico
ao protótipo. Assunto: `nexaSubject("{evento}: {contexto}")` = "NEXA — …". `esc()`
escapa dado de usuário (anti-injeção). Sem emojis. Largura 560px, logo do Storage,
links absolutos.

## Matriz evento → e-mail (protótipo)

| Evento | Modelo | Badge | Destaque |
|---|---|---|---|
| `new_lead` | **E-mail 1** | NOVO LEAD verde | telefone wa.me, responsável, "Atender agora →", régua de urgência |
| `reservation_approved` (+ família: requested/rejected/expiring, sale) | **E-mail 3** | RESERVA … âmbar | faixa de prazo + consequência (fila promove), partes, próximo passo (checklist real ou omitido) |
| convite de usuário | esqueleto | CONVITE | CTA único |
| digest diário | **E-mail 2** | — | 3 números (novos / sem resposta >2h #C2410C / convertidos) + "Precisam de você" |

## Estado da entrega

- ✅ Cânone `renderNexaEmail` + **15 testes** (verde) — inclui E-mail 2 (stats + lista).
- ✅ Inventário + decisão da recuperação (HTML PT-BR pronto p/ o dashboard).
- ✅ **Marco 1 (código pronto):**
  - `send-notification-email` → migrado ao cânone (todos os tipos; `new_lead`
    E-mail 1 com wa.me + régua; família de reserva/venda E-mail 3 com faixa de
    prazo + próximo passo; convite/demais no esqueleto). Aceita `to_email` p/ teste.
  - `receive-lead` → `new_lead` agora envia **metadata estruturada** (nome, telefone,
    e-mail, origem, campanha, conta, empreendimento, responsável) — best-effort.
  - `daily-lead-digest` (Parte 3, **E-mail 2** "O pulso de hoje") → 1/destinatário/dia,
    3 números (novos / sem resposta >2h #C2410C / convertidos) + "Precisam de você"
    (máx. 5); envia SÓ se houver conteúdo; escopo conta (gestão) × pessoal (consultor/
    corretor). Modo `to_email` p/ teste de renderização.
  - Esqueleto estendido: `stats`, `list`, `badge` opcional (digest sem badge).
- ⏸️ **Marco 2** deploy das edges (rollback anotado) + **TESTE REAL DE RENDERIZAÇÃO**
  (4 exemplares → rubiamcorretor@gmail.com, validar Gmail desktop+celular ANTES do DoD).
- ⏸️ **Marco 3/4** Preferências (Parte 4) — **CHECKPOINT de DDL** (dump-alvo + migration
  aditiva; convite/recuperação IGNORAM preferências) → limpeza de artefatos.

> **Dedup do digest** (1/destinatário/dia) e **agendamento** (pg_cron ~8h) serão
> anexados no checkpoint de DDL (mesma migration das Preferências) para evitar DDL
> avulso agora. Até lá, `daily-lead-digest` computa e envia sob invocação manual.

## Próximos passos (após aprovação de renderização + DDL)
1. Migrar `send-notification-email` para `renderNexaEmail` (todos os tipos) + `new_lead`.
2. Digest por e-mail (irmão do in-app do Cap. A) — 1/destinatário/dia, só se houver conteúdo.
3. Preferências (Config → Notificações): toggles imediatos + digest (DDL aditivo com
   checkpoint; convite/recuperação IGNORAM preferências — transacionais).
4. Deploy das edges (rollback anotado) + teste real de renderização.
