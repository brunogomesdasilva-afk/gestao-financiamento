-- A legenda passa a ser única e fixa, igual à da foto do espelho de vendas (status_unidade.cor).
-- A legenda editável por empreendimento deixa de existir.

update status_unidade set cor = '#FFFFFF' where nome = 'Disponível';
update status_unidade set cor = '#FFC43E' where nome = 'Reservado';
update status_unidade set cor = '#00410F' where nome = 'Proposta Enviada';
update status_unidade set cor = '#F67246' where nome = 'Assinado';
update status_unidade set cor = '#524A4A' where nome = 'Em liberação';
update status_unidade set cor = '#E31524' where nome = 'Vendido';
update status_unidade set cor = '#00DBDC' where nome = 'SFH';
update status_unidade set cor = '#C814E6' where nome = 'Sem Financiamento';
update status_unidade set cor = '#3C7DCF' where nome = 'Repassado';
update status_unidade set cor = '#810014' where nome = 'Distrato';
update status_unidade set cor = '#1A005D' where nome = 'Notificação';
update status_unidade set cor = '#00D071' where nome = 'Permuta';

drop table if exists legendas_cores;
