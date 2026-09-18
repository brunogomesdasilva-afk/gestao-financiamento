import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfilAtual } from "@/lib/auth";
import type { Cliente, Empreendimento, Etapa, Torre, Unidade } from "@/lib/database.types";

export default async function CarteiraPage() {
  const atual = await getPerfilAtual();
  if (!atual) redirect("/login");

  const supabase = await createClient();
  const { data: clientesData } = await supabase
    .from("clientes")
    .select("*")
    .eq("analista_responsavel_id", atual.id)
    .eq("arquivado", false)
    .order("created_at", { ascending: false });
  const clientes = (clientesData ?? []) as Cliente[];

  const unidadeIds = clientes.map((c) => c.unidade_id).filter((id): id is string => Boolean(id));
  const { data: unidadesData } = unidadeIds.length
    ? await supabase.from("unidades").select("*").in("id", unidadeIds)
    : { data: [] };
  const unidades = (unidadesData ?? []) as Unidade[];

  const torreIds = Array.from(new Set(unidades.map((u) => u.torre_id)));
  const [{ data: torresData }, { data: empreendimentosData }, { data: etapasData }] = await Promise.all([
    torreIds.length ? supabase.from("torres").select("*").in("id", torreIds) : Promise.resolve({ data: [] }),
    supabase.from("empreendimentos").select("*"),
    supabase.from("etapas").select("*"),
  ]);

  const unidadePorId = new Map(unidades.map((u) => [u.id, u]));
  const torrePorId = new Map(((torresData ?? []) as Torre[]).map((t) => [t.id, t]));
  const empreendimentoPorId = new Map(((empreendimentosData ?? []) as Empreendimento[]).map((e) => [e.id, e]));
  const etapaPorId = new Map(((etapasData ?? []) as Etapa[]).map((e) => [e.id, e]));

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Minha carteira</h1>
          <p className="mt-1 text-sm text-slate-500">
            Unidades que você assumiu e ainda estão em análise: {clientes.length}.
          </p>
        </div>
        <Link
          href="/clientes/novo"
          className="shrink-0 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Assumir unidade
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Empreendimento</th>
              <th className="px-4 py-2 font-medium">Bloco</th>
              <th className="px-4 py-2 font-medium">Unidade</th>
              <th className="px-4 py-2 font-medium">Proprietário</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Assumida em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clientes.map((c) => {
              const unidade = c.unidade_id ? unidadePorId.get(c.unidade_id) : undefined;
              const torre = unidade ? torrePorId.get(unidade.torre_id) : undefined;
              const empreendimento = c.empreendimento_id ? empreendimentoPorId.get(c.empreendimento_id) : undefined;
              const etapa = c.etapa_atual_id ? etapaPorId.get(c.etapa_atual_id) : undefined;
              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-900">{empreendimento?.nome ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{torre?.nome ?? "—"}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    <Link href={`/clientes/${c.id}`} className="hover:underline">
                      {unidade?.numero ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{c.nome ?? "Proprietário não informado"}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {etapa ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: etapa.cor }} />
                        {etapa.nome}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {new Date(c.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </td>
                </tr>
              );
            })}
            {clientes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Você ainda não assumiu nenhuma unidade.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
