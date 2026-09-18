import { PNG } from "pngjs";

type Rgb = [number, number, number];

// Cada bloco lido da foto: linhas[0] é o andar mais baixo (base), e cada linha vai da esquerda para a direita.
// Cada posição traz a cor de preenchimento da célula (ou null se não deu para determinar).
export type BlocoLido = { linhas: (Rgb | null)[][] };

type Componente = { x0: number; x1: number; y0: number; y1: number; area: number };

function media(valores: number[]) {
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

// Agrupa valores ordenados: um novo grupo começa quando a distância para o anterior passa de `limite`.
function agrupar<T>(itens: T[], valor: (item: T) => number, limite: number): T[][] {
  const ordenados = [...itens].sort((a, b) => valor(a) - valor(b));
  const grupos: T[][] = [];
  for (const item of ordenados) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && valor(item) - valor(ultimo[ultimo.length - 1]) <= limite) ultimo.push(item);
    else grupos.push([item]);
  }
  return grupos;
}

// Lê a foto (PNG) do espelho de vendas: acha as células (retângulos separados por vãos claros),
// agrupa em blocos, andares e colunas, e devolve a cor de preenchimento de cada posição.
export function lerBlocosDaImagem(arquivo: Buffer): BlocoLido[] {
  const { width, height, data } = PNG.sync.read(arquivo);

  const naoFundo = new Uint8Array(width * height);
  for (let p = 0; p < width * height; p++) {
    const r = data[p * 4];
    const g = data[p * 4 + 1];
    const b = data[p * 4 + 2];
    const claro = r >= 215 && g >= 215 && b >= 215 && Math.max(r, g, b) - Math.min(r, g, b) <= 30;
    naoFundo[p] = claro ? 0 : 1;
  }

  const visitado = new Uint8Array(width * height);
  const pilha = new Int32Array(width * height);
  const componentes: Componente[] = [];

  for (let inicio = 0; inicio < width * height; inicio++) {
    if (!naoFundo[inicio] || visitado[inicio]) continue;
    const c: Componente = { x0: width, x1: 0, y0: height, y1: 0, area: 0 };
    let topo = 0;
    pilha[topo++] = inicio;
    visitado[inicio] = 1;
    while (topo > 0) {
      const p = pilha[--topo];
      const x = p % width;
      const y = (p - x) / width;
      c.area++;
      if (x < c.x0) c.x0 = x;
      if (x > c.x1) c.x1 = x;
      if (y < c.y0) c.y0 = y;
      if (y > c.y1) c.y1 = y;
      if (x > 0 && naoFundo[p - 1] && !visitado[p - 1]) { visitado[p - 1] = 1; pilha[topo++] = p - 1; }
      if (x < width - 1 && naoFundo[p + 1] && !visitado[p + 1]) { visitado[p + 1] = 1; pilha[topo++] = p + 1; }
      if (y > 0 && naoFundo[p - width] && !visitado[p - width]) { visitado[p - width] = 1; pilha[topo++] = p - width; }
      if (y < height - 1 && naoFundo[p + width] && !visitado[p + width]) { visitado[p + width] = 1; pilha[topo++] = p + width; }
    }
    componentes.push(c);
  }

  const largura = (c: Componente) => c.x1 - c.x0 + 1;
  const altura = (c: Componente) => c.y1 - c.y0 + 1;
  const preenchimento = (c: Componente) => c.area / (largura(c) * altura(c));

  // O tamanho de célula é o mais frequente entre os retângulos bem preenchidos.
  const frequencia = new Map<string, number>();
  for (const c of componentes) {
    if (largura(c) < 10 || altura(c) < 10 || largura(c) > 120 || altura(c) > 120) continue;
    if (preenchimento(c) < 0.6) continue;
    const chave = `${largura(c)}x${altura(c)}`;
    frequencia.set(chave, (frequencia.get(chave) ?? 0) + 1);
  }
  const maisFrequente = Array.from(frequencia.entries()).sort((a, b) => b[1] - a[1])[0];
  if (!maisFrequente) throw new Error("Não consegui identificar as unidades na foto.");
  const [mw, mh] = maisFrequente[0].split("x").map(Number);

  const celulas = componentes.filter(
    (c) =>
      Math.abs(largura(c) - mw) <= Math.max(2, mw * 0.15) &&
      Math.abs(altura(c) - mh) <= Math.max(3, mh * 0.15) &&
      preenchimento(c) >= 0.55
  );
  if (celulas.length < 4) throw new Error("Não consegui identificar as unidades na foto.");

  const centroX = (c: Componente) => (c.x0 + c.x1) / 2;
  const centroY = (c: Componente) => (c.y0 + c.y1) / 2;

  // Blocos: grupos de células separados por um vão horizontal bem maior que o espaço entre colunas.
  const blocos = agrupar(celulas, centroX, mw * 1.6);

  return blocos.map((doBloco) => {
    const colunas = agrupar(doBloco, centroX, mw * 0.5).map((g) => ({
      x0: Math.round(media(g.map((c) => c.x0))),
    }));
    const andares = agrupar(doBloco, centroY, mh * 0.5)
      .map((g) => ({ y0: Math.round(media(g.map((c) => c.y0))) }))
      .sort((a, b) => b.y0 - a.y0);

    const linhas = andares.map((andar) =>
      colunas.map((coluna) => {
        const contagem = new Map<number, number>();
        let total = 0;
        // Só a parte de cima da célula (onde fica o número); a faixa de baixo tem a metragem.
        for (let y = andar.y0 + 2; y <= andar.y0 + Math.round(mh * 0.5); y++) {
          for (let x = coluna.x0 + 2; x <= coluna.x0 + mw - 3; x++) {
            const p = (y * width + x) * 4;
            const chave = (data[p] << 16) | (data[p + 1] << 8) | data[p + 2];
            contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
            total++;
          }
        }
        const dominante = Array.from(contagem.entries()).sort((a, b) => b[1] - a[1])[0];
        if (!dominante || dominante[1] / total < 0.25) return null;
        const k = dominante[0];
        return [(k >> 16) & 255, (k >> 8) & 255, k & 255] as Rgb;
      })
    );

    return { linhas };
  });
}
