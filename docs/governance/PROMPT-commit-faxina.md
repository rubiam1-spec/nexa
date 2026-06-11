# PROMPT — Commit seletivo do trabalho de hoje (P1 / P2 / R-07 / docs)

As mudanças de hoje estão no working tree, SEM commit. Objetivo: congelar o código bom em commits temáticos, com build verde antes de cada um. NÃO mexer em comportamento — só organizar e commitar.

Cole no Claude Code (raiz do repo):

```
TAREFA: Commitar as mudanças não commitadas do projeto NEXA em commits temáticos, seguindo a governança (docs/governance/AGENT-RULES.md, TASK-GATE.md).

REGRAS DE COMMIT (obrigatórias):
- NUNCA usar git add . — fazer stage seletivo por arquivo.
- Um commit temático por vez. Rodar `npm run build` (tsc -b && vite build) e confirmar VERDE antes de cada commit.
- Classificar cada arquivo antes do stage: pertence a qual tema? Absorver utilitários/órfãos compartilhados no commit da feature que os consome.
- Mensagens no padrão do repo (feat/fix/chore + escopo).

DIAGNÓSTICO PRIMEIRO:
- Rodar `git status` e `git diff --stat`. Confirme integridade (sem bytes NUL / arquivos truncados) — se algum arquivo aparecer corrompido, PARE e avise (não commitar corrompido).

AGRUPAMENTO SUGERIDO (ajuste conforme o git status real):
1. feat(leads): distribuição de leads por round-robin com peso (P1)
   - migrations de lead_distribution (settings, assign_next_lead_consultant, distribute_lead, REVOKE PUBLIC), supabase/functions/receive-lead/index.ts, e os arquivos de UI/hook/repo da distribuição (painel em Configurações, useLeadDistribution, leadDistributionSupabaseRepository, ação "Distribuir" em Contatos).
2. refactor(documentos): fonte única catálogo + requisitos; deprecar document_type_configs (P2)
   - migrations (trigger seed_documents_for_new_client, seed_client_documents, COMMENT deprecação), clientDocumentsSupabaseRepository.ts, useClientDocuments.ts, ClientDetailPage.tsx, SettingsPage.tsx (painel de checklist), clientsSupabaseRepository.ts (comentário).
3. feat(atividades): corretor visível e editável no detalhe + aviso ao salvar sem corretor (R-07)
   - ActivityDetailModal.tsx, AtividadesPage.tsx.
4. docs(governanca): alinhar CLAUDE.md e AGENT-RULES à realidade (regra em hooks; Supabase-only) (R-04/R-05)
   - CLAUDE.md, docs/governance/AGENT-RULES.md (e outros .md de governança ajustados).

OBSERVAÇÃO sobre arquivos de processo dos robôs (docs/governance/ROBOS-NEXA.md, PLANO-*.md, PROMPT-*.md e .claude/agents/): pergunte ao usuário se quer versioná-los; se sim, um commit separado chore(governanca): ledger e prompts dos robôs. Se não, deixe fora do stage (não apagar).

VALIDAÇÃO: após os commits, `git log --oneline -6` e `git status` limpo (fora os arquivos deixados de propósito). Build verde no último estado. NÃO fazer push/deploy automático — só commit local; o deploy de produção já foi feito hoje.
```
