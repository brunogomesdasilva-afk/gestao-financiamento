"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    analista_responsavel_id: texto(formData, "analista_responsavel_id"),
    observacoes: texto(formData, "observacoes"),
  };
}

async function empreendimentoIdDaUnidade(
  supabase: Awaited<ReturnType<typeof createClient>>,
  unidadeId: string | null
) {
  if (!unidadeId) return null;
  const { data } = await supabase
    .from("unidades")
    .select("torre_id, torres(empreendimento_id)")
    .eq("id", unidadeId)
    .single();
  const torres = data?.torres as unknown as { empreendimento_id: string } | null;
  return torres?.empreendimento_id ?? null;
}

export async function criarCliente(formData: FormData) {
  const supabase = await createClient();

  const { data: primeiraEtapa } = await supabase
    .from("etapas")
    .select("id")
    .order("ordem", { ascending: true })
    .limit(1)
    .single();

  const unidadeId = String(formData.get("unidade_id") ?? "") || null;
  const empreendimentoId = await empreendimentoIdDaUnidade(supabase, unidadeId);

  const { data: cliente, error } = await supabase
    .from("clientes")
    .insert({
      ...dadosDoFormulario(formData),
      empreendimento_id: empreendimentoId,
      unidade_id: unidadeId,
      etapa_atual_id: primeiraEtapa?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !cliente) {
    redirect(`/clientes/novo?erro=${encodeURIComponent(error?.message ?? "Erro ao criar cliente")}`);
  }

  if (primeiraEtapa) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("andamento_historico").insert({
      cliente_id: cliente.id,
      etapa_id: primeiraEtapa.id,
      observacao: "Cliente cadastrado no sistema",
      usuario_id: user?.id ?? null,
    });
  }

  revalidatePath("/");
  redirect(`/clientes/${cliente.id}`);
}

export async function atualizarCliente(clienteId: string, formData: FormData) {
  const supabase = await createClient();

  const unidadeId = String(formData.get("unidade_id") ?? "") || null;
  const empreendimentoId = await empreendimentoIdDaUnidade(supabase, unidadeId);

  const { error } = await supabase
    .from("clientes")
    .update({
      ...dadosDoFormulario(formData),
      empreendimento_id: empreendimentoId,
      unidade_id: unidadeId,
    })
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

export async function arquivarCliente(clienteId: string, arquivado: boolean) {
  const supabase = await createClient();
  await supabase.from("clientes").update({ arquivado }).eq("id", clienteId);
  revalidatePath("/");
  revalidatePath(`/clientes/${clienteId}`);
}
