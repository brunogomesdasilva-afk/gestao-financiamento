-- Torres e unidades (espelho de vendas) dos empreendimentos

create table if not exists torres (
  id uuid primary key default gen_random_uuid(),
  empreendimento_id uuid not null references empreendimentos(id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now(),
  unique (empreendimento_id, nome)
);

create table if not exists unidades (
  id uuid primary key default gen_random_uuid(),
  torre_id uuid not null references torres(id) on delete cascade,
  numero text not null,
  status text not null default 'DISPONIVEL',
  cor_legenda text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (torre_id, numero)
);

create index if not exists idx_torres_empreendimento on torres(empreendimento_id);
create index if not exists idx_unidades_torre on unidades(torre_id);
create index if not exists idx_unidades_status on unidades(status);

drop trigger if exists trg_unidades_updated_at on unidades;
create trigger trg_unidades_updated_at
  before update on unidades
  for each row execute function set_updated_at();

-- Substitui o campo de texto livre "unidade" em clientes por um vínculo real com a unidade
alter table clientes add column if not exists unidade_id uuid references unidades(id) on delete set null;
alter table clientes drop column if exists unidade;

create index if not exists idx_clientes_unidade on clientes(unidade_id);

alter table torres enable row level security;
alter table unidades enable row level security;

drop policy if exists "torres_all_auth" on torres;
create policy "torres_all_auth" on torres for all to authenticated using (true) with check (true);

drop policy if exists "unidades_all_auth" on unidades;
create policy "unidades_all_auth" on unidades for all to authenticated using (true) with check (true);
