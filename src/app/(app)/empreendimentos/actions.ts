"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
