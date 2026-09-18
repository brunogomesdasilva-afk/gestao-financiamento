-- Perfis de acesso (admin / analista) e regras de visibilidade:
-- * admin vê e gerencia tudo;
-- * analista vê só os clientes/unidades que ele assumiu (e as unidades livres para assumir, via função abaixo).

alter table profiles add column if not exists perfil text not null default 'analista';
alter table profiles drop constraint if exists profiles_perfil_check;
alter table profiles add constraint profiles_perfil_check check (perfil in ('admin', 'analista'));

-- Primeiro administrador. Se o e-mail abaixo não existir, o perfil mais antigo vira admin
-- para ninguém ficar sem acesso.
update profiles set perfil = 'admin' where email = 'brunogomesdasilva@gmail.com';
update profiles set perfil = 'admin'
  where id = (select id from profiles order by created_at limit 1)
    and not exists (select 1 from profiles where perfil = 'admin');

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and perfil = 'admin');
$$;

-- Unidades que já têm acompanhamento ativo, sem expor os dados do cliente a outros analistas.
create or replace function unidades_ocupadas()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select unidade_id from clientes where arquivado = false and unidade_id is not null;
$$;

revoke execute on function is_admin() from public;
revoke execute on function unidades_ocupadas() from public;
grant execute on function is_admin() to authenticated;
grant execute on function unidades_ocupadas() to authenticated;

-- profiles: todos leem (para mostrar nomes); só admin altera (impede o analista de se promover)
drop policy if exists "profiles_update_self" on profiles;
drop policy if exists "profiles_update_admin" on profiles;
create policy "profiles_update_admin" on profiles for update to authenticated
  using (is_admin()) with check (is_admin());

-- clientes: admin vê tudo; analista só os dele
drop policy if exists "clientes_all_auth" on clientes;
drop policy if exists "clientes_select" on clientes;
drop policy if exists "clientes_insert" on clientes;
drop policy if exists "clientes_update" on clientes;
drop policy if exists "clientes_delete" on clientes;
create policy "clientes_select" on clientes for select to authenticated
  using (is_admin() or analista_responsavel_id = auth.uid());
create policy "clientes_insert" on clientes for insert to authenticated
  with check (is_admin() or analista_responsavel_id = auth.uid());
create policy "clientes_update" on clientes for update to authenticated
  using (is_admin() or analista_responsavel_id = auth.uid())
  with check (is_admin() or analista_responsavel_id = auth.uid());
create policy "clientes_delete" on clientes for delete to authenticated
  using (is_admin());

-- históricos do cliente acompanham a visibilidade do cliente
drop policy if exists "historico_all_auth" on andamento_historico;
drop policy if exists "andamento_select" on andamento_historico;
drop policy if exists "andamento_insert" on andamento_historico;
create policy "andamento_select" on andamento_historico for select to authenticated
  using (exists (select 1 from clientes c where c.id = andamento_historico.cliente_id));
create policy "andamento_insert" on andamento_historico for insert to authenticated
  with check (exists (select 1 from clientes c where c.id = andamento_historico.cliente_id));

drop policy if exists "historico_alteracoes_select_auth" on historico_alteracoes;
drop policy if exists "historico_alteracoes_select" on historico_alteracoes;
create policy "historico_alteracoes_select" on historico_alteracoes for select to authenticated
  using (exists (select 1 from clientes c where c.id = historico_alteracoes.cliente_id));

-- estrutura dos empreendimentos: todos leem, só admin altera
drop policy if exists "empreendimentos_all_auth" on empreendimentos;
drop policy if exists "empreendimentos_select_auth" on empreendimentos;
drop policy if exists "empreendimentos_write_admin" on empreendimentos;
create policy "empreendimentos_select_auth" on empreendimentos for select to authenticated using (true);
create policy "empreendimentos_write_admin" on empreendimentos for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "torres_all_auth" on torres;
drop policy if exists "torres_select_auth" on torres;
drop policy if exists "torres_write_admin" on torres;
create policy "torres_select_auth" on torres for select to authenticated using (true);
create policy "torres_write_admin" on torres for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "unidades_all_auth" on unidades;
drop policy if exists "unidades_select_auth" on unidades;
drop policy if exists "unidades_write_admin" on unidades;
create policy "unidades_select_auth" on unidades for select to authenticated using (true);
create policy "unidades_write_admin" on unidades for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "legendas_cores_all_auth" on legendas_cores;
drop policy if exists "legendas_cores_select_auth" on legendas_cores;
drop policy if exists "legendas_cores_write_admin" on legendas_cores;
create policy "legendas_cores_select_auth" on legendas_cores for select to authenticated using (true);
create policy "legendas_cores_write_admin" on legendas_cores for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "etapas_all_auth" on etapas;
drop policy if exists "etapas_select_auth" on etapas;
drop policy if exists "etapas_write_admin" on etapas;
create policy "etapas_select_auth" on etapas for select to authenticated using (true);
create policy "etapas_write_admin" on etapas for all to authenticated
  using (is_admin()) with check (is_admin());
