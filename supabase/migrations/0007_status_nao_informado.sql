-- Status inicial neutro para unidades cadastradas a partir da planilha de unidades (sem cor/status ainda)

insert into status_unidade (nome, cor, ordem) values
  ('Não informado', '#CBD5E1', 0)
on conflict (nome) do nothing;
