export type Profile = {
  id: string;
  nome: string;
  email: string;
  perfil: "admin" | "analista";
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

export type Torre = {
  id: string;
  empreendimento_id: string;
  nome: string;
  created_at: string;
};

export type StatusUnidadeConfig = {
  nome: string;
  cor: string;
  ordem: number;
};

export type Unidade = {
  id: string;
  torre_id: string;
  numero: string;
  status: string;
  cor_legenda: string | null;
  area_m2: number | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export const STATUS_VENDIDO = "Vendido";
export const STATUS_NAO_INFORMADO = "Não informado";

export type ModalidadeFinanciamento = {
  id: string;
  nome: string;
  ordem: number;
};

export type Cliente = {
  id: string;
  nome: string | null;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  empreendimento_id: string | null;
  unidade_id: string | null;
  banco_financiador: string | null;
  agencia_financiamento: string | null;
  modalidade_financiamento_id: string | null;
  fgts_contratado: number | null;
  financiamento_contratado: number | null;
  fgts_atualizacao: number | null;
  valor_aprovado: number | null;
  diferenca_aprovacao_contratado: number | null;
  terreno: number | null;
  seguro: number | null;
  escritura: number | null;
  validade: string | null;
  corretor_responsavel_id: string | null;
  analista_responsavel_id: string | null;
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

export const CAMPO_LABEL: Record<string, string> = {
  nome: "Nome",
  cpf: "CPF",
  telefone: "Telefone",
  email: "E-mail",
  unidade_id: "Unidade",
  banco_financiador: "Banco financiador",
  agencia_financiamento: "Agência do financiamento",
  modalidade_financiamento_id: "Modalidade do financiamento",
  fgts_contratado: "FGTS contratado",
  financiamento_contratado: "Financiamento contratado",
  fgts_atualizacao: "FGTS atualização",
  valor_aprovado: "Valor aprovado",
  terreno: "Terreno",
  seguro: "Seguro",
  escritura: "Escritura",
  validade: "Validade",
  corretor_responsavel_id: "Corretor responsável",
  analista_responsavel_id: "Analista responsável",
  observacoes: "Observações",
};

export type HistoricoAlteracao = {
  id: string;
  cliente_id: string;
  campo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  usuario_id: string | null;
  created_at: string;
};

export type HistoricoUnidade = {
  id: string;
  unidade_id: string;
  campo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  usuario_id: string | null;
  created_at: string;
};

export const CAMPO_UNIDADE_LABEL: Record<string, string> = {
  status: "Status",
  cor_legenda: "Cor",
  numero: "Número",
};

// Placeholder mínimo para satisfazer o generic do supabase-js.
// Pode ser substituído pelo `supabase gen types typescript` quando o projeto estiver linkado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
