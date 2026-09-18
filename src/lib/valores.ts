// Valores enviados pelos formulários no formato brasileiro: "250000,50" (vírgula = decimal, ponto = milhar).
export function parseValorBR(texto: string): number | null {
  const limpo = texto.trim();
  if (!limpo) return null;
  const numero = Number(limpo.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
}
