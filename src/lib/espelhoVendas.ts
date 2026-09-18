import ExcelJS from "exceljs";
import { normalizarTexto } from "@/lib/cores";

export type LinhaEspelho = {
  torre: string;
  numero: string;
  statusTexto: string | null; // status escrito na coluna "Status" da planilha
  cor: string | null; // cor de preenchimento "#RRGGBB" da célula (planilhas em formato de grade)
  areaM2: number | null;
};

export type LeituraExcel = {
  origem: "coluna-status" | "cores";
  linhas: LinhaEspelho[];
};

const PADRAO_NUMERO_UNIDADE = /^\d{2,5}[A-Za-z]?$/;

function argbParaHex(argb: string | undefined): string | null {
  if (!argb || argb.length < 6) return null;
  return `#${argb.slice(-6).toUpperCase()}`;
}

function lerAreaM2(texto: string): number | null {
  const m = /(\d+(?:[.,]\d+)?)/.exec(texto);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Formato tabular (uma linha por pessoa/unidade, com colunas Unidade, Bloco e Status).
// Linhas repetidas da mesma unidade (proponentes) contam uma vez.
function lerTabela(workbook: ExcelJS.Workbook): LinhaEspelho[] | null {
  const planilha = workbook.worksheets[0];
  if (!planilha) return null;

  let linhaCabecalho = 0;
  let colUnidade = 0;
  let colBloco = 0;
  let colStatus = 0;
  let colMetragem = 0;

  for (let r = 1; r <= Math.min(planilha.rowCount, 10) && !linhaCabecalho; r++) {
    colUnidade = colBloco = colStatus = colMetragem = 0;
    planilha.getRow(r).eachCell((cell, col) => {
      const nome = normalizarTexto(cell.text);
      if (nome === "unidade") colUnidade = col;
      if (nome === "bloco" || nome === "torre") colBloco = col;
      if (nome === "status") colStatus = col;
      if (nome === "metragem") colMetragem = col;
    });
    if (colUnidade && colBloco && colStatus) linhaCabecalho = r;
  }
  if (!linhaCabecalho) return null;

  const vistas = new Set<string>();
  const linhas: LinhaEspelho[] = [];
  for (let r = linhaCabecalho + 1; r <= planilha.rowCount; r++) {
    const row = planilha.getRow(r);
    const numero = row.getCell(colUnidade).text.trim();
    const torre = row.getCell(colBloco).text.trim();
    const statusTexto = row.getCell(colStatus).text.trim();
    if (!numero || !torre || !statusTexto) continue;

    const chave = `${torre}|${numero}`;
    if (vistas.has(chave)) continue;
    vistas.add(chave);

    linhas.push({
      torre,
      numero,
      statusTexto,
      cor: null,
      areaM2: colMetragem ? lerAreaM2(row.getCell(colMetragem).text) : null,
    });
  }
  return linhas;
}

// Formato em grade: cada célula é uma unidade e a cor de preenchimento indica o status;
// o nome da aba é o nome do bloco.
function lerCores(workbook: ExcelJS.Workbook): LinhaEspelho[] {
  const linhas: LinhaEspelho[] = [];
  workbook.eachSheet((planilha) => {
    planilha.eachRow((row) => {
      row.eachCell((cell) => {
        const numero = cell.text.trim();
        if (!PADRAO_NUMERO_UNIDADE.test(numero)) return;

        const fill = cell.style?.fill;
        const cor = fill && fill.type === "pattern" ? argbParaHex(fill.fgColor?.argb) : null;
        linhas.push({ torre: planilha.name, numero, statusTexto: null, cor, areaM2: null });
      });
    });
  });
  return linhas;
}

export async function parseEspelhoExcel(buffer: ArrayBuffer): Promise<LeituraExcel> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const tabela = lerTabela(workbook);
  if (tabela) return { origem: "coluna-status", linhas: tabela };
  return { origem: "cores", linhas: lerCores(workbook) };
}
