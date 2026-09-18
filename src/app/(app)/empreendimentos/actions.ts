"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/auth";
import {
  distanciaCor,
  hexParaRgb,
  normalizarTexto,
  rgbParaHex,
  statusMaisProximo,
  type Rgb,
} from "@/lib/cores";
import { lerBlocosDaImagem } from "@/lib/espelhoImagem";
import { parseEspelhoExcel } from "@/lib/espelhoVendas";
import { parseListaUnidades, type LinhaUnidade } from "@/lib/listaUnidades";
import { STATUS_NAO_INFORMADO, type Torre, type Unidade } from "@/lib/database.types";

type LeituraUnidade = {
  torre: string;
  numero: string;
  status: string;
  areaM2?: number | null;
};

type Paleta = { nome: string; cor: string }[];

// Célula escura que a foto usa para "posição sem unidade" (ex.: andar que só existe em outro bloco).
const COR_SEM_UNIDADE: Rgb = [0x29, 0x37, 0x45];

export async function criarUnidadesEmLote(
  empreendimentoId: string,
  torreId: string,
  formData: FormData
) {
  await exigirAdmin();
  const supabase = await createClient();
  const status = String(formData.get("status") ?? "");
  const numerosRaw = String(formData.get("numeros") ?? "");

  const numeros = numerosRaw
    .split(/[\n,;]+/)
    .map((n) => n.trim())
    .filter(Boolean);

  if (numeros.length > 0) {
    await supabase
      .from("unidades")
      .upsert(
        numeros.map((numero) => ({ torre_id: torreId, numero, status })),
        { onConflict: "torre_id,numero" }
      );
  }

  revalidatePath(`/empreendimentos/${empreendimentoId}`);
}

export async function atualizarStatusUnidade(
  empreendimentoId: string,
  unidadeId: string,
  formData: FormData
) {
  await exigirAdmin();
  const supabase = await createClient();
  const status = String(formData.get("status") ?? "");
  if (!status) return;

  await supabase.from("unidades").update({ status }).eq("id", unidadeId);
  revalidatePath(`/empreendimentos/${empreendimentoId}`);
}

async function garantirTorres(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empreendimentoId: string,
  nomesTorres: string[]
) {
  const { data: torresExistentes } = await supabase
    .from("torres")
    .select("id, nome")
    .eq("empreendimento_id", empreendimentoId)
    .in("nome", nomesTorres.length > 0 ? nomesTorres : [""]);

  const torreIdPorNome = new Map<string, string>(
    ((torresExistentes ?? []) as Torre[]).map((t) => [t.nome, t.id])
  );

  for (const nome of nomesTorres) {
    if (!torreIdPorNome.has(nome)) {
      const { data: novaTorre } = await supabase
        .from("torres")
        .insert({ empreendimento_id: empreendimentoId, nome })
        .select("id, nome")
        .single();
      if (novaTorre) torreIdPorNome.set(novaTorre.nome, novaTorre.id);
    }
  }

  return torreIdPorNome;
}

