# PROMPT P1 — Distribuição de Leads (round-robin com peso)

Gerado em 2026-06-11. Fatos de banco/edge pré-confirmados via Supabase MCP. Cole o bloco abaixo no Claude Code, na raiz do repo. É uma única execução consolidada.

## Decisões de produto (Rubiam)
- Gatilho: **webhook automático + botão manual** "Distribuir" para contatos sem dono.
- Participantes: **configurável por conta** (quais papéis podem entrar no rodízio).
- **Tela de gestão** em Configurações → Regras Comerciais.

---

```
FEATURE: Distribuição automática de leads por round-robin com peso (P1 do roadmap NEXA).
Projeto: NEXA (React+TS+Vite / Supabase). project_id: phpbsiyxwsbzeevqgixk.
Account Bomm: 16d4b82f-880f-4818-bb07-93c3b606f982. Development Vivendas: 909c1a4a-165b-483f-9ebb-73929c01bf70.

REGRAS DO PROJETO (não violar): regra de negócio fora de componente React; UI não acessa Supabase direto (use hook/RPC); toda operação filtra account_id; autorização valida perfil E user_account_access; numeric vem como string (Number()); profiles.id = auth.users.id; nada de navigate('/') ou reload após salvar; toast de sucesso; modais com createPortal. Deploy front: npm run build && npx vercel deploy --prod --yes. Edge: supabase functions deploy <slug> --no-verify-jwt.

DIAGNÓSTICO OBRIGATÓRIO (rode antes de codar e confirme):
- A tabela public.lead_distribution já existe com: id, account_id, development_id (nullable), consultant_id (NOT NULL), active (bool default true), weight (int default 1), current_count (int default 0), last_assigned_at, created_at. Hoje tem 2 linhas (consultores da Bomm, peso 1).
- A entidade de lead/contato é public.clients. Colunas relevantes: assigned_to (uuid), assigned_by (uuid), assigned_at (timestamptz), assignment_type (text — hoje só 'manual'), consultant_id (uuid), broker_id (uuid), status (text, lead novo = 'new'), temperature (text), development_id (uuid), origin, origin_detail, deleted_at (soft delete), last_interaction_at.
- public.account_settings usa snake_case; já tem queue_enabled (bool) e security_mfa_required_roles (text[]). NÃO há colunas de lead distribution ainda.
- Edge Function public: receive-lead (verify_jwt=false). Hoje cria o client com assigned_to = webhook.default_assigned_to (fixo) e NÃO seta assignment_type nem consultant_id.
- Verifique se lead_distribution tem RLS habilitado e quais policies; verifique os helpers existentes get_user_account_ids() e user_has_role()/ADMIN_ROLES/MANAGER_ROLES no código antes de usar.

PARTE 1 — BANCO (migrations incrementais, uma por tema, nomes únicos):

1.1 account_settings: adicionar configuração por conta.
  ALTER TABLE account_settings ADD COLUMN IF NOT EXISTS lead_distribution_enabled boolean NOT NULL DEFAULT false;
  ALTER TABLE account_settings ADD COLUMN IF NOT EXISTS lead_distribution_eligible_roles text[] NOT NULL DEFAULT ARRAY['commercial_consultant'];
  (lead_distribution_enabled liga/desliga o rodízio; eligible_roles define quais papéis podem ser adicionados ao rodízio.)

1.2 Função de seleção (weighted round-robin), atômica e reutilizável. SECURITY DEFINER, search_path fixo.
  CREATE OR REPLACE FUNCTION public.assign_next_lead_consultant(p_account_id uuid, p_development_id uuid)
  RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  DECLARE v_id uuid;
  BEGIN
    -- escolhe o participante ativo com menor carga relativa (current_count/weight), desempate por menor last_assigned_at
    SELECT consultant_id INTO v_id
    FROM lead_distribution
    WHERE account_id = p_account_id
      AND active = true
      AND (development_id = p_development_id OR development_id IS NULL)
    ORDER BY (current_count::numeric / GREATEST(weight,1)) ASC, last_assigned_at ASC NULLS FIRST, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
    IF v_id IS NULL THEN RETURN NULL; END IF;
    UPDATE lead_distribution
      SET current_count = current_count + 1, last_assigned_at = now()
    WHERE account_id = p_account_id AND consultant_id = v_id
      AND (development_id = p_development_id OR development_id IS NULL);
    RETURN v_id;
  END $$;
  -- só service_role e papéis admin chamam; NÃO conceder a anon
  REVOKE EXECUTE ON FUNCTION public.assign_next_lead_consultant(uuid,uuid) FROM anon;

1.3 RPC para o botão manual (atribui um contato específico sem dono). Valida permissão (owner/director/manager via user_account_access), atribui, loga.
  CREATE OR REPLACE FUNCTION public.distribute_lead(p_client_id uuid)
  RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  DECLARE v_acc uuid; v_dev uuid; v_consultant uuid; v_role text;
  BEGIN
    SELECT account_id, development_id INTO v_acc, v_dev FROM clients WHERE id = p_client_id AND deleted_at IS NULL;
    IF v_acc IS NULL THEN RAISE EXCEPTION 'cliente inexistente'; END IF;
    -- permissão: caller precisa ser owner/director/manager na conta
    SELECT role INTO v_role FROM user_account_access WHERE user_id = auth.uid() AND account_id = v_acc;
    IF v_role IS NULL OR v_role NOT IN ('owner','director','manager') THEN RAISE EXCEPTION 'sem permissão'; END IF;
    v_consultant := assign_next_lead_consultant(v_acc, v_dev);
    IF v_consultant IS NULL THEN RAISE EXCEPTION 'rodízio vazio'; END IF;
    UPDATE clients SET assigned_to = v_consultant, consultant_id = v_consultant,
       assignment_type = 'round_robin', assigned_by = auth.uid(), assigned_at = now()
    WHERE id = p_client_id;
    INSERT INTO activity_logs(entity, entity_id, action, new_value, user_id, account_id, development_id)
    VALUES ('client', p_client_id, 'lead_distributed', jsonb_build_object('consultant_id', v_consultant), auth.uid(), v_acc, v_dev);
    RETURN v_consultant;
  END $$;
  (Confirme as colunas reais de activity_logs antes; ajuste o INSERT ao schema existente — NÃO invente colunas.)

1.4 RLS de lead_distribution: SELECT para membros da conta (account_id IN (select get_user_account_ids())); INSERT/UPDATE/DELETE só para owner/director/manager da conta. Habilite RLS se não estiver. Use (select auth.uid()) nas expressões (boa prática de perf já adotada no projeto).

PARTE 2 — EDGE FUNCTION receive-lead:
  No ponto onde hoje faz assigned_to: webhook.default_assigned_to, trocar pela lógica:
  - Se a conta tem lead_distribution_enabled = true (ler de account_settings) E existe participante ativo: chamar rpc assign_next_lead_consultant(accountId, webhook.default_development_id) via supabase.rpc; usar o retorno como assigned_to + consultant_id, assignment_type='round_robin', assigned_at=now().
  - Senão: manter o comportamento atual (default_assigned_to, assignment_type='manual' quando houver).
  - Preservar dedupe, contact_interactions e atualização de webhook_endpoints. Não quebrar o formato Facebook Lead Ads.
  Deploy: supabase functions deploy receive-lead --no-verify-jwt

PARTE 3 — BOTÃO MANUAL "Distribuir" (módulo Contatos):
  - Criar hook (ex: src/modules/contatos/hooks/useLeadDistribution.ts) que chama supabase.rpc('distribute_lead', { p_client_id }) e trata erro (rodízio vazio / sem permissão) com toast.
  - Na lista de Contatos, para contatos sem assigned_to, mostrar ação "Distribuir" (visível só para owner/director/manager via usePermissions()). Após sucesso: atualizar a linha in-place (sem reload), toast "Lead distribuído ✓".
  - NÃO colocar a regra no componente — só chamar o hook/RPC.

PARTE 4 — TELA DE GESTÃO (Configurações → Regras Comerciais):
  - Seção "Distribuição de Leads": toggle lead_distribution_enabled; multiselect de eligible_roles (papéis que podem entrar); lista dos participantes (lead_distribution) com nome (join profiles), papel, peso (editável), current_count (somente leitura), ativo (toggle); ações adicionar (escolher pessoa elegível pelos eligible_roles), remover; botão "Zerar contadores" (current_count=0) opcional.
  - Acesso só owner/director/manager (usePermissions()). Persistência via hook/repositório, não no componente. Seguir o padrão visual da área admin (sidebar 260px, tokens T.*), zero emojis.

VALIDAÇÃO:
1. Build verde.
2. Com lead_distribution_enabled=true e 2 participantes peso 1: simular 4 leads (via rpc/insert de teste em transação com ROLLBACK) → distribuição alterna ~2 e 2; current_count incrementa; last_assigned_at atualiza.
3. Peso 2 vs 1 → o de peso 2 recebe ~2x mais.
4. Botão manual atribui contato sem dono e bloqueia para broker/consultant (sem permissão).
5. Segregação multi-tenant: conta A não vê/dispõe rodízio da conta B.
6. Webhook com rodízio desligado mantém comportamento antigo (default_assigned_to).

DEPLOY: npm run build && npx vercel deploy --prod --yes ; supabase functions deploy receive-lead --no-verify-jwt
Reporte: migrations aplicadas, arquivos alterados, resultado das validações, o que ficou provisório.
```

## O que testar depois (você)
Criar um webhook de teste, ligar o rodízio em Configurações, mandar 3–4 leads e ver alternando entre os consultores; depois testar o botão "Distribuir" num contato sem dono.
