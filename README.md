# Gestão de Financiamento

Sistema de conferência e andamento de clientes aprovados para financiamento imobiliário. Acompanhe cada cliente desde a aprovação de crédito até a liberação do recurso, com histórico de etapas e responsáveis.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS
- [Supabase](https://supabase.com) (Postgres + Auth) como backend

## Configuração inicial

### 1. Criar o projeto no Supabase

1. Crie uma conta gratuita em [supabase.com](https://supabase.com) e crie um novo projeto.
2. No painel do projeto, vá em **SQL Editor** e execute o conteúdo do arquivo [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). Isso cria as tabelas, as etapas padrão do fluxo e as políticas de acesso.
3. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**.

### 2. Variáveis de ambiente

Copie `.env.local.example` para `.env.local` e preencha com os dados do passo anterior:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-publica
```

### 3. Criar os usuários da equipe

No painel do Supabase, vá em **Authentication → Users → Add user** e crie um usuário (e-mail/senha) para cada pessoa da equipe que vai acessar o sistema. Um perfil (`profiles`) é criado automaticamente para cada novo usuário.

### 4. Rodar localmente

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) e entre com um dos usuários criados no passo 3.

## Fluxo de etapas

O fluxo padrão (editável na tabela `etapas`) é:

1. Cadastro enviado ao banco
2. Análise de crédito
3. Avaliação do imóvel
4. Análise jurídica e documental
5. Assinatura de contrato
6. Registro em cartório
7. Liberação do recurso
8. Concluído

## Deploy

O jeito mais simples é publicar no [Vercel](https://vercel.com/new): conecte o repositório e adicione as mesmas variáveis de ambiente (`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`) nas configurações do projeto.
