-- Sistema de conferência e andamento de clientes aprovados para financiamento imobiliário

create extension if not exists "pgcrypto";

-- Perfis dos usuários da equipe (espelha auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  created_at timestamptz not null default now()
);

-- Empreendimentos (obras/lançamentos)
create table if not exists empreendimentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  endereco text,
  incorporadora text,
  created_at timestamptz not null default now()
);

-- Etapas do fluxo de financiamento (ordenadas)
create table if not exists etapas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem int not null unique,
  cor text not null default '#64748b'
);

-- Clientes aprovados em acompanhamento
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf text,
  telefone text,
  email text,
  empreendimento_id uuid references empreendimentos(id) on delete set null,
  unidade text,
  banco_financiador text,
  valor_financiado numeric,
  corretor_responsavel_id uuid references profiles(id) on delete set null,
  etapa_atual_id uuid references etapas(id) on delete set null,
  observacoes text,
  arquivado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Histórico de andamento (log de mudança de etapa)
create table if not exists andamento_historico (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  etapa_id uuid references etapas(id) on delete set null,
  observacao text,
  usuario_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_clientes_etapa on clientes(etapa_atual_id);
create index if not exists idx_clientes_empreendimento on clientes(empreendimento_id);
create index if not exists idx_historico_cliente on andamento_historico(cliente_id);

-- updated_at automático em clientes
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_clientes_updated_at on clientes;
create trigger trg_clientes_updated_at
  before update on clientes
  for each row execute function set_updated_at();

-- Cria o profile automaticamente quando um usuário se cadastra no Supabase Auth
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email), new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Etapas padrão do fluxo de financiamento imobiliário
insert into etapas (nome, ordem, cor) values
  ('Cadastro enviado ao banco', 1, '#94a3b8'),
  ('Análise de crédito', 2, '#60a5fa'),
  ('Avaliação do imóvel', 3, '#818cf8'),
  ('Análise jurídica e documental', 4, '#a78bfa'),
  ('Assinatura de contrato', 5, '#f59e0b'),
  ('Registro em cartório', 6, '#fb923c'),
  ('Liberação do recurso', 7, '#34d399'),
  ('Concluído', 8, '#22c55e')
on conflict (ordem) do nothing;

-- RLS: equipe autenticada tem acesso completo
alter table profiles enable row level security;
alter table empreendimentos enable row level security;
alter table etapas enable row level security;
alter table clientes enable row level security;
alter table andamento_historico enable row level security;

drop policy if exists "profiles_select_auth" on profiles;
create policy "profiles_select_auth" on profiles for select to authenticated using (true);
drop policy if exists "profiles_update_self" on profiles;
create policy "profiles_update_self" on profiles for update to authenticated using (auth.uid() = id);

drop policy if exists "empreendimentos_all_auth" on empreendimentos;
create policy "empreendimentos_all_auth" on empreendimentos for all to authenticated using (true) with check (true);

drop policy if exists "etapas_all_auth" on etapas;
create policy "etapas_all_auth" on etapas for all to authenticated using (true) with check (true);

drop policy if exists "clientes_all_auth" on clientes;
create policy "clientes_all_auth" on clientes for all to authenticated using (true) with check (true);

drop policy if exists "historico_all_auth" on andamento_historico;
create policy "historico_all_auth" on andamento_historico for all to authenticated using (true) with check (true);
