import ExcelJS from "exceljs";

export type CelulaUnidade = {
  torre: string;
  numero: string;
  cor: string | null; // hex "#RRGGBB", null se a célula não tem preenchimento de cor
};

function argbParaHex(argb: string | undefined): string | null {
  if (!argb || argb.length < 6) return null;
  // ARGB vem como 8 dígitos (ex: FFFF0000); ignoramos o canal alpha
  const rgb = argb.slice(-6);
  return `#${rgb.toUpperCase()}`;
}

// Um número de unidade típico do espelho de vendas: "101", "1502", "12A" etc.
const PADRAO_NUMERO_UNIDADE = /^\d{2,5}[A-Za-z]?$/;

export async function parseEspelhoVendas(buffer: ArrayBuffer): Promise<CelulaUnidade[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const unidades: CelulaUnidade[] = [];

  workbook.eachSheet((worksheet) => {
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        const valorBruto = cell.value;
        const texto =
          typeof valorBruto === "number"
            ? String(valorBruto)
            : typeof valorBruto === "string"
              ? valorBruto.trim()
              : "";

        if (!PADRAO_NUMERO_UNIDADE.test(texto)) return;

        const fill = cell.style?.fill;
        const cor = fill && fill.type === "pattern" ? argbParaHex(fill.fgColor?.argb) : null;

        unidades.push({ torre: worksheet.name, numero: texto, cor });
      });
    });
  });

  return unidades;
}
