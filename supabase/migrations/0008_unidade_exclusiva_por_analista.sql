-- Uma unidade só pode ter um acompanhamento ativo por vez (o analista que a assumiu).
-- Ao concluir/liberar (clientes.arquivado = true) a unidade volta a ficar disponível para outro analista.

create unique index if not exists uq_clientes_unidade_ativa
  on clientes (unidade_id)
  where unidade_id is not null and arquivado = false;
