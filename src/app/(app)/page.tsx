import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Cliente, Empreendimento, Etapa, Torre, Unidade } from "@/lib/database.types";
import { getPerfilAtual } from "@/lib/auth";
import { FiltrosClientes } from "./FiltrosClientes";

type LinhaPainel = {
  clienteId: string;
  etapaId: string | null;
  empreendimento: string;
  unidade: string;
  torre: string;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ empreendimento?: string; etapa?: string; analista?: string }>;
}) {
  const {
    empreendimento: empreendimentoFiltro,
    etapa: etapaFiltro,
    analista: analistaFiltro,
  } = await searchParams;
  const supabase = await createClient();
  const atual = await getPerfilAtual();
  const ehAdmin = atual?.perfil === "admin";

  // O banco já limita cada analista aos próprios clientes; o filtro de analista só existe para o admin.
  let clientesQuery = supabase.from("clientes").select("*").eq("arquivado", false);
  if (empreendimentoFiltro) clientesQuery = clientesQuery.eq("empreendimento_id", empreendimentoFiltro);
  if (etapaFiltro) clientesQuery = clientesQuery.eq("etapa_atual_id", etapaFiltro);
  if (ehAdmin && analistaFiltro) clientesQuery = clientesQuery.eq("analista_responsavel_id", analistaFiltro);

  const [{ data: etapas }, { data: clientesData }, { data: empreendimentos }, { data: usuarios }] =
    await Promise.all([
      supabase.from("etapas").select("*").order("ordem", { ascending: true }),
      clientesQuery,
      supabase.from("empreendimentos").select("*").order("nome"),
      supabase.from("profiles").select("id, nome"),
    ]);
  const clientes = (clientesData ?? []) as Cliente[];

  const unidadeIds = clientes.map((c) => c.unidade_id).filter((id): id is string => Boolean(id));
  const { data: unidadesData } = unidadeIds.length
    ? await supabase.from("unidades").select("*").in("id", unidadeIds)
    : { data: [] };
  const unidades = (unidadesData ?? []) as Unidade[];

  const torreIds = Array.from(new Set(unidades.map((u) => u.torre_id)));
  const { data: torresData } = torreIds.length
    ? await supabase.from("torres").select("*").in("id", torreIds)
    : { data: [] };

  const empreendimentoPorId = new Map(((empreendimentos ?? []) as Empreendimento[]).map((e) => [e.id, e]));
  const unidadePorId = new Map(unidades.map((u) => [u.id, u]));
  const torrePorId = new Map(((torresData ?? []) as Torre[]).map((t) => [t.id, t]));

  const etapasTyped = (etapas as Etapa[] | null) ?? [];
  const etapasExibidas = etapaFiltro ? etapasTyped.filter((e) => e.id === etapaFiltro) : etapasTyped;

  const linhasPorEtapa = new Map<string, LinhaPainel[]>();
  for (const c of clientes) {
    const unidade = c.unidade_id ? unidadePorId.get(c.unidade_id) : undefined;
    const linha: LinhaPainel = {
      clienteId: c.id,
      etapaId: c.etapa_atual_id,
      empreendimento: (c.empreendimento_id ? empreendimentoPorId.get(c.empreendimento_id)?.nome : undefined) ?? "—",
      unidade: unidade?.numero ?? "—",
      torre: (unidade ? torrePorId.get(unidade.torre_id)?.nome : undefined) ?? "—",
    };
    const chave = c.etapa_atual_id ?? "sem-etapa";
    if (!linhasPorEtapa.has(chave)) linhasPorEtapa.set(chave, []);
    linhasPorEtapa.get(chave)!.push(linha);
  }
  for (const linhas of linhasPorEtapa.values()) {
    linhas.sort(
      (a, b) =>
        a.empreendimento.localeCompare(b.empreendimento, "pt-BR") ||
        a.torre.localeCompare(b.torre, "pt-BR", { numeric: true }) ||
        a.unidade.localeCompare(b.unidade, "pt-BR", { numeric: true })
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Andamento dos clientes</h1>
          <p className="text-sm text-slate-500">
            {clientes.length} cliente(s) aprovado(s) em acompanhamento
          </p>
        </div>
        <Link
          href="/clientes/novo"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Assumir unidade
        </Link>
      </div>

      <FiltrosClientes
        empreendimentos={(empreendimentos ?? []) as Empreendimento[]}
        etapas={etapasTyped}
        analistas={ehAdmin ? ((usuarios ?? []) as { id: string; nome: string }[]) : undefined}
        empreendimentoSelecionado={empreendimentoFiltro ?? ""}
        etapaSelecionada={etapaFiltro ?? ""}
        analistaSelecionado={ehAdmin ? (analistaFiltro ?? "") : ""}
      />

      <div className="space-y-4">
        {etapasExibidas.map((etapa) => {
          const linhas = linhasPorEtapa.get(etapa.id) ?? [];
          return (
            <section key={etapa.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <header className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: etapa.cor }} />
                <h2 className="text-sm font-semibold text-slate-700">{etapa.nome}</h2>
              </header>
              {linhas.length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {linhas.map((l) => (
                    <li key={l.clienteId}>
                      <Link
                        href={`/clientes/${l.clienteId}`}
                        className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 text-sm hover:bg-slate-50"
                      >
                        <span className="font-medium text-slate-900">{l.empreendimento}</span>
                        <span className="text-slate-700">Unidade {l.unidade}</span>
                        <span className="text-slate-500">{l.torre}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-3 text-xs text-slate-400">Nenhuma unidade neste status</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
