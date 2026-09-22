-- Nova etapa DISTRATO, e marcação de quais etapas só podem ser escolhidas por administrador.
insert into etapas (nome, ordem, cor)
select 'DISTRATO', coalesce((select max(ordem) from etapas), 0) + 1, '#dc2626'
where not exists (select 1 from etapas where nome = 'DISTRATO');

alter table etapas add column if not exists restrita_admin boolean not null default false;
update etapas set restrita_admin = true where nome in ('REPASSADO', 'DISTRATO');

-- Seguro e escritura deixam de ser valor em dinheiro e passam a ser uma lista de opções.
-- Valores antigos (numéricos) viram texto e devem ser reconferidos manualmente pela equipe.
alter table clientes alter column seguro type text using seguro::text;
alter table clientes alter column escritura type text using escritura::text;

-- Leitura de clientes liberada para toda a equipe (consulta only; alterar continua exigindo ser o
-- analista responsável ou administrador, como já era).
drop policy if exists "clientes_select" on clientes;
create policy "clientes_select" on clientes for select to authenticated using (true);

-- Como a leitura de clientes ficou aberta, a política de andamento_historico (que só checava "o
-- cliente existe") também ficaria aberta demais para gravar. Volta a exigir dono ou administrador,
-- do mesmo jeito que já vale para alterar o próprio cadastro do cliente.
drop policy if exists "andamento_insert" on andamento_historico;
create policy "andamento_insert" on andamento_historico for insert to authenticated
  with check (
    is_admin() or exists (
      select 1 from clientes c where c.id = andamento_historico.cliente_id and c.analista_responsavel_id = auth.uid()
    )
  );
