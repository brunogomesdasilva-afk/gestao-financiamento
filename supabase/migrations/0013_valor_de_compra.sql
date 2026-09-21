-- Valor de compra e venda da unidade (comparado com o SIOP na conferência) e seu registro no histórico de alterações

alter table clientes add column if not exists valor_compra numeric;

create or replace function log_alteracoes_cliente()
returns trigger as $$
declare
  campos text[] := array[
    'nome', 'cpf', 'telefone', 'email', 'unidade_id', 'banco_financiador',
    'agencia_financiamento', 'modalidade_financiamento_id', 'fgts_contratado',
    'financiamento_contratado', 'fgts_atualizacao', 'valor_aprovado', 'terreno',
    'seguro', 'escritura', 'validade', 'corretor_responsavel_id',
    'analista_responsavel_id', 'observacoes', 'valor_compra'
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
