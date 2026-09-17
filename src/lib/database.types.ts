export type Profile = {
  id: string;
  nome: string;
  email: string;
  created_at: string;
};

export type Empreendimento = {
  id: string;
  nome: string;
  endereco: string | null;
  incorporadora: string | null;
  created_at: string;
};

export type Etapa = {
  id: string;
  nome: string;
  ordem: number;
  cor: string;
};

export type Cliente = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  empreendimento_id: string | null;
  unidade: string | null;
  banco_financiador: string | null;
  valor_financiado: number | null;
  corretor_responsavel_id: string | null;
  etapa_atual_id: string | null;
  observacoes: string | null;
  arquivado: boolean;
  created_at: string;
  updated_at: string;
};

export type AndamentoHistorico = {
  id: string;
  cliente_id: string;
  etapa_id: string | null;
  observacao: string | null;
  usuario_id: string | null;
  created_at: string;
};

// Placeholder mínimo para satisfazer o generic do supabase-js.
// Pode ser substituído pelo `supabase gen types typescript` quando o projeto estiver linkado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
