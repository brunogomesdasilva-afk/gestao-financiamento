-- Data/hora da última atualização do espelho de vendas de cada empreendimento
-- (preenchida quando a foto ou a planilha do espelho é importada).

alter table empreendimentos add column if not exists espelho_atualizado_em timestamptz;
