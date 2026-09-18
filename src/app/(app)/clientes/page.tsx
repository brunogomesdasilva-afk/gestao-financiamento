import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPerfilAtual } from "@/lib/auth";
import type { Cliente, Empreendimento, Etapa, Torre, Unidade } from "@/lib/database.types";
import { devolverUnidade } from "./actions";
import { FiltrosCarteira, type LinhaFiltro } from "./FiltrosCarteira";
import { MenuAcoesUnidade } from "./MenuAcoesUnidade";

type Linha = LinhaFiltro & { cliente: Cliente; etapaCor: string | null };

export default async function CarteiraPage({
  searchParams,
}: {
  searchParams: Promise<{
    erro?: string;
    ok?: string;
    empreendimento?: string;
    bloco?: string;
    unidade?: string;
    status?: string;
  }>;
}) {
  const { erro, ok, ...filtros } = await searchParams;
  const selecao = {
    empreendimento: filtros.empreendimento ?? "",
    bloco: filtros.bloco ?? "",
    unidade: filtros.unidade ?? "",
    status: filtros.status ?? "",
  };

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

  const linhas: Linha[] = clientes.map((c) => {
    const unidade = c.unidade_id ? unidadePorId.get(c.unidade_id) : undefined;
    const torre = unidade ? torrePorId.get(unidade.torre_id) : undefined;
    const empreendimento = c.empreendimento_id ? empreendimentoPorId.get(c.empreendimento_id) : undefined;
    const etapa = c.etapa_atual_id ? etapaPorId.get(c.etapa_atual_id) : undefined;
    return {
      cliente: c,
      empreendimentoId: c.empreendimento_id ?? "",
      empreendimento: empreendimento?.nome ?? "—",
      bloco: torre?.nome ?? "—",
      unidade: unidade?.numero ?? "—",
      etapaId: c.etapa_atual_id ?? "",
      etapa: etapa?.nome ?? "—",
      etapaOrdem: etapa?.ordem ?? 0,
      etapaCor: etapa?.cor ?? null,
    };
  });

  const visiveis = linhas.filter(
    (l) =>
      (!selecao.empreendimento || l.empreendimentoId === selecao.empreendimento) &&
      (!selecao.bloco || l.bloco === selecao.bloco) &&
      (!selecao.unidade || l.unidade === selecao.unidade) &&
      (!selecao.status || l.etapaId === selecao.status)
  );
  const filtrando = visiveis.length !== linhas.length;

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Minha carteira</h1>
          <p className="mt-1 text-sm text-slate-500">
            {filtrando
              ? `Mostrando ${visiveis.length} de ${linhas.length} unidade(s) que você assumiu e ainda estão em análise.`
              : `Unidades que você assumiu e ainda estão em análise: ${linhas.length}.`}
          </p>
        </div>
        <Link
          href="/clientes/novo"
          className="shrink-0 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Assumir unidade
        </Link>
      </div>

      {erro && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {ok && <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</p>}

      {linhas.length > 0 && (
        <FiltrosCarteira
          linhas={linhas.map((l) => ({
            empreendimentoId: l.empreendimentoId,
            empreendimento: l.empreendimento,
            bloco: l.bloco,
            unidade: l.unidade,
            etapaId: l.etapaId,
            etapa: l.etapa,
            etapaOrdem: l.etapaOrdem,
          }))}
          selecao={selecao}
        />
      )}

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
              <th className="w-12 px-2 py-2">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visiveis.map((l) => (
              <tr key={l.cliente.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-900">{l.empreendimento}</td>
                <td className="px-4 py-2 text-slate-600">{l.bloco}</td>
                <td className="px-4 py-2 font-medium text-slate-900">
                  <Link href={`/clientes/${l.cliente.id}`} className="hover:underline">
                    {l.unidade}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-600">{l.cliente.nome ?? "Proprietário não informado"}</td>
                <td className="px-4 py-2 text-slate-600">
                  {l.etapaCor ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.etapaCor }} />
                      {l.etapa}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {new Date(l.cliente.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                </td>
                <td className="px-2 py-2 text-right">
                  <MenuAcoesUnidade clienteId={l.cliente.id} devolverAction={devolverUnidade.bind(null, l.cliente.id)} />
                </td>
              </tr>
            ))}
            {visiveis.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  {linhas.length === 0
                    ? "Você ainda não assumiu nenhuma unidade."
                    : "Nenhuma unidade encontrada com esses filtros."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