// Cria as torres e unidades que faltam e grava o status lido, aproveitando o gatilho do banco
// para registrar no histórico da unidade tudo o que mudou desde a última importação.
async function aplicarLeituraEspelho(empreendimentoId: string, leituras: LeituraUnidade[]) {
  const supabase = await createClient();

  const nomesTorres = Array.from(new Set(leituras.map((l) => l.torre)));
  const torreIdPorNome = await garantirTorres(supabase, empreendimentoId, nomesTorres);

  const linhasParaGravar = leituras
    .map((l) => {
      const torreId = torreIdPorNome.get(l.torre);
      if (!torreId) return null;
      return { torre_id: torreId, numero: l.numero, status: l.status, area_m2: l.areaM2 ?? null };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  const torreIds = Array.from(torreIdPorNome.values());
  const { data: existentes } =
    torreIds.length > 0
      ? await supabase.from("unidades").select("torre_id, numero, status").in("torre_id", torreIds)
      : { data: [] as Unidade[] };

  const existentesPorChave = new Map<string, Unidade>(
    ((existentes ?? []) as Unidade[]).map((u) => [`${u.torre_id}:${u.numero}`, u])
  );

  let criadas = 0;
  let atualizadas = 0;
  for (const linha of linhasParaGravar) {
    const existente = existentesPorChave.get(`${linha.torre_id}:${linha.numero}`);
    if (!existente) criadas++;
    else if (existente.status !== linha.status) atualizadas++;
  }

  // A metragem só é enviada quando veio na leitura, para uma foto não apagar a metragem já cadastrada.
  const comArea = linhasParaGravar.filter((l) => l.area_m2 != null);
  const semArea = linhasParaGravar
    .filter((l) => l.area_m2 == null)
    .map((l) => ({ torre_id: l.torre_id, numero: l.numero, status: l.status }));

  for (const grupo of [comArea, semArea]) {
    for (let i = 0; i < grupo.length; i += 500) {
      const { error } = await supabase
        .from("unidades")
        .upsert(grupo.slice(i, i + 500), { onConflict: "torre_id,numero" });
      if (error) throw new Error(error.message);
    }
  }

  revalidatePath(`/empreendimentos/${empreendimentoId}`);
  revalidatePath("/clientes/novo");

  return { total: linhasParaGravar.length, criadas, atualizadas };
}

// Traduz a foto em unidades: a numeração vem da posição (andar × 100 + coluna), ancorada nas
// unidades já cadastradas de cada bloco; os blocos da foto, da esquerda para a direita, correspondem
// às torres do empreendimento em ordem de nome.
async function leiturasDaImagem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empreendimentoId: string,
  imagem: Buffer,
  paleta: Paleta,
  desconhecidas: Set<string>
): Promise<LeituraUnidade[]> {
  const blocos = lerBlocosDaImagem(imagem);

  const { data: torresData } = await supabase
    .from("torres")
    .select("id, nome")
    .eq("empreendimento_id", empreendimentoId);
  const torres = ((torresData ?? []) as Torre[]).sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR", { numeric: true })
  );

  if (torres.length === 0) {
    throw new Error(
      "Este empreendimento ainda não tem torres. Cadastre-o primeiro pela planilha (Cadastrar empreendimento)."
    );
  }
  if (torres.length !== blocos.length) {
    throw new Error(
      `A foto tem ${blocos.length} bloco(s), mas o empreendimento tem ${torres.length} torre(s) cadastrada(s).`
    );
  }

  const { data: unidadesData } = await supabase
    .from("unidades")
    .select("torre_id, numero")
    .in("torre_id", torres.map((t) => t.id));
  const unidades = (unidadesData ?? []) as Pick<Unidade, "torre_id" | "numero">[];

  const leituras: LeituraUnidade[] = [];

  blocos.forEach((bloco, k) => {
    const torre = torres[k];
    const numeros = unidades
      .filter((u) => u.torre_id === torre.id)
      .map((u) => Number(u.numero))
      .filter((n) => Number.isInteger(n));

    const andarBase = numeros.length ? Math.min(...numeros.map((n) => Math.floor(n / 100))) : 1;
    const colunaBase = numeros.length ? Math.min(...numeros.map((n) => n % 100)) : 1;
    const colunas = bloco.linhas[0]?.length ?? 0;

    const cabe = numeros.every(
      (n) =>
        Math.floor(n / 100) <= andarBase + bloco.linhas.length - 1 &&
        n % 100 <= colunaBase + colunas - 1
    );
    if (!cabe) {
      throw new Error(
        `As unidades cadastradas de "${torre.nome}" não cabem na grade do ${k + 1}º bloco da foto. Confira se é a foto certa.`
      );
    }

    bloco.linhas.forEach((linha, i) => {
      linha.forEach((cor, j) => {
        if (!cor) return;
        if (distanciaCor(cor, COR_SEM_UNIDADE) <= 25) return;

        const status = statusMaisProximo(cor, paleta);
        if (!status) {
          desconhecidas.add(rgbParaHex(cor));
          return;
        }
        leituras.push({
          torre: torre.nome,
          numero: String((andarBase + i) * 100 + (colunaBase + j)),
          status,
        });
      });
    });
  });

  return leituras;
}

type ResultadoImportacao = { erro: string } | { params: URLSearchParams };

