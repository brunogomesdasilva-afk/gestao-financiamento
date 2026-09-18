-- Ao assumir a unidade, todos os dados do cliente (inclusive o nome do proprietário) são opcionais.

alter table clientes alter column nome drop not null;
