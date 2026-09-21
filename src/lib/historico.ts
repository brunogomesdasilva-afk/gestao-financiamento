const CAMPOS_MOEDA = new Set([
  "fgts_contratado",
  "financiamento_contratado",
  "fgts_atualizacao",
  "valor_aprovado",
  "terreno",
  "seguro",
  "escritura",
]);

export type ContextoHistorico = {
  modalidadePorId: Map<string, string>;
  usuarioPorId: Map<string, { nome: string }>;
};

// Deixa legível o valor gravado no histórico de alterações de um campo (valores em reais,
// nomes no lugar de códigos, datas em formato brasileiro).
export function formatarValorHistorico(campo: string, valor: string | null, ctx: ContextoHistorico): string {
  if (valor == null || valor === "") return "—";

  if (CAMPOS_MOEDA.has(campo)) {
    const n = Number(valor);
    return Number.isFinite(n) ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : valor;
  }
  if (campo === "modalidade_financiamento_id") return ctx.modalidadePorId.get(valor) ?? valor;
  if (campo === "corretor_responsavel_id" || campo === "analista_responsavel_id") {
    return ctx.usuarioPorId.get(valor)?.nome ?? valor;
  }
  if (campo === "validade") return new Date(`${valor}T00:00:00`).toLocaleDateString("pt-BR");
  return valor;
}
