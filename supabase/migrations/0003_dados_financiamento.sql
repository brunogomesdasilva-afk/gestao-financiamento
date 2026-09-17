-- Dados detalhados do financiamento por cliente/unidade + histórico de alterações de campo

create table if not exists modalidades_financiamento (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ordem int not null
);

insert into modalidades_financiamento (nome, ordem) values
  ('SBPE', 1),
  ('FGTS', 2),
  ('Pró-Cotista', 3),
  ('Minha Casa Minha Vida (MCMV)', 4),
  ('Consórcio', 5),
  ('Recursos próprios', 6),
  ('Outro', 7)
on conflict (nome) do nothing;

alter table clientes rename column valor_financiado to financiamento_contratado;

alter table clientes add column if not exists agencia_financiamento text;
alter table clientes add column if not exists modalidade_financiamento_id uuid references modalidades_financiamento(id) on delete set null;
alter table clientes add column if not exists fgts_contratado numeric;
alter table clientes add column if not exists fgts_atualizacao numeric;
alter table clientes add column if not exists valor_aprovado numeric;
alter table clientes add column if not exists terreno numeric;
alter table clientes add column if not exists seguro numeric;
alter table clientes add column if not exists escritura numeric;
alter table clientes add column if not exists validade date;
alter table clientes add column if not exists analista_responsavel_id uuid references profiles(id) on delete set null;

alter table clientes drop column if exists diferenca_aprovacao_contratado;
alter table clientes add column diferenca_aprovacao_contratado numeric
  generated always as (coalesce(valor_aprovado, 0) - coalesce(financiamento_contratado, 0)) stored;

create index if not exists idx_clientes_analista on clientes(analista_responsavel_id);

alter table modalidades_financiamento enable row level security;
drop policy if exists "modalidades_select_auth" on modalidades_financiamento;
create policy "modalidades_select_auth" on modalidades_financiamento for select to authenticated using (true);

-- Histórico de alterações de campo (quem mudou o quê e quando), separado do histórico narrativo da esteira
create table if not exists historico_alteracoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  campo text not null,
  valor_anterior text,
  valor_novo text,
  usuario_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_historico_alteracoes_cliente on historico_alteracoes(cliente_id);

alter table historico_alteracoes enable row level security;
drop policy if exists "historico_alteracoes_select_auth" on historico_alteracoes;
create policy "historico_alteracoes_select_auth" on historico_alteracoes for select to authenticated using (true);

create or replace function log_alteracoes_cliente()
returns trigger as $$
declare
  campos text[] := array[
    'nome', 'cpf', 'telefone', 'email', 'unidade_id', 'banco_financiador',
    'agencia_financiamento', 'modalidade_financiamento_id', 'fgts_contratado',
    'financiamento_contratado', 'fgts_atualizacao', 'valor_aprovado', 'terreno',
    'seguro', 'escritura', 'validade', 'corretor_responsavel_id',
    'analista_responsavel_id', 'observacoes'
  ];
  campo text;
  valor_antigo text;
  valor_novo text;
begin
  foreach campo in array campos loop
    execute format('select ($1).%I::text, ($2).%I::text', campo, campo)
      into valor_antigo, valor_novo
      using old, new;

    if valor_antigo is distinct from valor_novo then
      insert into historico_alteracoes (cliente_id, campo, valor_anterior, valor_novo, usuario_id)
      values (new.id, campo, valor_antigo, valor_novo, auth.uid());
    end if;
  end loop;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_log_alteracoes_cliente on clientes;
create trigger trg_log_alteracoes_cliente
  after update on clientes
  for each row execute function log_alteracoes_cliente();
