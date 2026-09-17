"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function parseValor(raw: FormDataEntryValue | null) {
  if (!raw) return null;
  const num = Number(String(raw).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(num) ? num : null;
}

export async function criarCliente(formData: FormData) {
  const supabase = await createClient();

  const { data: primeiraEtapa } = await supabase
    .from("etapas")
    .select("id")
    .order("ordem", { ascending: true })
    .limit(1)
    .single();

  const { data: cliente, error } = await supabase
    .from("clientes")
    .insert({
      nome: String(formData.get("nome") ?? ""),
      cpf: String(formData.get("cpf") ?? "") || null,
      telefone: String(formData.get("telefone") ?? "") || null,
      email: String(formData.get("email") ?? "") || null,
      empreendimento_id: String(formData.get("empreendimento_id") ?? "") || null,
      unidade: String(formData.get("unidade") ?? "") || null,
      banco_financiador: String(formData.get("banco_financiador") ?? "") || null,
      valor_financiado: parseValor(formData.get("valor_financiado")),
      corretor_responsavel_id: String(formData.get("corretor_responsavel_id") ?? "") || null,
      etapa_atual_id: primeiraEtapa?.id ?? null,
      observacoes: String(formData.get("observacoes") ?? "") || null,
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

  const { error } = await supabase
    .from("clientes")
    .update({
      nome: String(formData.get("nome") ?? ""),
      cpf: String(formData.get("cpf") ?? "") || null,
      telefone: String(formData.get("telefone") ?? "") || null,
      email: String(formData.get("email") ?? "") || null,
      empreendimento_id: String(formData.get("empreendimento_id") ?? "") || null,
      unidade: String(formData.get("unidade") ?? "") || null,
      banco_financiador: String(formData.get("banco_financiador") ?? "") || null,
      valor_financiado: parseValor(formData.get("valor_financiado")),
      corretor_responsavel_id: String(formData.get("corretor_responsavel_id") ?? "") || null,
      observacoes: String(formData.get("observacoes") ?? "") || null,
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
