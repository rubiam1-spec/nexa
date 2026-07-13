# AUDITORIA — L2.2: receive-lead v6 (ingestão multicanal) — NO PORTÃO

**Data:** 2026-07-13 · **Decisão de produto:** Rubiam + arquiteto
**Risco:** MÁXIMO (a artéria dos leads pagos da Bomm). Rito reforçado + portão.

## Diagnóstico (código escrito, NADA deployado ainda)

- **Produção roda a v7** (Edge ACTIVE) — e a v7 **NÃO** tem bloco de notificação
  (o WIP local com notif nunca foi deployado). Base da v6 = v7 (verdade de
  produção); "fluxo pós-criação" preservado = interaction + increment + return.
- **Canal identificado por `api_key` plaintext** (header `x-api-key`, `?key=`, e
  agora também `body.google_key` para o Google). `api_key_encrypted` não é usada.
- **webhook_events** confirmado (account_id NOT NULL; endpoint_id/client_id/error nullable).
- **Google Lead Form** (payload oficial): `lead_id`, `user_column_data[]`
  (FULL_NAME/PHONE_NUMBER/EMAIL...), `google_key`, `is_test`.

## Arquitetura da v6 (implementada em `supabase/functions/receive-lead/index.ts`)

1. Resolve canal por api_key → 401 se inválida.
2. **LOG BRUTO PRIMEIRO** (`webhook_events` status='received', raw_payload completo).
   Qualquer falha pós-log → `status='failed'`+error e **200** (payload reprocessável).
   4xx só p/ chave inválida ou payload ilegível. **Nunca perde lead.**
3. **Adaptador** (`_shared/leadAdapters.ts`, PURO/testado): `generic`/`landing_page`
   = contrato v7 (zero mudança); `google_lead_form` = mapeia user_column_data +
   valida `google_key` contra api_key + `is_test` → registra 'processed' sem criar
   client; pontes (meta/tiktok/linkedin/taboola) = generic + field_mapping.
4. **Idempotência:** dedupe v7 (telefone/email) + dedupe por `raw_payload->>lead_id`
   já 'processed' no mesmo canal → 'duplicate', sem criar client.
5. **Origem/campanha:** `origin` = slug do canal; `campaign_id` = lead_campaigns
   ativa com `utm_campaign_match` = utm_campaign (case-insensitive); sem match → null.
6. **Distribuição por `distribution_mode`:** fixed → default_assigned_to
   ('auto_fixed'); round_robin → assign_next_lead_consultant, nulo (vazia/pausada/
   desligada) → fallback_assigned_to ('auto_fallback', nota no evento); unassigned → sem dono.
7. Fecha o log ('processed', client_id).

**Testes (antes do deploy):** `src/test/__tests__/leadAdapters.test.ts` — 7 casos do
adaptador (Google oficial + is_test + generic + field_mapping + Facebook inline +
helpers). tsc 0 · suíte 991 · build 0.

## ⚠️ DECISÃO NECESSÁRIA — o RPC não respeita `paused`

`assign_next_lead_consultant` filtra só `active = true`. O `paused` (L2.1) **não é
considerado** → um participante pausado ainda seria escolhido, quebrando a
validação #1 (pausar um → vai para o outro). Patch **aditivo mínimo** proposto
(1 linha no WHERE), a aplicar JUNTO do deploy da função (mesma janela de risco):

```sql
CREATE OR REPLACE FUNCTION public.assign_next_lead_consultant(p_account_id uuid, p_development_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE v_id uuid;
BEGIN
  SELECT consultant_id INTO v_id FROM lead_distribution
  WHERE account_id = p_account_id AND active = true AND paused = false   -- << única mudança
    AND (development_id = p_development_id OR development_id IS NULL)
  ORDER BY (current_count::numeric / GREATEST(weight,1)) ASC, last_assigned_at ASC NULLS FIRST, created_at ASC
  LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF v_id IS NULL THEN RETURN NULL; END IF;
  UPDATE lead_distribution SET current_count = current_count + 1, last_assigned_at = now()
  WHERE account_id = p_account_id AND consultant_id = v_id AND (development_id = p_development_id OR development_id IS NULL);
  RETURN v_id;
END $function$;
```

## Segurança da chave (registrado como L2.3)
Hash da api_key **NÃO** entra agora (mudar a validação da artéria junto eleva risco).
L2.3 = dual-read (plaintext + hash), migrar, remover plaintext.

## ✅ EXECUTADO (2026-07-13, backup verde confirmado por Rubiam)

- **Patch do RPC** `assign_next_lead_consultant` (`AND paused = false`) aplicado
  (migration `l2_2_assign_next_lead_consultant_respect_paused`). Original salvo em
  `rollback-receive-lead-v7-pre-L2.2.md`.
- **Deploy** da função v6 (Supabase Edge **version 9**, ACTIVE, verify_jwt=false).
  Rollback = redeployar o v7 do doc de rollback.
- **Canal de TESTE** Google criado + **E2E** (curl):
  - Google OK → client criado, origin `google_ads`, **campanha casou** (case-insensitive
    `l22-camp-test`→`L22-CAMP-TEST`), evento `processed`.
  - Duplicado (mesmo `lead_id`) → `dedupe:lead_id`, evento `duplicate`, sem client.
  - `is_test` → sem client, evento `processed`(google_test).
  - Chave inválida → **HTTP 401** (sem log).
- **CORREÇÃO DA REGRESSÃO L1 (causa-raiz achada):** a tabela `notifications` **não
  tem coluna `metadata`** — o insert de `new_lead` a incluía e falhava
  silenciosamente (por isso 0 notificações em prod). Removido o `metadata`; após o
  redeploy (v6.1), o lead OK inseriu **5 notificações `new_lead`** (concierge/owner/
  director/manager) — regressão corrigida e verificada.
- **Regressão Bomm** (controlada): curl no canal real "Landing Vivendas do Bosque"
  (generic/landing_page/fixed) → client **atribuído a Gabrielly Truilho**
  (`auto_fixed`), evento `processed`, origin `landing_page`. Path Bomm intacto na v6.
- **Limpeza:** todos os artefatos de teste removidos (clients/eventos/notificações/
  campanha/canal); Bomm restaurada a 12 recebidos; 0 `new_lead` residual.

## Segurança da chave (registrado como L2.3)
Hash da api_key **NÃO** entra agora. L2.3 = dual-read (plaintext + hash), migrar, remover plaintext.
