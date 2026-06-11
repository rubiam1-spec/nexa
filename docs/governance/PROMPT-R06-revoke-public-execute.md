# PROMPT R-06 — Fechar EXECUTE público das funções de distribuição de leads

Achado da verificação dos robôs (R-20260611-06). As funções `assign_next_lead_consultant` e `distribute_lead` continuam executáveis por `anon`/`authenticated` porque o `EXECUTE` vem do grant default a `PUBLIC` — o `REVOKE FROM anon, authenticated` aplicado antes foi inócuo. Risco real: `assign_next_lead_consultant` não tem trava interna e poderia ser chamada direto por um usuário autenticado.

Cole no Claude Code (raiz do repo):

```
TAREFA: Correção de segurança (somente SQL, sem frontend). Projeto NEXA / Supabase project_id phpbsiyxwsbzeevqgixk.

DIAGNÓSTICO (confirme antes):
- SELECT p.proname, p.proacl::text, has_function_privilege('anon',p.oid,'EXECUTE') anon, has_function_privilege('authenticated',p.oid,'EXECUTE') auth
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN ('assign_next_lead_consultant','distribute_lead');
  Esperado AGORA: acl com `=X/postgres` (grant a PUBLIC) e anon/auth = true. Esse é o problema.

MIGRATION (nome único, ex: sec_revoke_public_execute_lead_dist):
  REVOKE EXECUTE ON FUNCTION public.assign_next_lead_consultant(uuid, uuid) FROM PUBLIC;
  REVOKE EXECUTE ON FUNCTION public.distribute_lead(uuid) FROM PUBLIC;
  -- garantir os grants legítimos (idempotente):
  GRANT EXECUTE ON FUNCTION public.distribute_lead(uuid) TO authenticated;        -- a UI chama como usuário logado (a função já checa owner/director/manager internamente)
  GRANT EXECUTE ON FUNCTION public.assign_next_lead_consultant(uuid, uuid) TO service_role; -- o edge receive-lead usa service_role
  -- NÃO conceder assign_next_lead_consultant a authenticated/anon: ela só deve rodar via distribute_lead (SECURITY DEFINER, owner postgres) ou service_role.

POR QUE FUNCIONA:
- distribute_lead é SECURITY DEFINER (owner postgres), então chama assign_next_lead_consultant como postgres — independe de grant a authenticated.
- O edge function usa service_role, que mantém EXECUTE.
- anon perde acesso às duas; authenticated perde acesso direto a assign_next_lead_consultant mas mantém distribute_lead (com a trava de papel).

VALIDAÇÃO:
1. Reexecutar o SELECT do diagnóstico:
   - assign_next_lead_consultant: anon=false, auth=false.
   - distribute_lead: anon=false, auth=true.
2. Rodar o advisor de segurança e confirmar que essas 2 funções não aparecem mais em anon/authenticated_security_definer_function_executable.
3. Sanidade do fluxo (em transação com ROLLBACK): chamar distribute_lead como um owner/manager continua atribuindo; o edge (service_role) continua distribuindo.

Não precisa de deploy de frontend (mudança só de privilégio no banco). Reporte o antes/depois do SELECT e do advisor.
```
