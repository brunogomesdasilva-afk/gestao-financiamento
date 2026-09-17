-- Lista global de status de unidade (igual para todos os empreendimentos) e área em m²

create table if not exists status_unidade (
  nome text primary key,
  cor text not null,
  ordem int not null
);

insert into status_unidade (nome, cor, ordem) values
  ('Disponível', '#64748B', 1),
  ('Reservado', '#EAB308', 2),
  ('Proposta Enviada', '#F97316', 3),
  ('Assinado', '#0EA5E9', 4),
  ('Em liberação', '#A78BFA', 5),
  ('Vendido', '#EF4444', 6),
  ('SFH', '#38BDF8', 7),
  ('Sem Financiamento', '#EC4899', 8),
  ('Repassado', '#2563EB', 9),
  ('Distrato', '#7C3AED', 10),
  ('Notificação', '#1E293B', 11),
  ('Permuta', '#22C55E', 12)
on conflict (nome) do nothing;

alter table status_unidade enable row level security;
drop policy if exists "status_unidade_select_auth" on status_unidade;
create policy "status_unidade_select_auth" on status_unidade for select to authenticated using (true);

alter table unidades add column if not exists area_m2 numeric;

alter table unidades alter column status set default 'Disponível';
alter table unidades drop constraint if exists unidades_status_fkey;
alter table unidades add constraint unidades_status_fkey foreign key (status) references status_unidade(nome);

alter table legendas_cores drop constraint if exists legendas_cores_status_fkey;
alter table legendas_cores add constraint legendas_cores_status_fkey foreign key (status) references status_unidade(nome);
