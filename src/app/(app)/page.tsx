import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Cliente, Empreendimento, Etapa, Unidade } from "@/lib/database.types";
import { getPerfilAtual } from "@/lib/auth";
import { FiltrosClientes } from "./FiltrosClientes";

function formatMoeda(valor: number | null) {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

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
  let clientesQuery = supabase.from("clientes").select("*").eq("arquivado", false).order("nome");
  if (empreendimentoFiltro) clientesQuery = clientesQuery.eq("empreendimento_id", empreendimentoFiltro);
  if (etapaFiltro) clientesQuery = clientesQuery.eq("etapa_atual_id", etapaFiltro);
  if (ehAdmin && analistaFiltro) clientesQuery = clientesQuery.eq("analista_responsavel_id", analistaFiltro);

  const [
    { data: etapas },
    { data: clientes },
    { data: empreendimentos },
    { data: unidades },
    { data: usuarios },
  ] = await Promise.all([
    supabase.from("etapas").select("*").order("ordem", { ascending: true }),
    clientesQuery,
    supabase.from("empreendimentos").select("*").order("nome"),
    supabase.from("unidades").select("*"),
    supabase.from("profiles").select("id, nome"),
  ]);
  const nomeUsuarioPorId = new Map<string, string>(
    ((usuarios ?? []) as { id: string; nome: string }[]).map((u) => [u.id, u.nome])
  );

  const empreendimentoPorId = new Map<string, Empreendimento>(
    (empreendimentos ?? []).map((e: Empreendimento) => [e.id, e])
  );
  const unidadePorId = new Map<string, Unidade>((unidades ?? []).map((u: Unidade) => [u.id, u]));

  const etapasTyped = (etapas as Etapa[] | null) ?? [];
  const etapasExibidas = etapaFiltro ? etapasTyped.filter((e) => e.id === etapaFiltro) : etapasTyped;

  const clientesPorEtapa = new Map<string, Cliente[]>();
  for (const cliente of (clientes ?? []) as Cliente[]) {
    const chave = cliente.etapa_atual_id ?? "sem-etapa";
    if (!clientesPorEtapa.has(chave)) clientesPorEtapa.set(chave, []);
    clientesPorEtapa.get(chave)!.push(cliente);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Andamento dos clientes</h1>
          <p className="text-sm text-slate-500">
            {clientes?.length ?? 0} cliente(s) aprovado(s) em acompanhamento
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

      <div className="flex gap-4 overflow-x-auto pb-4">
        {etapasExibidas.map((etapa) => {
          const clientesDaEtapa = clientesPorEtapa.get(etapa.id) ?? [];
          return (
            <div key={etapa.id} className="w-72 shrink-0 rounded-lg bg-slate-100 p-3">
              <div className="mb-3 flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: etapa.cor }}
                />
                <h2 className="text-sm font-medium text-slate-700">{etapa.nome}</h2>
              </div>
              <div className="space-y-2">
                {clientesDaEtapa.map((cliente) => {
                  const empreendimento = cliente.empreendimento_id
                    ? empreendimentoPorId.get(cliente.empreendimento_id)
                    : null;
                  const unidade = cliente.unidade_id ? unidadePorId.get(cliente.unidade_id) : null;
                  return (
                    <Link
                      key={cliente.id}
                      href={`/clientes/${cliente.id}`}
                      className="block rounded-md border border-slate-200 bg-white p-3 shadow-sm hover:border-slate-400"
                    >
                      <p className="text-sm font-medium text-slate-900">{cliente.nome ?? "Proprietário não informado"}</p>
                      {empreendimento && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {empreendimento.nome}
                          {unidade ? ` · Unidade ${unidade.numero}` : ""}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-slate-400">
                        {formatMoeda(cliente.financiamento_contratado)}
                      </p>
                      {cliente.analista_responsavel_id && (
                        <p className="mt-1 text-xs text-slate-400">
                          Analista: {nomeUsuarioPorId.get(cliente.analista_responsavel_id) ?? "—"}
                        </p>
                      )}
                    </Link>
                  );
                })}
                {clientesDaEtapa.length === 0 && (
                  <p className="text-xs text-slate-400">Nenhum cliente nesta etapa</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
