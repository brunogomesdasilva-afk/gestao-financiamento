"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseEspelhoVendas } from "@/lib/espelhoVendas";
import { parseListaUnidades, type LinhaUnidade } from "@/lib/listaUnidades";
import { STATUS_NAO_INFORMADO, type LegendaCor, type Torre, type Unidade } from "@/lib/database.types";

type LeituraUnidade = {
  torre: string;
  numero: string;
  status: string;
  areaM2?: number | null;
};

export async function criarTorre(empreendimentoId: string, formData: FormData) {
  const supabase = await createClient();

  await supabase.from("torres").insert({
    empreendimento_id: empreendimentoId,
    nome: String(formData.get("nome") ?? ""),
  });

  revalidatePath(`/empreendimentos/${empreendimentoId}`);
}

export async function criarUnidadesEmLote(
  empreendimentoId: string,
  torreId: string,
  formData: FormData
) {
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
  const supabase = await createClient();
  const status = String(formData.get("status") ?? "");
  if (!status) return;

  await supabase.from("unidades").update({ status }).eq("id", unidadeId);
  revalidatePath(`/empreendimentos/${empreendimentoId}`);
}

export async function criarLegendaCor(empreendimentoId: string, formData: FormData) {
  const supabase = await createClient();
  const cor = String(formData.get("cor") ?? "").toUpperCase();
  const status = String(formData.get("status") ?? "");
  if (!cor || !status) return;

  await supabase
    .from("legendas_cores")
    .upsert({ empreendimento_id: empreendimentoId, cor, status }, { onConflict: "empreendimento_id,cor" });

  revalidatePath(`/empreendimentos/${empreendimentoId}`);
}

export async function removerLegendaCor(empreendimentoId: string, legendaId: string) {
  const supabase = await createClient();
  await supabase.from("legendas_cores").delete().eq("id", legendaId);
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

// Cria as torres que faltam e grava/atualiza as unidades lidas, aproveitando o
// gatilho do banco para logar automaticamente qualquer status/cor que tenha mudado
// desde a última importação. Usado tanto pela importação de .xlsx quanto pela colagem
// manual dos dados lidos de uma foto do espelho de vendas.
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
      ? await supabase.from("unidades").select("torre_id, numero, status, area_m2").in("torre_id", torreIds)
      : { data: [] as Unidade[] };

  const existentesPorChave = new Map<string, Unidade>(
    ((existentes ?? []) as Unidade[]).map((u) => [`${u.torre_id}:${u.numero}`, u])
  );

  let criadas = 0;
  let atualizadas = 0;
  for (const linha of linhasParaGravar) {
    const existente = existentesPorChave.get(`${linha.torre_id}:${linha.numero}`);
    if (!existente) criadas++;
    else if (existente.status !== linha.status || existente.area_m2 !== linha.area_m2) atualizadas++;
  }

  if (linhasParaGravar.length > 0) {
    await supabase.from("unidades").upsert(linhasParaGravar, { onConflict: "torre_id,numero" });
  }

  revalidatePath(`/empreendimentos/${empreendimentoId}`);

  return { total: linhasParaGravar.length, criadas, atualizadas };
}

export async function importarEspelhoVendas(empreendimentoId: string, formData: FormData) {
  const supabase = await createClient();
  const arquivo = formData.get("arquivo") as File | null;

  if (!arquivo || arquivo.size === 0) {
    redirect(
      `/empreendimentos/${empreendimentoId}?erroImportacao=${encodeURIComponent("Selecione um arquivo .xlsx")}`
    );
  }

  const buffer = await arquivo.arrayBuffer();
  const celulas = await parseEspelhoVendas(buffer);

  const { data: legendas } = await supabase
    .from("legendas_cores")
    .select("*")
    .eq("empreendimento_id", empreendimentoId);
  const statusPorCor = new Map<string, string>(
    ((legendas ?? []) as LegendaCor[]).map((l) => [l.cor.toUpperCase(), l.status])
  );

  const coresDesconhecidas = new Set<string>();
  const leituras: LeituraUnidade[] = [];
  for (const celula of celulas) {
    if (!celula.cor) continue;
    const status = statusPorCor.get(celula.cor.toUpperCase());
    if (!status) {
      coresDesconhecidas.add(celula.cor);
      continue;
    }
    leituras.push({ torre: celula.torre, numero: celula.numero, status });
  }

  const resultado = await aplicarLeituraEspelho(empreendimentoId, leituras);

  const params = new URLSearchParams({
    importado: "1",
    total: String(resultado.total),
    criadas: String(resultado.criadas),
    atualizadas: String(resultado.atualizadas),
  });
  if (coresDesconhecidas.size > 0) {
    params.set("desconhecidas", Array.from(coresDesconhecidas).join(","));
  }
  redirect(`/empreendimentos/${empreendimentoId}?${params.toString()}`);
}

// Colagem manual: uma linha por unidade, no formato "Bloco;Número;Status;Área(opcional)".
// Usado quando os dados vêm de uma foto do espelho de vendas lida manualmente (por mim ou pelo analista),
// em vez de um arquivo .xlsx com cores nas células.
export async function importarLeituraManual(empreendimentoId: string, formData: FormData) {
  const texto = String(formData.get("linhas") ?? "");

  const leituras: LeituraUnidade[] = texto
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean)
    .map((linha) => {
      const [torre, numero, status, area] = linha.split(";").map((v) => v.trim());
      return { torre, numero, status, areaM2: area ? Number(area.replace(",", ".")) : null };
    })
    .filter((l) => l.torre && l.numero && l.status);

  const resultado = await aplicarLeituraEspelho(empreendimentoId, leituras);

  const params = new URLSearchParams({
    importado: "1",
    total: String(resultado.total),
    criadas: String(resultado.criadas),
    atualizadas: String(resultado.atualizadas),
  });
  redirect(`/empreendimentos/${empreendimentoId}?${params.toString()}`);
}

// Cadastra o empreendimento (nome do arquivo ou nome informado), suas torres e unidades a partir da
// planilha "Unidade / Bloco". Pode ser reenviada: só entram as unidades que ainda não existem e o status
// das já cadastradas não é alterado.
export async function cadastrarEmpreendimentoPorExcel(formData: FormData) {
  const supabase = await createClient();
  const arquivo = formData.get("arquivo") as File | null;

  if (!arquivo || arquivo.size === 0) {
    redirect(`/empreendimentos/importar?erro=${encodeURIComponent("Selecione um arquivo .xlsx")}`);
  }

  const nomeInformado = String(formData.get("nome") ?? "").trim();
  const nome = nomeInformado || arquivo.name.replace(/\.xlsx$/i, "").trim();

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
