-- Legenda de cores por empreendimento (para importação do espelho de vendas) e
-- histórico de alterações da unidade (status/cor mudam a cada nova importação)

create table if not exists legendas_cores (
  id uuid primary key default gen_random_uuid(),
  empreendimento_id uuid not null references empreendimentos(id) on delete cascade,
  cor text not null,
  status text not null,
  created_at timestamptz not null default now(),
  unique (empreendimento_id, cor)
);

create index if not exists idx_legendas_cores_empreendimento on legendas_cores(empreendimento_id);

alter table legendas_cores enable row level security;
drop policy if exists "legendas_cores_all_auth" on legendas_cores;
create policy "legendas_cores_all_auth" on legendas_cores for all to authenticated using (true) with check (true);

create table if not exists historico_unidades (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references unidades(id) on delete cascade,
  campo text not null,
  valor_anterior text,
  valor_novo text,
  usuario_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_historico_unidades_unidade on historico_unidades(unidade_id);

alter table historico_unidades enable row level security;
drop policy if exists "historico_unidades_select_auth" on historico_unidades;
create policy "historico_unidades_select_auth" on historico_unidades for select to authenticated using (true);

create or replace function log_alteracoes_unidade()
returns trigger as $$
declare
  campos text[] := array['status', 'cor_legenda', 'numero'];
  campo text;
  valor_antigo text;
  valor_novo text;
begin
  foreach campo in array campos loop
    execute format('select ($1).%I::text, ($2).%I::text', campo, campo)
      into valor_antigo, valor_novo
      using old, new;

    if valor_antigo is distinct from valor_novo then
      insert into historico_unidades (unidade_id, campo, valor_anterior, valor_novo, usuario_id)
      values (new.id, campo, valor_antigo, valor_novo, auth.uid());
    end if;
  end loop;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_log_alteracoes_unidade on unidades;
create trigger trg_log_alteracoes_unidade
  after update on unidades
  for each row execute function log_alteracoes_unidade();
