import ExcelJS from "exceljs";
import { LOGO_FUNDO_CLARO_BASE64 } from "@/lib/logoBase64";
import type { DashEmpreendimento, LinhaConsolidado } from "@/lib/relatorios";

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
  { titulo: "Seguro", largura: 14, valor: (l) => l.seguro },
  { titulo: "Escritura", largura: 16, valor: (l) => l.escritura },
  { titulo: "Assumida em", largura: 14, valor: (l) => data(l.assumidaEm), formato: "dd/mm/yyyy" },
  { titulo: "Última atualização", largura: 18, valor: (l) => data(l.atualizadoEm), formato: "dd/mm/yyyy hh:mm" },
  { titulo: "Observações", largura: 40, valor: (l) => l.observacoes },
];

// As primeiras linhas da planilha são reservadas ao logo; o cabeçalho da tabela vem logo abaixo.
const LINHAS_DO_LOGO = 4;
const ALTURA_LINHA_LOGO = 18;
const LOGO_ALTURA_PX = 70;
const LOGO_LARGURA_PX = Math.round((LOGO_ALTURA_PX * 972) / 530);
const LINHA_CABECALHO = LINHAS_DO_LOGO + 1;

export async function gerarExcelConsolidado(linhas: LinhaConsolidado[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const planilha = workbook.addWorksheet("Consolidado");

  COLUNAS.forEach((c, i) => {
    const coluna = planilha.getColumn(i + 1);
    coluna.width = c.largura;
    if (c.formato) coluna.numFmt = c.formato;
  });

  for (let i = 1; i <= LINHAS_DO_LOGO; i++) planilha.getRow(i).height = ALTURA_LINHA_LOGO;
  const logo = workbook.addImage({ base64: LOGO_FUNDO_CLARO_BASE64, extension: "png" });
  planilha.addImage(logo, { tl: { col: 0.1, row: 0.2 }, ext: { width: LOGO_LARGURA_PX, height: LOGO_ALTURA_PX } });

  const cabecalho = planilha.getRow(LINHA_CABECALHO);
  COLUNAS.forEach((c, i) => {
    cabecalho.getCell(i + 1).value = c.titulo;
  });
  for (const linha of linhas) {
    planilha.addRow(COLUNAS.map((c) => c.valor(linha)));
  }

  cabecalho.font = { bold: true };
  cabecalho.alignment = { vertical: "middle", wrapText: true };
  cabecalho.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  });
  planilha.views = [{ state: "frozen", ySplit: LINHA_CABECALHO }];
  planilha.autoFilter = {
    from: { row: LINHA_CABECALHO, column: 1 },
    to: { row: LINHA_CABECALHO, column: COLUNAS.length },
  };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// Dash por empreendimento: uma planilha com o espelho de vendas (situação atual, sempre) e outra
// com a análise de financiamento (respeita o período filtrado, se houver).
export async function gerarExcelDash(
  empreendimentos: DashEmpreendimento[],
  rotuloPeriodo: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  function montarPlanilha(nome: string, rotuloColuna: string, extrair: (e: DashEmpreendimento) => { nome: string; qtd: number }[]) {
    const planilha = workbook.addWorksheet(nome);
    planilha.columns = [
      { header: "Empreendimento", width: 28 },
      { header: rotuloColuna, width: 26 },
      { header: "Quantidade", width: 14 },
    ];
    for (let i = 1; i <= LINHAS_DO_LOGO; i++) planilha.getRow(i).height = ALTURA_LINHA_LOGO;
    const logo = workbook.addImage({ base64: LOGO_FUNDO_CLARO_BASE64, extension: "png" });
    planilha.addImage(logo, { tl: { col: 0.1, row: 0.2 }, ext: { width: LOGO_LARGURA_PX, height: LOGO_ALTURA_PX } });

    const cabecalho = planilha.getRow(LINHA_CABECALHO);
    cabecalho.getCell(1).value = "Empreendimento";
    cabecalho.getCell(2).value = rotuloColuna;
    cabecalho.getCell(3).value = "Quantidade";
    for (const e of empreendimentos) {
      for (const item of extrair(e)) {
        planilha.addRow([e.nome, item.nome, item.qtd]);
      }
    }
    cabecalho.font = { bold: true };
    cabecalho.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    });
    planilha.views = [{ state: "frozen", ySplit: LINHA_CABECALHO }];
    planilha.autoFilter = { from: { row: LINHA_CABECALHO, column: 1 }, to: { row: LINHA_CABECALHO, column: 3 } };
    return planilha;
  }

  // Nomes de aba do Excel não podem ter / \ ? * [ ] nem passar de 31 caracteres.
  const nomeAbaAnalise = `Analise ${rotuloPeriodo}`.replace(/[/\\?*[\]:]/g, "-").slice(0, 31);

  montarPlanilha("Espelho de vendas", "Status", (e) => e.unidadesPorStatus.map((s) => ({ nome: s.nome, qtd: s.qtd })));
  montarPlanilha(nomeAbaAnalise, "Status da análise", (e) => e.analisePorEtapa.map((s) => ({ nome: s.nome, qtd: s.qtd })));

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
