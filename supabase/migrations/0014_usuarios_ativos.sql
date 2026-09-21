-- Usuários ativos/inativos. Ninguém é excluído (o histórico guarda o nome de quem agiu);
-- um usuário inativo perde o acesso ao sistema.

alter table profiles add column if not exists ativo boolean not null default true;
alter table profiles add column if not exists ativo_alterado_em timestamptz;
alter table profiles add column if not exists ativo_alterado_por uuid references profiles(id);

-- Um administrador inativo deixa de valer como administrador.
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and perfil = 'admin' and ativo);
$$;
