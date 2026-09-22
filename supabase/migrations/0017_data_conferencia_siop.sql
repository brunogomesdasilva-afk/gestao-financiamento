-- Data da última conferência SIOP feita para a unidade (avulsa ou por pasta), para mostrar em
-- "Minhas unidades".
alter table clientes add column if not exists siop_conferido_em timestamptz;
