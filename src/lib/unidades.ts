import { buscarTodos } from "@/lib/paginacao";
import { createClient } from "@/lib/supabase/server";
import { STATUS_VENDIDO, type Empreendimento, type Torre, type Unidade } from "@/lib/database.types";

// Unidades vendidas que nenhum analista assumiu ainda (sem acompanhamento ativo),
// junto com as torres e empreendimentos que possuem pelo menos uma delas.
export async function getUnidadesParaAssumir() {
  const supabase = await createClient();

  const [{ data: empreendimentos }, { data: torres }, unidades, { data: ocupadas }] = await Promise.all([
    supabase.from("empreendimentos").select("*").order("nome"),
    supabase.from("torres").select("*").order("nome"),
    buscarTodos<Unidade>((de, ate) =>
      supabase.from("unidades").select("*").eq("status", STATUS_VENDIDO).order("id").range(de, ate)
    ),
    supabase.rpc("unidades_ocupadas"),
  ]);

  const unidadesOcupadas = new Set((ocupadas ?? []) as string[]);
  const unidadesLivres = unidades
    .filter((u) => !unidadesOcupadas.has(u.id))
    .sort((a, b) => a.numero.localeCompare(b.numero, "pt-BR", { numeric: true }));

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
