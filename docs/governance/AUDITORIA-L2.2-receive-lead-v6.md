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

## PORTÃO — aguardando "Backup diário confirmado verde?" (SIM explícito)
Só com SIM: (1) criar canal de TESTE Google via wizard (não tocar na Bomm);
(2) [se aprovado] aplicar o patch do RPC; (3) deploy da função (rollback:
redeployar `rollback-receive-lead-v7-pre-L2.2.md`); (4) E2E no canal de teste
(google ok / duplicado / is_test / chave inválida); (5) **regressão Bomm** (landing
real → Gabrielly, evento 'processed'); (6) desativar o canal de teste. Só então concluir.
