import ExcelJS from "exceljs";

export type LinhaUnidade = { bloco: string; numero: string };

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

// Lê a planilha de cadastro do empreendimento (colunas "Unidade" e "Bloco"/"Torre"),
// ignorando linhas repetidas de mesma unidade+bloco.
export async function parseListaUnidades(buffer: ArrayBuffer): Promise<LinhaUnidade[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const planilha = workbook.worksheets[0];
  if (!planilha) throw new Error("A planilha está vazia.");

  let linhaCabecalho = 0;
  let colUnidade = 0;
  let colBloco = 0;

  for (let r = 1; r <= Math.min(planilha.rowCount, 10) && !linhaCabecalho; r++) {
    planilha.getRow(r).eachCell((cell, col) => {
      const nome = normalizar(cell.text);
      if (nome === "unidade") colUnidade = col;
      if (nome === "bloco" || nome === "torre") colBloco = col;
    });
    if (colUnidade && colBloco) linhaCabecalho = r;
  }

  if (!linhaCabecalho) {
    throw new Error('Não encontrei as colunas "Unidade" e "Bloco" nas primeiras linhas da planilha.');
  }

  const vistas = new Set<string>();
  const linhas: LinhaUnidade[] = [];

  for (let r = linhaCabecalho + 1; r <= planilha.rowCount; r++) {
    const row = planilha.getRow(r);
    const numero = row.getCell(colUnidade).text.trim();
    const bloco = row.getCell(colBloco).text.trim();
    if (!numero || !bloco) continue;

    const chave = `${bloco}|${numero}`;
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    linhas.push({ bloco, numero });
  }

  return linhas;
}
