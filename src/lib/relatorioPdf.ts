import fs from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import type { DashEmpreendimento, LinhaConsolidado } from "@/lib/relatorios";

const GRAFITE = "#32363a";
const CINZA = "#64748b";
const TEXTO = "#0f172a";
const ZEBRA = "#f8fafc";

async function logoBuffer(): Promise<Buffer> {
  return fs.readFile(
    path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "logo-credimoveis-fundo-claro.png")
  );
}

function moeda(v: number | null) {
  return v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataCurta(v: string | null) {
  return v ? new Date(v).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
}

function coletarBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  const pedacos: Buffer[] = [];
  doc.on("data", (c) => pedacos.push(c));
  return new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(pedacos))));
}

// Cabeçalho padrão (logo + título) de todo relatório em PDF.
function cabecalhoDocumento(doc: PDFKit.PDFDocument, logo: Buffer, titulo: string, subtitulo: string, margem: number) {
  doc.image(logo, margem, margem - 5, { height: 28 });
  doc
    .fontSize(14)
    .fillColor(GRAFITE)
    .text(titulo, margem + 90, margem, { continued: false });
  doc.fontSize(9).fillColor(CINZA).text(subtitulo, margem + 90, margem + 18);
  doc.moveTo(margem, margem + 40).lineTo(doc.page.width - margem, margem + 40).strokeColor("#e2e8f0").stroke();
}

// ---------- Relatório consolidado ----------

type ColunaPdf = { titulo: string; largura: number; valor: (l: LinhaConsolidado) => string };

const COLUNAS_PDF: ColunaPdf[] = [
  { titulo: "Empreendimento", largura: 95, valor: (l) => l.empreendimento },
  { titulo: "Bloco", largura: 45, valor: (l) => l.bloco },
  { titulo: "Unid.", largura: 38, valor: (l) => l.unidade },
  { titulo: "Status", largura: 75, valor: (l) => l.status },
  { titulo: "Analista", largura: 65, valor: (l) => l.analista },
  { titulo: "Proprietário", largura: 90, valor: (l) => l.proprietario || "—" },
  { titulo: "Banco", largura: 95, valor: (l) => l.banco || "—" },
  { titulo: "Validade", largura: 55, valor: (l) => dataCurta(l.validade) },
  { titulo: "Valor aprovado", largura: 70, valor: (l) => moeda(l.valorAprovado) },
  { titulo: "Situação", largura: 60, valor: (l) => l.situacao },
];

export async function gerarPdfConsolidado(linhas: LinhaConsolidado[]): Promise<Buffer> {
  const margem = 30;
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margins: { top: margem, bottom: margem, left: margem, right: margem } });
  const resultado = coletarBuffer(doc);
  const logo = await logoBuffer();

  const hoje = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const larguraTabela = COLUNAS_PDF.reduce((s, c) => s + c.largura, 0);
  const alturaLinha = 16;
  const topoTabela = margem + 55;
  const fimDaPagina = doc.page.height - margem;

  function cabecalhoTabela(y: number): number {
    doc.rect(margem, y, larguraTabela, alturaLinha).fill(GRAFITE);
    doc.fontSize(8).fillColor("#ffffff");
    let x = margem;
    for (const c of COLUNAS_PDF) {
      doc.text(c.titulo, x + 3, y + 4, { width: c.largura - 6, ellipsis: true });
      x += c.largura;
    }
    return y + alturaLinha;
  }

  cabecalhoDocumento(doc, logo, "Relatório consolidado", `Gerado em ${hoje} · ${linhas.length} unidade(s)`, margem);
  let y = cabecalhoTabela(topoTabela);

  doc.fontSize(8);
  linhas.forEach((l, i) => {
    if (y + alturaLinha > fimDaPagina) {
      doc.addPage();
      cabecalhoDocumento(doc, logo, "Relatório consolidado", `Gerado em ${hoje} · continuação`, margem);
      y = cabecalhoTabela(topoTabela);
      doc.fontSize(8);
    }
    if (i % 2 === 1) doc.rect(margem, y, larguraTabela, alturaLinha).fill(ZEBRA);
    doc.fillColor(TEXTO);
    let x = margem;
    for (const c of COLUNAS_PDF) {
      doc.text(c.valor(l), x + 3, y + 4, { width: c.largura - 6, ellipsis: true });
      x += c.largura;
    }
    y += alturaLinha;
  });

  doc.end();
  return resultado;
}

// ---------- Dash por empreendimento ----------

export async function gerarPdfDash(empreendimentos: DashEmpreendimento[], rotuloPeriodo: string): Promise<Buffer> {
  const margem = 40;
  const doc = new PDFDocument({ size: "A4", margins: { top: margem, bottom: margem, left: margem, right: margem } });
  const resultado = coletarBuffer(doc);
  const logo = await logoBuffer();
  const hoje = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const fimDaPagina = doc.page.height - margem;
  const larguraBarra = doc.page.width - margem * 2 - 160;

  function grupo(titulo: string, itens: { nome: string; cor: string; qtd: number }[], total: number, y: number): number {
    doc.fontSize(9).fillColor(GRAFITE).text(titulo, margem + 12, y);
    y += 14;
    for (const item of itens) {
      if (y > fimDaPagina) {
        doc.addPage();
        y = margem;
      }
      const pct = total > 0 ? item.qtd / total : 0;
      doc.fontSize(8).fillColor(TEXTO).text(item.nome, margem + 12, y, { width: 130, ellipsis: true });
      doc.rect(margem + 150, y + 1, larguraBarra, 8).fillColor("#e2e8f0").fill();
      if (pct > 0) doc.rect(margem + 150, y + 1, larguraBarra * pct, 8).fillColor(item.cor).fill();
      doc
        .fontSize(8)
        .fillColor(CINZA)
        .text(`${item.qtd} · ${Math.round(pct * 100)}%`, margem + 150 + larguraBarra + 6, y);
      y += 13;
    }
    return y + 8;
  }

  cabecalhoDocumento(doc, logo, "Dash por empreendimento", `Gerado em ${hoje} · ${rotuloPeriodo}`, margem);
  let y = margem + 55;

  for (const e of empreendimentos) {
    if (y > fimDaPagina - 40) {
      doc.addPage();
      y = margem;
    }
    doc.fontSize(11).fillColor(GRAFITE).text(e.nome, margem, y);
    y += 14;
    doc
      .fontSize(8)
      .fillColor(CINZA)
      .text(`${e.totalUnidades} unidade(s) · ${e.emAnalise} em análise de financiamento`, margem, y);
    y += 16;
    y = grupo("Espelho de vendas", e.unidadesPorStatus, e.totalUnidades, y);
    y = grupo("Análise de financiamento", e.analisePorEtapa, e.emAnalise, y);
    y += 10;
    doc.moveTo(margem, y).lineTo(doc.page.width - margem, y).strokeColor("#e2e8f0").stroke();
    y += 14;
  }

  if (empreendimentos.length === 0) {
    doc.fontSize(10).fillColor(CINZA).text("Nenhum empreendimento encontrado com esses filtros.", margem, y);
  }

  doc.end();
  return resultado;
}
