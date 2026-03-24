# Sprint 1 - Checklist de Homologacao Real

## Cadeia de contexto
- [ ] `VITE_SUPABASE_URL` configurado
- [ ] `VITE_SUPABASE_ANON_KEY` configurado
- [ ] usuario consegue autenticar via Supabase Auth
- [ ] existe `profile` valido para o `auth.user.id`
- [ ] `profiles.status` existe e retorna `active` ou `inactive`
- [ ] usuario possui pelo menos um registro em `user_account_access`
- [ ] a conta ativa carrega sem fallback mock
- [ ] a conta ativa possui pelo menos um `development`
- [ ] o empreendimento ativo carrega sem fallback mock

## Cadastros base
- [ ] `clients` responde por `account_id`
- [ ] `brokers` responde por `account_id`
- [ ] `brokerages` responde por `account_id`
- [ ] `users` responde por `user_account_access.account_id` com join em `profiles`
- [ ] `units` responde por `account_id` e `development_id`

## Estados esperados na UI
- [ ] loading aparece durante carregamento real
- [ ] empty aparece quando nao ha dados
- [ ] error aparece quando ha falha de query, schema ou policy
- [ ] mock aparece apenas quando o ambiente ou a sessao estao explicitamente em mock

## RLS minima
- [ ] `profiles` legivel pelo usuario autenticado conforme policy definida
- [ ] `user_account_access` legivel para listar contas acessiveis
- [ ] `developments` legivel por `account_id`
- [ ] `clients` legivel por `account_id`
- [ ] `brokers` legivel por `account_id`
- [ ] `brokerages` legivel por `account_id`
- [ ] `units` legivel por `account_id` e `development_id`
