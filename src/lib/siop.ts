import { extrairValoresSiop, indiceTorre, lerTextoPdf, normalizarUnidade, type ValoresSiop } from "./siopPdf";

export type ClienteParaConferir = {
  clienteId: string;
  unidade: string;
  torre: string;
  proprietario: string | null;
  valorCompra: number | null;
  financiamento: number | null;
  fgts: number | null;
  terreno: number | null;
};

export type CampoConferido = {
  chave: string;
  rotulo: string;
  sistema: number | null;
  pdf: number | null;
  resultado: "igual" | "diferente" | "sem-sistema" | "sem-pdf";
};

export type SituacaoConferencia = "conferido" | "divergente" | "incompleto" | "sem-pdf" | "ilegivel";

export type ResultadoUnidade = {
  clienteId: string;
  unidade: string;
  torre: string;
  proprietario: string | null;
  arquivo: string | null;
  situacao: SituacaoConferencia;
  campos: CampoConferido[];
  identificacao: { sistema: string; pdf: string; igual: boolean } | null;
  proponente: string | null;
  avisos: string[];
};

// Campos comparados: item 5 do SIOP x o cadastro do sistema.
const CAMPOS: {
  chave: string;
  rotulo: string;
  sistema: (c: ClienteParaConferir) => number | null;
  pdf: (v: ValoresSiop) => number | null;
}[] = [
  { chave: "valorFinanciamento", rotulo: "Valor do financiamento", sistema: (c) => c.financiamento, pdf: (v) => v.valorFinanciamento },
  { chave: "fgts", rotulo: "FGTS utilizado", sistema: (c) => c.fgts, pdf: (v) => v.fgts },
  { chave: "terreno", rotulo: "Terreno (compra e venda)", sistema: (c) => c.terreno, pdf: (v) => v.terrenoCompraVenda },
];

function centavos(valor: number): number {
  return Math.round(valor * 100);
}

function compararCampo(
  chave: string,
  rotulo: string,
  sistema: number | null,
  pdf: number | null
): CampoConferido {
  let resultado: CampoConferido["resultado"];
  if (pdf == null) resultado = "sem-pdf";
  else if (sistema == null) resultado = "sem-sistema";
  else resultado = centavos(sistema) === centavos(pdf) ? "igual" : "diferente";
  return { chave, rotulo, sistema, pdf, resultado };
}

// Lê o PDF (já em memória) e compara com o cadastro do cliente.
async function avaliarPdf(
  cliente: ClienteParaConferir,
  conteudo: Uint8Array,
  parcial: ResultadoUnidade
): Promise<ResultadoUnidade> {
  let valores: ValoresSiop;
  try {
    valores = extrairValoresSiop(await lerTextoPdf(conteudo));
  } catch {
    return { ...parcial, situacao: "ilegivel", avisos: [...parcial.avisos, "Não foi possível ler o PDF."] };
  }
  if (!valores.encontrouSecao5) {
    return {
      ...parcial,
      situacao: "ilegivel",
      avisos: [...parcial.avisos, 'O item "5 - VALORES DA OPERAÇÃO" não foi encontrado no PDF.'],
    };
  }

  const torreIdx = indiceTorre(cliente.torre) ?? "";
  const campos = CAMPOS.map((c) => compararCampo(c.chave, c.rotulo, c.sistema(cliente), c.pdf(valores)));

  let identificacao: ResultadoUnidade["identificacao"] = null;
  if (valores.unidadeNoPdf) {
    const torrePdf = valores.torreNoPdf ? indiceTorre(valores.torreNoPdf) : null;
    const igual =
      normalizarUnidade(valores.unidadeNoPdf) === normalizarUnidade(cliente.unidade) &&
      (torrePdf == null || torrePdf === torreIdx);
    identificacao = {
      sistema: `Unidade ${cliente.unidade} · ${cliente.torre}`,
      pdf: `Unidade ${valores.unidadeNoPdf}${valores.torreNoPdf ? ` · Torre ${valores.torreNoPdf}` : ""}`,
      igual,
    };
  }

  let situacao: SituacaoConferencia = "conferido";
  if (campos.some((c) => c.resultado === "diferente") || identificacao?.igual === false) situacao = "divergente";
  else if (campos.some((c) => c.resultado === "sem-sistema" || c.resultado === "sem-pdf")) situacao = "incompleto";

  return { ...parcial, situacao, campos, identificacao, proponente: valores.proponente };
}

// Conferência de uma unidade: o usuário escolhe o PDF na hora.
export async function conferirUnidadeComArquivo(
  cliente: ClienteParaConferir,
  conteudo: Uint8Array,
  nomeArquivo: string
): Promise<ResultadoUnidade> {
  const parcial: ResultadoUnidade = {
    clienteId: cliente.clienteId,
    unidade: cliente.unidade,
    torre: cliente.torre,
    proprietario: cliente.proprietario,
    arquivo: nomeArquivo,
    situacao: "sem-pdf",
    campos: [],
    identificacao: null,
    proponente: null,
    avisos: [],
  };
  return avaliarPdf(cliente, conteudo, parcial);
}
