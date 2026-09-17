import { createClient } from "@/lib/supabase/server";
import type { Cliente, Empreendimento, Torre, Unidade } from "@/lib/database.types";

// Unidades com status VENDIDA que ainda não têm cliente vinculado (mais, opcionalmente, uma unidade específica já vinculada)
export async function getEmpreendimentosTorresEUnidadesDisponiveis(unidadeJaVinculadaId?: string) {
  const supabase = await createClient();

  const [{ data: empreendimentos }, { data: torres }, { data: unidades }, { data: clientes }] =
    await Promise.all([
      supabase.from("empreendimentos").select("*").order("nome"),
      supabase.from("torres").select("*").order("nome"),
      supabase.from("unidades").select("*").eq("status", "VENDIDA").order("numero"),
      supabase.from("clientes").select("unidade_id").not("unidade_id", "is", null),
    ]);

  const unidadesVinculadas = new Set(
    ((clientes ?? []) as Pick<Cliente, "unidade_id">[])
      .map((c) => c.unidade_id)
      .filter((uid): uid is string => Boolean(uid) && uid !== unidadeJaVinculadaId)
  );

  const unidadesDisponiveis = ((unidades ?? []) as Unidade[]).filter(
    (u) => !unidadesVinculadas.has(u.id)
  );

  return {
    empreendimentos: (empreendimentos ?? []) as Empreendimento[],
    torres: (torres ?? []) as Torre[],
    unidades: unidadesDisponiveis,
  };
}
