export type Banco = { codigo: number | null; nome: string };

const UM_DIA = 24 * 60 * 60 * 1000;
let cache: { itens: Banco[]; expiraEm: number } | null = null;

// Instituições financeiras do Brasil (participantes do Banco Central), via BrasilAPI.
// Se a API estiver fora do ar, devolve a última lista conhecida (ou vazia): o campo continua aceitando texto livre.
export async function getBancos(): Promise<Banco[]> {
  if (cache && cache.expiraEm > Date.now()) return cache.itens;

  try {
    const resposta = await fetch("https://brasilapi.com.br/api/banks/v1", {
      signal: AbortSignal.timeout(5000),
    });
    if (!resposta.ok) return cache?.itens ?? [];

    const dados = (await resposta.json()) as {
      code: number | null;
      name: string | null;
      fullName: string | null;
    }[];

    const vistos = new Set<string>();
    const itens: Banco[] = [];
    for (const d of dados) {
      const nome = (d.fullName ?? d.name ?? "").trim();
      if (!nome || vistos.has(nome)) continue;
      vistos.add(nome);
      itens.push({ codigo: d.code, nome });
    }
    itens.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    cache = { itens, expiraEm: Date.now() + UM_DIA };
    return itens;
  } catch {
    return cache?.itens ?? [];
  }
}