// Lê a foto (.png) ou a planilha (.xlsx/.xltx) do espelho de vendas e atualiza o status das unidades.
async function executarImportacao(
  empreendimentoId: string,
  arquivo: File | null
): Promise<ResultadoImportacao> {
  const supabase = await createClient();

  if (!arquivo || arquivo.size === 0) {
    return { erro: "Selecione a foto (.png) ou a planilha (.xlsx) do espelho de vendas." };
  }

  const nomeArquivo = arquivo.name.toLowerCase();
  const ehImagem = nomeArquivo.endsWith(".png");
  const ehPlanilha = /\.(xlsx|xltx)$/.test(nomeArquivo);
  if (!ehImagem && !ehPlanilha) {
    return {
      erro: nomeArquivo.endsWith(".xls")
        ? 'O formato antigo .xls não é suportado. Abra no Excel e use "Salvar como" .xlsx.'
        : "Formato não suportado. Envie a foto em .png ou a planilha em .xlsx.",
    };
  }

  const { data: statusData } = await supabase
    .from("status_unidade")
    .select("nome, cor, ordem")
    .neq("nome", STATUS_NAO_INFORMADO)
    .order("ordem");
  const statusLista = (statusData ?? []) as { nome: string; cor: string; ordem: number }[];
  const paleta: Paleta = statusLista.map((s) => ({ nome: s.nome, cor: s.cor }));

  const desconhecidas = new Set<string>();
  let leituras: LeituraUnidade[] = [];
  let erro: string | null = null;

  try {
    if (ehImagem) {
      leituras = await leiturasDaImagem(
        supabase,
        empreendimentoId,
        Buffer.from(await arquivo.arrayBuffer()),
        paleta,
        desconhecidas
      );
    } else {
      const { origem, linhas } = await parseEspelhoExcel(await arquivo.arrayBuffer());
      const statusPorTexto = new Map(statusLista.map((s) => [normalizarTexto(s.nome), s.nome]));
      let semCor = 0;

      for (const linha of linhas) {
        let status: string | null = null;
        if (origem === "coluna-status" && linha.statusTexto) {
          status = statusPorTexto.get(normalizarTexto(linha.statusTexto)) ?? null;
          if (!status) desconhecidas.add(linha.statusTexto);
        } else if (linha.cor) {
          const rgb = hexParaRgb(linha.cor);
          status = rgb ? statusMaisProximo(rgb, paleta) : null;
          if (!status) desconhecidas.add(linha.cor);
        } else {
          semCor++;
        }
        if (status) {
          leituras.push({ torre: linha.torre, numero: linha.numero, status, areaM2: linha.areaM2 });
        }
      }

      if (leituras.length === 0) {
        erro =
          origem === "coluna-status"
            ? "Nenhum status da planilha corresponde à legenda do sistema."
            : linhas.length === 0
              ? 'Não encontrei unidades na planilha. Use uma tabela com as colunas "Unidade", "Bloco" e "Status", ou uma grade com o número de cada unidade em uma célula colorida.'
              : `Encontrei ${linhas.length} unidade(s) na planilha, mas nenhuma com cor reconhecida (${semCor} sem cor de preenchimento).`;
      }
    }
  } catch (e) {
    erro = e instanceof Error ? e.message : "Não foi possível ler o arquivo.";
  }

  if (!erro && leituras.length === 0) erro = "Nenhuma unidade reconhecida no arquivo.";
  if (erro) return { erro };

  // Uma unidade repetida (ex.: várias linhas da mesma unidade) conta uma vez.
  const unicas = new Map<string, LeituraUnidade>();
  for (const l of leituras) unicas.set(`${l.torre}|${l.numero}`, l);
  leituras = Array.from(unicas.values());

  let resultado: Awaited<ReturnType<typeof aplicarLeituraEspelho>> | null = null;
  try {
    resultado = await aplicarLeituraEspelho(empreendimentoId, leituras);
  } catch (e) {
    erro = e instanceof Error ? e.message : "Erro ao gravar as unidades.";
  }
  if (!resultado) return { erro: erro ?? "Erro ao gravar as unidades." };

  await supabase
    .from("empreendimentos")
    .update({ espelho_atualizado_em: new Date().toISOString() })
    .eq("id", empreendimentoId);
  revalidatePath("/empreendimentos");

  const contagem = new Map<string, number>();
  for (const l of leituras) contagem.set(l.status, (contagem.get(l.status) ?? 0) + 1);
  const resumo = statusLista
    .filter((s) => contagem.has(s.nome))
    .map((s) => `${s.nome}:${contagem.get(s.nome)}`)
    .join(",");

  const params = new URLSearchParams({
    importado: "1",
    total: String(resultado.total),
    criadas: String(resultado.criadas),
    atualizadas: String(resultado.atualizadas),
    resumo,
  });
  if (desconhecidas.size > 0) params.set("desconhecidas", Array.from(desconhecidas).join(","));
  return { params };
}

// Importação feita a partir da página do empreendimento.
export async function importarEspelhoVendas(empreendimentoId: string, formData: FormData) {
  await exigirAdmin();
  const resultado = await executarImportacao(empreendimentoId, formData.get("arquivo") as File | null);

  if ("erro" in resultado) {
    redirect(`/empreendimentos/${empreendimentoId}?erroImportacao=${encodeURIComponent(resultado.erro)}`);
  }
  redirect(`/empreendimentos/${empreendimentoId}?${resultado.params.toString()}`);
}

