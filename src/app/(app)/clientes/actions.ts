"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STATUS_VENDIDO } from "@/lib/database.types";

function parseValor(raw: FormDataEntryValue | null) {
  if (!raw) return null;
  const num = Number(String(raw).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(num) ? num : null;
}

function texto(formData: FormData, campo: string) {
  return String(formData.get(campo) ?? "") || null;
}

function dadosDoFormulario(formData: FormData) {
  return {
    nome: String(formData.get("nome") ?? ""),
    cpf: texto(formData, "cpf"),
    telefone: texto(formData, "telefone"),
    email: texto(formData, "email"),
    banco_financiador: texto(formData, "banco_financiador"),
    agencia_financiamento: texto(formData, "agencia_financiamento"),
    modalidade_financiamento_id: texto(formData, "modalidade_financiamento_id"),
    fgts_contratado: parseValor(formData.get("fgts_contratado")),
    financiamento_contratado: parseValor(formData.get("financiamento_contratado")),
    fgts_atualizacao: parseValor(formData.get("fgts_atualizacao")),
    valor_aprovado: parseValor(formData.get("valor_aprovado")),
    terreno: parseValor(formData.get("terreno")),
    seguro: parseValor(formData.get("seguro")),
    escritura: parseValor(formData.get("escritura")),
    validade: texto(formData, "validade"),
    corretor_responsavel_id: texto(formData, "corretor_responsavel_id"),
    observacoes: texto(formData, "observacoes"),
  };
}

async function empreendimentoIdDaUnidade(
  supabase: Awaited<ReturnType<typeof createClient>>,
  unidadeId: string
) {
  const { data } = await supabase
    .from("unidades")
    .select("torre_id, torres(empreendimento_id)")
    .eq("id", unidadeId)
    .single();
  const torres = data?.torres as unknown as { empreendimento_id: string } | null;
  return torres?.empreendimento_id ?? null;
}

// O analista logado assume a análise de financiamento de uma unidade vendida. A exclusividade é
// garantida pelo banco (índice único de acompanhamento ativo por unidade), então dois analistas
// tentando ao mesmo tempo nunca ficam com a mesma unidade.
export async function assumirUnidade(formData: FormData) {
  const supabase = await createClient();
  const unidadeId = texto(formData, "unidade_id");
  const nome = String(formData.get("nome") ?? "").trim();

  if (!unidadeId || !nome) {
    redirect(`/clientes/novo?erro=${encodeURIComponent("Selecione a unidade e informe o nome do proprietário.")}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: unidade } = await supabase
    .from("unidades")
    .select("id, status")
    .eq("id", unidadeId)
    .single();
  if (!unidade || unidade.status !== STATUS_VENDIDO) {
    redirect(`/clientes/novo?erro=${encodeURIComponent(`Só é possível assumir unidades com status ${STATUS_VENDIDO}.`)}`);
  }

  const { data: primeiraEtapa } = await supabase
    .from("etapas")
    .select("id")
    .order("ordem", { ascending: true })
    .limit(1)
    .single();

  const { data: cliente, error } = await supabase
    .from("clientes")
    .insert({
      nome,
      unidade_id: unidadeId,
      empreendimento_id: await empreendimentoIdDaUnidade(supabase, unidadeId),
      analista_responsavel_id: user.id,
      etapa_atual_id: primeiraEtapa?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !cliente) {
    const mensagem =
      error?.code === "23505"
        ? "Essa unidade acabou de ser assumida por outro analista."
        : (error?.message ?? "Erro ao assumir a unidade.");
    redirect(`/clientes/novo?erro=${encodeURIComponent(mensagem)}`);
  }

  await supabase.from("andamento_historico").insert({
    cliente_id: cliente.id,
    etapa_id: primeiraEtapa?.id ?? null,
    observacao: "Unidade assumida pelo analista",
    usuario_id: user.id,
  });

  revalidatePath("/");
  revalidatePath("/clientes/novo");
  redirect(`/clientes/${cliente.id}/editar`);
}

export async function atualizarCliente(clienteId: string, formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("clientes")
    .update(dadosDoFormulario(formData))
    .eq("id", clienteId);

  if (error) {
    redirect(`/clientes/${clienteId}/editar?erro=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/");
  revalidatePath(`/clientes/${clienteId}`);
  redirect(`/clientes/${clienteId}`);
}

export async function avancarEtapa(clienteId: string, formData: FormData) {
  const supabase = await createClient();
  const etapaId = String(formData.get("etapa_id") ?? "");
  const observacao = String(formData.get("observacao") ?? "") || null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("clientes").update({ etapa_atual_id: etapaId }).eq("id", clienteId);

  await supabase.from("andamento_historico").insert({
    cliente_id: clienteId,
    etapa_id: etapaId,
    observacao,
    usuario_id: user?.id ?? null,
  });

  revalidatePath("/");
  revalidatePath(`/clientes/${clienteId}`);
}

// Concluir (arquivado = true) libera a unidade para outro analista; reativar só funciona se
// ninguém tiver assumido a unidade nesse meio tempo.
export async function arquivarCliente(clienteId: string, arquivado: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("clientes").update({ arquivado }).eq("id", clienteId);

  if (error) {
    const mensagem =
      error.code === "23505"
        ? "Não é possível reativar: essa unidade já foi assumida por outro analista."
        : error.message;
    redirect(`/clientes/${clienteId}?erro=${encodeURIComponent(mensagem)}`);
  }

  revalidatePath("/");
  revalidatePath("/clientes/novo");
  revalidatePath(`/clientes/${clienteId}`);
}
