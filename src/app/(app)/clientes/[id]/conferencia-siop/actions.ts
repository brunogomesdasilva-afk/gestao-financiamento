"use server";

import { createClient } from "@/lib/supabase/server";
import { conferirUnidadeComArquivo, type ClienteParaConferir, type ResultadoUnidade } from "@/lib/siop";
import type { Cliente, Torre, Unidade } from "@/lib/database.types";

export type EstadoConferenciaAvulsa = { resultado: ResultadoUnidade | null; erro: string | null };

// Conferência de uma unidade: o PDF é escolhido na hora pelo usuário. Os dados do lado "sistema" vêm sempre do banco — nunca do formulário — para a
// conferência ter valor: é o cadastro confiável que está sendo validado contra o PDF.
export async function conferirUploadAction(
  clienteId: string,
  _estadoAnterior: EstadoConferenciaAvulsa,
  formData: FormData
): Promise<EstadoConferenciaAvulsa> {
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { resultado: null, erro: "Escolha um arquivo PDF." };
  }
  if (!arquivo.name.toLowerCase().endsWith(".pdf")) {
    return { resultado: null, erro: "O arquivo precisa ser um PDF." };
  }

  const supabase = await createClient();
  const { data: cliente } = await supabase.from("clientes").select("*").eq("id", clienteId).single();
  if (!cliente) return { resultado: null, erro: "Cliente não encontrado." };
  const clienteTyped = cliente as Cliente;

  if (!clienteTyped.unidade_id) {
    return { resultado: null, erro: "Este cadastro não está vinculado a uma unidade." };
  }
  const { data: unidade } = await supabase
    .from("unidades")
    .select("*")
    .eq("id", clienteTyped.unidade_id)
    .single();
  const unidadeTyped = unidade as Unidade | null;
  if (!unidadeTyped) return { resultado: null, erro: "Unidade não encontrada." };

  const { data: torre } = await supabase.from("torres").select("*").eq("id", unidadeTyped.torre_id).single();
  const torreTyped = torre as Torre | null;

  const paraConferir: ClienteParaConferir = {
    clienteId: clienteTyped.id,
    unidade: unidadeTyped.numero,
    torre: torreTyped?.nome ?? "—",
    proprietario: clienteTyped.nome,
    valorCompra: clienteTyped.valor_compra ?? null,
    financiamento: clienteTyped.financiamento_contratado,
    fgts: clienteTyped.fgts_contratado,
    terreno: clienteTyped.terreno,
  };

  let conteudo: Uint8Array;
  try {
    conteudo = new Uint8Array(await arquivo.arrayBuffer());
  } catch {
    return { resultado: null, erro: "Não foi possível ler o arquivo enviado." };
  }

  const resultado = await conferirUnidadeComArquivo(paraConferir, conteudo, arquivo.name);

  // Registra quando a conferência foi feita, independente do resultado (conferido, divergente...).
  await supabase.from("clientes").update({ siop_conferido_em: new Date().toISOString() }).eq("id", clienteId);

  return { resultado, erro: null };
}
