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
