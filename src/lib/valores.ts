// Valores digitados no formato brasileiro: "250.000,50" ou "250000,5" (ponto = milhar, vírgula = decimal).
export function parseValorBR(texto: string): number | null {
  const limpo = texto.trim();
  if (!limpo) return null;
  const numero = Number(limpo.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
}

// Inverso de parseValorBR, para preencher campos com um valor já gravado.
export function paraCampoBR(numero: number | null | undefined): string {
  return numero == null ? "" : String(numero).replace(".", ",");
}
