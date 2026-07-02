# Processo de Deploy — NEXA (Fase 3 — Etapa 9)

> Objetivo: **produção sempre builda a partir do git (branch de produção), nunca da
> árvore de trabalho local.** Isto elimina o "stash dance" e torna impossível vazar
> WIP não-commitado para produção.

## Estado da integração (confirmado em 2026-07-02)
- Projeto Vercel `nexa` (`prj_xGNVOgj4BKSo2Xk3Xclwx9V8fqAk`, team `rubiam1-6400s-projects`).
- **Integração Git ATIVA** com `github.com/rubiam1-spec/nexa`: todo push de branch já
  gera um **Preview** automático (aliases `nexa-git-<branch>-...vercel.app`).
- Domínio de produção: `app.nexacomercial.com.br`.
- Framework: Vite. Node 24.x.

## Regra de ouro
1. **Produção = push/merge na branch de produção** (`main`). O build de produção é
   disparado pela Vercel a partir do commit no git — **nunca** de `vercel deploy --prod`
   rodado na árvore local.
2. **Proibido** `vercel deploy --prod` a partir de uma branch de feature ou com WIP na
   árvore. (Era a causa do "stash dance": subia arquivos não-commitados, com risco de
   vazar o WIP do importador para produção.)
3. **Preview** é automático: qualquer push de branch → deploy de preview. Use o preview
   para validar antes de promover.

## Configuração a confirmar no dashboard (uma vez)
Vercel → Project `nexa` → **Settings → Git**:
- **Production Branch = `main`.** (Verificar/definir — o MCP não expõe esse campo.)
- Garantir que "Automatically expose System Environment Variables" e o build command
  (`npm run build`) estão corretos (já vêm do framework Vite).

## Fluxo de trabalho
### Feature
1. Branch a partir de `main`: `git checkout -b feat/<nome>`.
2. Commits pequenos; push → gera **preview** automático.
3. Abrir PR para `main`. Validar no preview.
4. Merge do PR → **deploy de produção automático**.

### Hotfix (produção quebrada)
1. **Nunca** nasce de uma branch de feature. Branch a partir de `main`:
   `git checkout main && git pull && git checkout -b hotfix/<nome>`.
2. Corrigir, PR para `main`, merge → produção sai automática.
3. (Se precisar de urgência sem PR, merge direto em `main` com push — mas o build ainda
   vem do git, não da árvore local.)

### WIP / trabalho não-commitado
- Como produção só builda do commit no git da branch de produção, **WIP não-commitado
  nunca vai para produção** — sem necessidade de `git stash` antes de deploy.

## Edge Functions (fora da Vercel)
As Edge Functions do Supabase **não** são deployadas pela Vercel. Alterou uma function?
Deploy separado:
```
supabase functions deploy <nome> --no-verify-jwt
```
(Pendente: `daily-briefing` e `intelligence-alerts` — alteradas na auditoria M11.)

## Migrations (fora da Vercel)
Migrations de banco são aplicadas via Supabase (CLI `supabase db push` ou MCP
`apply_migration`), **não** pela Vercel. Toda mudança de schema tem migration
correspondente em `supabase/migrations/`.

## Situação atual da branch de trabalho
`feat/atividades-mobile-onda1` acumulou: ondas de Atividades, correção crítica de
status, auditoria (Fases 1–3) e o WIP do importador (não-commitado). Para adotar este
fluxo: fazer o merge do que está pronto em `main` (via PR), confirmar `main` como
Production Branch, e a partir daí produção sai por git — sem mais `--prod` local.
