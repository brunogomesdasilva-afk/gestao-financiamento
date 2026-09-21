import { extractText, getDocumentProxy } from "unpdf";

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// "Bloco 1", "Torre A", "A", "1" e "b" viram um índice comparável: A = 1, B = 2 e assim por diante.
export function indiceTorre(texto: string): string | null {
  const limpo = normalizar(texto)
    .replace(/\b(torre|bloco|blc|bl)\b/g, " ")
    .trim();
  const m = /^([a-z]\b|\d+)/.exec(limpo);
  if (!m) return null;
  const t = m[1];
  return /^\d+$/.test(t) ? String(Number(t)) : String(t.charCodeAt(0) - 96);
}

export function normalizarUnidade(unidade: string): string {
  return normalizar(unidade)
    .replace(/[^a-z0-9]/g, "")
    .replace(/^0+(?=\d)/, "");
}

// Nomes aceitos: "SIOPI - 103 - A.pdf", "SIOP-103-Torre A.pdf", "siopi  -  1705  -  bloco 2.pdf"...
export function interpretarNomeArquivo(nome: string): { unidade: string; torre: string } | null {
  const base = normalizar(nome.replace(/\.pdf$/i, ""));
  const m = /^siopi?\s*[-–_]\s*([a-z0-9]+)\s*[-–_]\s*(.+)$/.exec(base);
  if (!m) return null;
  const torre = indiceTorre(m[2]);
  return torre ? { unidade: normalizarUnidade(m[1]), torre } : null;
}

export type ValoresSiop = {
  encontrouSecao5: boolean;
  valorCompra: number | null;
  valorFinanciamento: number | null;
  fgts: number | null;
  recursosProprios: number | null;
  terrenoCompraVenda: number | null;
  terrenoFinanciamento: number | null;
  fgtsTerreno: number | null;
  proponente: string | null;
  empreendimento: string | null;
  unidadeNoPdf: string | null;
  torreNoPdf: string | null;
};

const VALOR = "(\\d{1,3}(?:\\.\\d{3})*,\\d{2})";

function dinheiro(bloco: string, rotulo: string): number | null {
  const m = new RegExp(`${rotulo}\\s*${VALOR}`, "i").exec(bloco);
  return m ? Number(m[1].replace(/\./g, "").replace(",", ".")) : null;
}

function trecho(texto: string, inicio: RegExp, fim?: RegExp): string {
  const i = texto.search(inicio);
  if (i < 0) return "";
  const resto = texto.slice(i);
  if (!fim) return resto;
  const j = resto.slice(1).search(fim);
  return j < 0 ? resto : resto.slice(0, j + 1);
}

// Lê os valores do item "5 - VALORES DA OPERAÇÃO" do espelho da proposta do SIOP.
export function extrairValoresSiop(texto: string): ValoresSiop {
  const secao5 = trecho(
    texto,
    /5\s*-\s*VALORES\s+DA\s+OPERA/i,
    /\n\s*[6-9]\s*-\s*[A-ZÇÃÕÁÉÍÓÚ]{3,}/
  );
  const negociacao = trecho(secao5, /5\.3\s*-\s*Negocia/i, /5\.4\s*-/i);
  const terreno = trecho(secao5, /5\.5\s*-\s*Terreno/i);

  const descricao = /Apartamento\s+n[º°o]?\s*(\d+)\s+da\s+(?:Torre|Bloco)\s+([A-Za-z0-9]+)/i.exec(texto);
  const ap = /\bAP\s*(\d{2,5})\b/i.exec(texto);
  const bl = /\bBL\.?\s*T?([A-Z])\b/.exec(texto);

  return {
    encontrouSecao5: secao5.length > 0,
    valorCompra: dinheiro(
      negociacao,
      "Valor\\s+Compra\\s+e\\s+Venda(?:\\s+ou\\s+Or[çc]amento\\s+Proposto\\s+pelo\\s+Cliente)?:"
    ),
    valorFinanciamento: dinheiro(negociacao, "Valor\\s+Financiamento\\s+Negociado:"),
    fgts: dinheiro(negociacao, "Valor\\s+Total\\s+Utilizado\\s+FGTS:"),
    recursosProprios: dinheiro(negociacao, "Valor\\s+Recursos\\s+Pr[óo]prios:"),
    terrenoCompraVenda: dinheiro(terreno, "Valor\\s+Compra\\s+e\\s+Venda:"),
    terrenoFinanciamento: dinheiro(terreno, "Valor\\s+Financiamento:"),
    fgtsTerreno: dinheiro(terreno, "FGTS\\s+do\\s+Terreno:"),
    proponente: /Nome\s+do\s+Proponente:\s*([^\n]+)/i.exec(texto)?.[1]?.trim() ?? null,
    empreendimento: /Nome\s+do\s+Empreendimento:\s*([^\n]+)/i.exec(texto)?.[1]?.trim() ?? null,
    unidadeNoPdf: descricao?.[1] ?? ap?.[1] ?? null,
    torreNoPdf: descricao?.[2] ?? bl?.[1] ?? null,
  };
}

export async function lerTextoPdf(conteudo: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(conteudo));
  const { text } = await extractText(pdf, { mergePages: false });
  return text.join("\n");
}
