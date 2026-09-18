export type Rgb = [number, number, number];

export function hexParaRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbParaHex([r, g, b]: Rgb): string {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function distanciaCor(a: Rgb, b: Rgb): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

// Status cuja cor da legenda é a mais próxima de `rgb`, ou null se nenhuma estiver perto o bastante.
export function statusMaisProximo(
  rgb: Rgb,
  paleta: { nome: string; cor: string }[],
  tolerancia = 40
): string | null {
  let melhor: string | null = null;
  let menor = Infinity;
  for (const item of paleta) {
    const alvo = hexParaRgb(item.cor);
    if (!alvo) continue;
    const d = distanciaCor(rgb, alvo);
    if (d < menor) {
      menor = d;
      melhor = item.nome;
    }
  }
  return menor <= tolerancia ? melhor : null;
}

// Cor de texto legível sobre um fundo `hex`.
export function corDoTexto(hex: string): string {
  const rgb = hexParaRgb(hex);
  if (!rgb) return "#FFFFFF";
  const luminancia = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return luminancia > 0.6 ? "#0F172A" : "#FFFFFF";
}

// Minúsculas, sem acentos e sem espaços repetidos, para comparar textos digitados à mão.
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
