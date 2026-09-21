import ExcelJS from "exceljs";
import type { LinhaConsolidado } from "@/lib/relatorios";

type Coluna = {
  titulo: string;
  largura: number;
  valor: (l: LinhaConsolidado) => string | number | Date | null;
  formato?: string;
};

const MOEDA = '"R$" #,##0.00';

function data(valor: string | null): Date | null {
  return valor ? new Date(valor) : null;
}

const COLUNAS: Coluna[] = [
  { titulo: "Empreendimento", largura: 28, valor: (l) => l.empreendimento },
  { titulo: "Bloco", largura: 12, valor: (l) => l.bloco },
  { titulo: "Unidade", largura: 10, valor: (l) => l.unidade },
  { titulo: "Status", largura: 24, valor: (l) => l.status },
  { titulo: "Analista", largura: 22, valor: (l) => l.analista },
  { titulo: "Situação", largura: 13, valor: (l) => l.situacao },
  { titulo: "Proprietário", largura: 30, valor: (l) => l.proprietario },
  { titulo: "CPF", largura: 16, valor: (l) => l.cpf },
  { titulo: "Telefone", largura: 16, valor: (l) => l.telefone },
  { titulo: "E-mail", largura: 28, valor: (l) => l.email },
  { titulo: "Banco financiador", largura: 30, valor: (l) => l.banco },
  { titulo: "Agência", largura: 10, valor: (l) => l.agencia },
  { titulo: "Modalidade", largura: 24, valor: (l) => l.modalidade },
  { titulo: "Validade da aprovação", largura: 16, valor: (l) => data(l.validade), formato: "dd/mm/yyyy" },
  { titulo: "Valor de compra e venda", largura: 20, valor: (l) => l.valorCompra, formato: MOEDA },
  { titulo: "Financiamento contratado", largura: 20, valor: (l) => l.financiamentoContratado, formato: MOEDA },
  { titulo: "Valor aprovado", largura: 16, valor: (l) => l.valorAprovado, formato: MOEDA },
  { titulo: "Diferença (aprovado − contratado)", largura: 22, valor: (l) => l.diferenca, formato: MOEDA },
  { titulo: "FGTS contratado", largura: 16, valor: (l) => l.fgtsContratado, formato: MOEDA },
  { titulo: "FGTS atualização", largura: 16, valor: (l) => l.fgtsAtualizacao, formato: MOEDA },
  { titulo: "Terreno", largura: 14, valor: (l) => l.terreno, formato: MOEDA },
  { titulo: "Seguro", largura: 14, valor: (l) => l.seguro, formato: MOEDA },
  { titulo: "Escritura", largura: 14, valor: (l) => l.escritura, formato: MOEDA },
  { titulo: "Assumida em", largura: 14, valor: (l) => data(l.assumidaEm), formato: "dd/mm/yyyy" },
  { titulo: "Última atualização", largura: 18, valor: (l) => data(l.atualizadoEm), formato: "dd/mm/yyyy hh:mm" },
  { titulo: "Observações", largura: 40, valor: (l) => l.observacoes },
];

export async function gerarExcelConsolidado(linhas: LinhaConsolidado[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const planilha = workbook.addWorksheet("Consolidado");

  planilha.columns = COLUNAS.map((c) => ({ header: c.titulo, width: c.largura }));

  for (const linha of linhas) {
    planilha.addRow(COLUNAS.map((c) => c.valor(linha)));
  }

  COLUNAS.forEach((c, i) => {
    if (c.formato) planilha.getColumn(i + 1).numFmt = c.formato;
  });

  const cabecalho = planilha.getRow(1);
  cabecalho.font = { bold: true };
  cabecalho.alignment = { vertical: "middle", wrapText: true };
  cabecalho.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  });
  planilha.views = [{ state: "frozen", ySplit: 1 }];
  planilha.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUNAS.length } };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
