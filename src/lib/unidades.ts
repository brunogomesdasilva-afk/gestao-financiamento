import { createClient } from "@/lib/supabase/server";
import { STATUS_VENDIDO, type Cliente, type Empreendimento, type Torre, type Unidade } from "@/lib/database.types";

// Unidades vendidas que nenhum analista assumiu ainda (sem acompanhamento ativo),
// junto com as torres e empreendimentos que possuem pelo menos uma delas.
export async function getUnidadesParaAssumir() {
  const supabase = await createClient();

  const [{ data: empreendimentos }, { data: torres }, { data: unidades }, { data: clientes }] =
    await Promise.all([
      supabase.from("empreendimentos").select("*").order("nome"),
      supabase.from("torres").select("*").order("nome"),
      supabase.from("unidades").select("*").eq("status", STATUS_VENDIDO).order("numero"),
      supabase.from("clientes").select("unidade_id").eq("arquivado", false).not("unidade_id", "is", null),
    ]);

  const unidadesOcupadas = new Set(
    ((clientes ?? []) as Pick<Cliente, "unidade_id">[]).map((c) => c.unidade_id)
  );
  const unidadesLivres = ((unidades ?? []) as Unidade[]).filter((u) => !unidadesOcupadas.has(u.id));

  const torreIdsComUnidade = new Set(unidadesLivres.map((u) => u.torre_id));
  const torresComUnidade = ((torres ?? []) as Torre[]).filter((t) => torreIdsComUnidade.has(t.id));
  const empreendimentoIdsComUnidade = new Set(torresComUnidade.map((t) => t.empreendimento_id));

  return {
    empreendimentos: ((empreendimentos ?? []) as Empreendimento[]).filter((e) =>
      empreendimentoIdsComUnidade.has(e.id)
    ),
    torres: torresComUnidade,
    unidades: unidadesLivres,
  };
}
