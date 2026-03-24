# NEXA

Velocidade para vender. Controle para crescer.

## Stack

- React 19
- TypeScript
- Vite
- React Router
- Supabase Auth + PostgreSQL

## Build

```bash
npm install
npm run build
```

O build de producao gera os arquivos em `dist/`.

## Variaveis de ambiente

Copie `.env.example` para `.env` e preencha:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_ENABLE_MOCK_FALLBACK=false
```

### Obrigatorias para ambiente online

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Opcional

- `VITE_ENABLE_MOCK_FALLBACK`
  - `false` recomendado para homologacao/producao
  - `true` apenas para desenvolvimento local controlado

## Deploy recomendado

O projeto esta pronto para deploy simples na Vercel.

### Configuracao

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- Node install command: padrao da Vercel

### Rotas SPA

O arquivo `vercel.json` ja aplica rewrite global para `index.html`, necessario para:

- `/entrar`
- `/selecionar-empreendimento`
- `/negociacoes`
- `/negociacoes/:id`
- demais rotas do app

## Checklist de publicacao

1. Criar projeto na Vercel e conectar este repositorio.
2. Configurar as variaveis:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ENABLE_MOCK_FALLBACK=false`
3. Garantir que o schema SQL do projeto foi aplicado no Supabase.
4. Garantir que as policies/RLS necessarias foram aplicadas.
5. Publicar.
6. Validar:
   - login real
   - selecao de conta
   - selecao de empreendimento
   - `/negociacoes`
   - `/negociacoes/:id`
   - dashboard

## Observacoes operacionais

- Se o Supabase nao estiver configurado e `VITE_ENABLE_MOCK_FALLBACK=false`, o app vai falhar de forma explicita em vez de entrar em mock silencioso.
- O fallback mock continua disponivel apenas quando explicitamente habilitado.