// Importação feita pela tela "Atualizar espelho de vendas", onde o empreendimento é escolhido no formulário.
export async function atualizarEspelhoVendas(formData: FormData) {
  await exigirAdmin();
  const empreendimentoId = String(formData.get("empreendimento_id") ?? "");
  const tela = "/empreendimentos/atualizar-espelho";

  if (!empreendimentoId) {
    redirect(`${tela}?erro=${encodeURIComponent("Escolha o empreendimento.")}`);
  }

  const resultado = await executarImportacao(empreendimentoId, formData.get("arquivo") as File | null);
  if ("erro" in resultado) {
    redirect(`${tela}?empreendimento=${empreendimentoId}&erro=${encodeURIComponent(resultado.erro)}`);
  }
  redirect(`/empreendimentos/${empreendimentoId}?${resultado.params.toString()}`);
}

// Cadastra o empreendimento (nome do arquivo ou nome informado), suas torres e unidades a partir da
// planilha "Unidade / Bloco". Pode ser reenviada: só entram as unidades que ainda não existem e o status
// das já cadastradas não é alterado.
export async function cadastrarEmpreendimentoPorExcel(formData: FormData) {
  await exigirAdmin();
  const supabase = await createClient();
  const arquivo = formData.get("arquivo") as File | null;

  if (!arquivo || arquivo.size === 0) {
    redirect(`/empreendimentos/importar?erro=${encodeURIComponent("Selecione um arquivo .xlsx")}`);
  }

  const nomeInformado = String(formData.get("nome") ?? "").trim();
  const nome = nomeInformado || arquivo.name.replace(/\.(xlsx|xltx)$/i, "").trim();

  let linhas: LinhaUnidade[] | null = null;
  let erroLeitura = "Não foi possível ler o arquivo.";
  try {
    linhas = await parseListaUnidades(await arquivo.arrayBuffer());
  } catch (e) {
    if (e instanceof Error) erroLeitura = e.message;
  }

  if (!linhas || linhas.length === 0) {
    redirect(`/empreendimentos/importar?erro=${encodeURIComponent(linhas ? "Nenhuma unidade encontrada na planilha." : erroLeitura)}`);
  }

  const { data: existente } = await supabase
    .from("empreendimentos")
    .select("id")
    .eq("nome", nome)
    .limit(1)
    .maybeSingle();

  let empreendimentoId: string | undefined = existente?.id;
  if (!empreendimentoId) {
    const { data: novo, error } = await supabase
      .from("empreendimentos")
      .insert({ nome })
      .select("id")
      .single();
    if (error || !novo) {
      redirect(`/empreendimentos/importar?erro=${encodeURIComponent(error?.message ?? "Erro ao criar o empreendimento")}`);
    }
    empreendimentoId = novo.id as string;
  }

  const torreIdPorNome = await garantirTorres(
    supabase,
    empreendimentoId,
    Array.from(new Set(linhas.map((l) => l.bloco)))
  );

  const { data: existentes } = await supabase
    .from("unidades")
    .select("torre_id, numero")
    .in("torre_id", Array.from(torreIdPorNome.values()));
  const jaCadastradas = new Set(
    ((existentes ?? []) as Pick<Unidade, "torre_id" | "numero">[]).map((u) => `${u.torre_id}:${u.numero}`)
  );

  const novas = linhas
    .map((l) => ({ torre_id: torreIdPorNome.get(l.bloco), numero: l.numero, status: STATUS_NAO_INFORMADO }))
    .filter((u): u is { torre_id: string; numero: string; status: string } => Boolean(u.torre_id))
    .filter((u) => !jaCadastradas.has(`${u.torre_id}:${u.numero}`));

  for (let i = 0; i < novas.length; i += 500) {
    const { error } = await supabase
      .from("unidades")
      .upsert(novas.slice(i, i + 500), { onConflict: "torre_id,numero", ignoreDuplicates: true });
    if (error) {
      redirect(`/empreendimentos/importar?erro=${encodeURIComponent(error.message)}`);
    }
  }

  revalidatePath("/empreendimentos");
  revalidatePath("/clientes/novo");
  revalidatePath("/");

  const params = new URLSearchParams({
    importado: "1",
    total: String(linhas.length),
    criadas: String(novas.length),
    atualizadas: "0",
  });
  redirect(`/empreendimentos/${empreendimentoId}?${params.toString()}`);
}
