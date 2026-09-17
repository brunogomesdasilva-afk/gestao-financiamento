"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseEspelhoVendas } from "@/lib/espelhoVendas";
import type { LegendaCor, Torre, Unidade } from "@/lib/database.types";

export async function criarEmpreendimento(formData: FormData) {
  const supabase = await createClient();

  await supabase.from("empreendimentos").insert({
    nome: String(formData.get("nome") ?? ""),
    endereco: String(formData.get("endereco") ?? "") || null,
    incorporadora: String(formData.get("incorporadora") ?? "") || null,
  });

  revalidatePath("/empreendimentos");
  revalidatePath("/clientes/novo");
}

export async function criarTorre(empreendimentoId: string, formData: FormData) {
  const supabase = await createClient();

  await supabase.from("torres").insert({
    empreendimento_id: empreendimentoId,
    nome: String(formData.get("nome") ?? ""),
  });

  revalidatePath(`/empreendimentos/${empreendimentoId}`);
}

const STATUS_VALIDOS = ["VENDIDA", "DISPONIVEL", "RESERVADA", "BLOQUEADA", "PERMUTA"];

export async function criarUnidadesEmLote(
  empreendimentoId: string,
  torreId: string,
  formData: FormData
) {
  const supabase = await createClient();
  const status = String(formData.get("status") ?? "DISPONIVEL");
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
  if (!STATUS_VALIDOS.includes(status)) return;

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

  const nomesTorres = Array.from(new Set(celulas.map((c) => c.torre)));
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

  const coresDesconhecidas = new Set<string>();
  const linhasParaGravar: { torre_id: string; numero: string; status: string; cor_legenda: string }[] = [];

  for (const celula of celulas) {
    if (!celula.cor) continue;
    const status = statusPorCor.get(celula.cor.toUpperCase());
    if (!status) {
      coresDesconhecidas.add(celula.cor);
      continue;
    }
    const torreId = torreIdPorNome.get(celula.torre);
    if (!torreId) continue;
    linhasParaGravar.push({ torre_id: torreId, numero: celula.numero, status, cor_legenda: celula.cor });
  }

  const torreIds = Array.from(torreIdPorNome.values());
  const { data: existentes } =
    torreIds.length > 0
      ? await supabase.from("unidades").select("torre_id, numero, status, cor_legenda").in("torre_id", torreIds)
      : { data: [] as Unidade[] };

  const existentesPorChave = new Map<string, Unidade>(
    ((existentes ?? []) as Unidade[]).map((u) => [`${u.torre_id}:${u.numero}`, u])
  );

  let criadas = 0;
  let atualizadas = 0;
  for (const linha of linhasParaGravar) {
    const existente = existentesPorChave.get(`${linha.torre_id}:${linha.numero}`);
    if (!existente) criadas++;
    else if (existente.status !== linha.status || existente.cor_legenda !== linha.cor_legenda) atualizadas++;
  }

  if (linhasParaGravar.length > 0) {
    await supabase.from("unidades").upsert(linhasParaGravar, { onConflict: "torre_id,numero" });
  }

  revalidatePath(`/empreendimentos/${empreendimentoId}`);

  const params = new URLSearchParams({
    importado: "1",
    total: String(linhasParaGravar.length),
    criadas: String(criadas),
    atualizadas: String(atualizadas),
  });
  if (coresDesconhecidas.size > 0) {
    params.set("desconhecidas", Array.from(coresDesconhecidas).join(","));
  }
  redirect(`/empreendimentos/${empreendimentoId}?${params.toString()}`);
}
