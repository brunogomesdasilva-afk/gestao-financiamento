-- Nova etapa da esteira: REPASSADO (depois de PROBLEMAS, no fim da lista).
insert into etapas (nome, ordem, cor)
select 'REPASSADO', coalesce((select max(ordem) from etapas), 0) + 1, '#14b8a6'
where not exists (select 1 from etapas where nome = 'REPASSADO');
