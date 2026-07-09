# BACKUP — NEXA (mitigação enquanto plano FREE, sem PITR)

> **Status:** mitigação temporária. O Supabase do NEXA está no plano **FREE**, que
> **não tem PITR** (Point-in-Time Recovery) nem backup automático diário. A
> contratação do **Supabase Pro** (que traz PITR) foi **adiada por decisão do
> Rubiam**. Até lá, a janela de risco é coberta por este backup diário
> automatizado e **gratuito** (GitHub Actions), somado aos dumps manuais
> pré-DDL que já fazemos.

---

## 1. O que é

Um workflow do GitHub Actions — [`.github/workflows/backup-diario.yml`](../../.github/workflows/backup-diario.yml) —
que, **todo dia de madrugada**, faz um `pg_dump` do banco de **produção** e guarda
o resultado como **artifact privado** do próprio workflow.

| Item | Valor |
|---|---|
| Agendamento | Cron diário `0 6 * * *` (**06:00 UTC = 03:00 Brasília**, UTC-3) |
| Execução manual | Sim — botão **Run workflow** (`workflow_dispatch`) |
| Ferramenta | `pg_dump` do `postgresql-client-17` (compatível com o Postgres 17 do projeto) |
| Formato | **custom** (`-Fc`), já comprimido, restaurável seletivamente |
| Onde fica o dump | Artifact **privado** do workflow (só quem tem acesso ao repo baixa) |
| Retenção | **30 dias** (depois o GitHub remove automaticamente) |
| Credencial | Lida do **GitHub Secret `SUPABASE_DB_URL`** — nunca no código |
| Falha | O step falha (`set -euo pipefail`) → workflow **vermelho** → GitHub envia e-mail |

**Sem catch silencioso:** qualquer erro no `pg_dump` (credencial errada, banco fora
do ar, arquivo vazio) derruba o workflow de forma visível, para o GitHub notificar.

---

## 2. Passo manual do Rubiam (uma vez só)

O workflow **não funciona** até o secret existir. Faça uma vez:

1. **Pegar a connection string** no dashboard do Supabase:
   - Projeto **NEXA** → **Project Settings** → **Database** → **Connection string**.
   - Escolha a aba **URI**. Use a conexão **direta** (host `db.<ref>.supabase.co`,
     porta **5432**) **ou** o **Session pooler**. **NÃO** use o *Transaction
     pooler* (porta 6543) — ele não suporta `pg_dump`.
   - A string tem o formato:
     `postgresql://postgres:<SUA-SENHA>@db.phpbsiyxwsbzeevqgixk.supabase.co:5432/postgres`
   - Se não lembra a senha do banco, gere uma nova em **Database → Reset database password**
     (isso troca a senha; atualize onde mais ela for usada).

2. **Criar o secret no GitHub:**
   - Repositório → **Settings** → **Secrets and variables** → **Actions** →
     **New repository secret**.
   - **Name:** `SUPABASE_DB_URL`
   - **Secret:** cole a connection string inteira (com a senha).
   - Salvar.

3. **Validar rodando manualmente:**
   - Aba **Actions** → workflow **“Backup diário (pg_dump → artifact)”** →
     **Run workflow** → **Run**.
   - Aguarde ficar **verde**. Abra o run e confirme o artifact `nexa_<data>.dump`
     na seção **Artifacts**. Baixe-o para ter certeza de que abre.

Depois disso, o backup roda sozinho todo dia. Recomenda-se checar 1×/semana se
o run mais recente está verde.

---

## 3. Como restaurar (passo a passo do `pg_restore`)

> Restauração é **destrutiva/perigosa** em produção. Faça sempre para um banco
> **novo/vazio** primeiro (staging ou um projeto Supabase separado) e valide antes
> de considerar sobrescrever produção.

1. **Baixar o dump:** Actions → run desejado → seção **Artifacts** → baixe o
   `nexa_<data>.dump` (vem dentro de um `.zip` do GitHub; descompacte para obter
   o `.dump`).

2. **Ter o cliente 17 instalado** (`pg_restore --version` deve dizer 17.x). No
   Ubuntu, mesmos passos de instalação do workflow; no macOS, `brew install postgresql@17`.

3. **Restaurar para um banco novo** (recomendado):
   ```bash
   # DEST = connection string do banco de destino (novo/vazio)
   pg_restore \
     --no-owner --no-privileges \
     --clean --if-exists \
     --dbname "$DEST" \
     nexa_<data>.dump
   ```
   - `--no-owner --no-privileges`: ignora donos/roles do projeto original (o dump
     já foi gerado assim) — evita erros de role inexistente no destino.
   - `--clean --if-exists`: dropa objetos antes de recriar (idempotente em re-runs).

4. **Restauração seletiva** (só uma tabela, ex. `negotiations`), usando que o
   formato custom permite escolher:
   ```bash
   pg_restore --list nexa_<data>.dump           # ver o índice do dump
   pg_restore --no-owner --no-privileges \
     --data-only --table=negotiations \
     --dbname "$DEST" nexa_<data>.dump
   ```

5. **Conferir:** rode contagens/spot-checks (`SELECT count(*) FROM negotiations;`
   etc.) e valide o app apontando para o destino antes de qualquer decisão sobre
   produção.

**Observação sobre Supabase:** o `pg_dump` acima captura o **schema + dados** das
suas tabelas. Objetos gerenciados pelo Supabase (extensões, `auth`, storage) têm
o próprio ciclo; para um disaster recovery completo do zero, combine este dump
com o schema versionado em `supabase/migrations/`.

---

## 4. Limites conhecidos (por que isto é mitigação, não solução final)

- **Granularidade diária:** perde-se, no pior caso, ~24h de dados (o PITR do Pro
  chega a segundos). Aceito conscientemente até o Pro.
- **Retenção de 30 dias:** artifacts somem depois; se precisar reter mais tempo,
  baixe e arquive manualmente, ou evolua para enviar o dump a um bucket.
- **Depende do secret:** se `SUPABASE_DB_URL` expirar (reset de senha), o workflow
  falha (visivelmente) até o secret ser atualizado.

Quando o **Supabase Pro (PITR)** for contratado, este workflow pode ser mantido
como redundância barata ou desativado — decisão do Rubiam na época.
