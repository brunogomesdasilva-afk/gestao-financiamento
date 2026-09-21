import fs from "node:fs/promises";
import path from "node:path";
import {
  extrairValoresSiop,
  indiceTorre,
  interpretarNomeArquivo,
  lerTextoPdf,
  normalizarUnidade,
  type ValoresSiop,
} from "./siopPdf";

// A pasta SIOP fica ao lado das demais (Empreendimentos, Espelhos de vendas), fora do projeto.
export function pastaSiop(): string {
  return process.env.SIOP_PASTA ?? path.resolve(/*turbopackIgnore: true*/ process.cwd(), "..", "SIOP");
}

function normalizarNome(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

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
  { chave: "valorCompra", rotulo: "Valor de compra e venda", sistema: (c) => c.valorCompra, pdf: (v) => v.valorCompra },
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

export type ResultadoConferencia = {
  pasta: string;
  pastaDoEmpreendimento: string | null;
  erro: string | null;
  resultados: ResultadoUnidade[];
  pdfsSemCadastro: string[];
  arquivosNaoReconhecidos: string[];
};

export async function conferirEmpreendimento(
  nomeEmpreendimento: string,
  clientes: ClienteParaConferir[]
): Promise<ResultadoConferencia> {
  const base = pastaSiop();
  const vazio = (erro: string, pastaDoEmpreendimento: string | null = null): ResultadoConferencia => ({
    pasta: base,
    pastaDoEmpreendimento,
    erro,
    resultados: [],
    pdfsSemCadastro: [],
    arquivosNaoReconhecidos: [],
  });

  let pastasDoSiop;
  try {
    pastasDoSiop = await fs.readdir(base, { withFileTypes: true });
  } catch {
    return vazio("A pasta SIOP não foi encontrada. Ela precisa ficar ao lado das pastas Empreendimentos e Espelhos de vendas.");
  }

  const alvo = normalizarNome(nomeEmpreendimento);
  const diretorios = pastasDoSiop.filter((d) => d.isDirectory());
  const escolhida =
    diretorios.find((d) => normalizarNome(d.name) === alvo) ??
    diretorios.find((d) => {
      const n = normalizarNome(d.name);
      return n && (n.includes(alvo) || alvo.includes(n));
    });
  if (!escolhida) {
    return vazio(`Não encontrei, dentro da pasta SIOP, uma pasta com o nome do empreendimento "${nomeEmpreendimento}".`);
  }

  const pastaEmp = path.join(/*turbopackIgnore: true*/ base, escolhida.name);
  const arquivos = (await fs.readdir(pastaEmp, { withFileTypes: true })).filter(
    (a) => a.isFile() && /\.pdf$/i.test(a.name)
  );

  // Se houver mais de um PDF da mesma unidade, vale o mais recente.
  const porUnidade = new Map<string, { nome: string; modificado: number; total: number }>();
  const naoReconhecidos: string[] = [];
  for (const arq of arquivos) {
    const info = interpretarNomeArquivo(arq.name);
    if (!info) {
      naoReconhecidos.push(arq.name);
      continue;
    }
    const chave = `${info.unidade}|${info.torre}`;
    const modificado = (await fs.stat(path.join(/*turbopackIgnore: true*/ pastaEmp, arq.name))).mtimeMs;
    const atual = porUnidade.get(chave);
    if (!atual) porUnidade.set(chave, { nome: arq.name, modificado, total: 1 });
    else {
      atual.total++;
      if (modificado > atual.modificado) {
        atual.nome = arq.name;
        atual.modificado = modificado;
      }
    }
  }

  const chavesCadastradas = new Set<string>();

  async function conferir(cliente: ClienteParaConferir): Promise<ResultadoUnidade> {
    const torreIdx = indiceTorre(cliente.torre) ?? "";
    const chave = `${normalizarUnidade(cliente.unidade)}|${torreIdx}`;
    chavesCadastradas.add(chave);
    const encontrado = porUnidade.get(chave);

    const parcial: ResultadoUnidade = {
      clienteId: cliente.clienteId,
      unidade: cliente.unidade,
      torre: cliente.torre,
      proprietario: cliente.proprietario,
      arquivo: encontrado?.nome ?? null,
      situacao: "sem-pdf",
      campos: [],
      identificacao: null,
      proponente: null,
      avisos: [],
    };
    if (!encontrado) return parcial;
    if (encontrado.total > 1) {
      parcial.avisos.push(`Há ${encontrado.total} PDFs desta unidade na pasta; foi usado o mais recente.`);
    }

    let valores: ValoresSiop;
    try {
      const conteudo = await fs.readFile(path.join(/*turbopackIgnore: true*/ pastaEmp, encontrado.nome));
      valores = extrairValoresSiop(await lerTextoPdf(new Uint8Array(conteudo)));
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

  // Lê poucos PDFs por vez para não sobrecarregar a máquina.
  const resultados: ResultadoUnidade[] = [];
  for (let i = 0; i < clientes.length; i += 4) {
    resultados.push(...(await Promise.all(clientes.slice(i, i + 4).map(conferir))));
  }

  const pdfsSemCadastro = Array.from(porUnidade.entries())
    .filter(([chave]) => !chavesCadastradas.has(chave))
    .map(([, v]) => v.nome)
    .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));

  return {
    pasta: base,
    pastaDoEmpreendimento: escolhida.name,
    erro: null,
    resultados,
    pdfsSemCadastro,
    arquivosNaoReconhecidos: naoReconhecidos,
  };
}
