-- Substitui as etapas genéricas iniciais pelo fluxo real de conferência usado pela equipe

delete from etapas;

insert into etapas (nome, ordem, cor) values
  ('VENDIDOS', 1, '#ef4444'),
  ('EM APROVAÇÃO', 2, '#60a5fa'),
  ('AGUARDANDO CONFORME', 3, '#f59e0b'),
  ('CONFORME', 4, '#22c55e'),
  ('APROVADOS', 5, '#16a34a'),
  ('APROVADO COM DIFERENÇA', 6, '#eab308'),
  ('AGREGAÇÃO', 7, '#a78bfa'),
  ('PROBLEMAS', 8, '#dc2626');
