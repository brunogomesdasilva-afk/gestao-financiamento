import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Cliente, Empreendimento, LegendaCor, Torre, Unidade } from "@/lib/database.types";
import {
  atualizarStatusUnidade,
  criarLegendaCor,
  criarTorre,
  criarUnidadesEmLote,
  importarEspelhoVendas,
  removerLegendaCor,
} from "../actions";
import { UnidadeStatusForm } from "../UnidadeStatusForm";

const STATUS_LABEL: Record<string, string> = {
  VENDIDA: "Vendida",
  DISPONIVEL: "Disponível",
  RESERVADA: "Reservada",
  BLOQUEADA: "Bloqueada",
  PERMUTA: "Permuta",
};

const STATUS_COR: Record<string, string> = {
  VENDIDA: "bg-red-100 text-red-700 border-red-200",
  DISPONIVEL: "bg-emerald-100 text-emerald-700 border-emerald-200",
  RESERVADA: "bg-amber-100 text-amber-700 border-amber-200",
  BLOQUEADA: "bg-slate-200 text-slate-600 border-slate-300",
  PERMUTA: "bg-sky-100 text-sky-700 border-sky-200",
};

export default async function EmpreendimentoDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    importado?: string;
    total?: string;
    criadas?: string;
    atualizadas?: string;
    desconhecidas?: string;
    erroImportacao?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: empreendimento }, { data: torres }, { data: unidades }, { data: clientes }, { data: legendas }] =
    await Promise.all([
      supabase.from("empreendimentos").select("*").eq("id", id).single(),
      supabase.from("torres").select("*").eq("empreendimento_id", id).order("nome"),
      supabase
        .from("unidades")
        .select("*, torres!inner(empreendimento_id)")
        .eq("torres.empreendimento_id", id)
        .order("numero"),
      supabase.from("clientes").select("*").eq("empreendimento_id", id),
      supabase.from("legendas_cores").select("*").eq("empreendimento_id", id),
    ]);

  if (!empreendimento) notFound();
  const empreendimentoTyped = empreendimento as Empreendimento;
  const torresTyped = (torres ?? []) as Torre[];
  const unidadesTyped = (unidades ?? []) as Unidade[];
  const legendasTyped = (legendas ?? []) as LegendaCor[];
  const clientePorUnidade = new Map<string, Cliente>(
    ((clientes ?? []) as Cliente[])
      .filter((c) => c.unidade_id)
      .map((c) => [c.unidade_id as string, c])
  );

  const desconhecidas = sp.desconhecidas ? sp.desconhecidas.split(",").filter(Boolean) : [];

  return (
    <div>
      <div className="mb-6">
        <Link href="/empreendimentos" className="text-xs text-slate-500 hover:text-slate-900">
          ← Empreendimentos
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">{empreendimentoTyped.nome}</h1>
        <p className="text-sm text-slate-500">
          {empreendimentoTyped.incorporadora ?? "—"}
          {empreendimentoTyped.endereco ? ` · ${empreendimentoTyped.endereco}` : ""}
        </p>
      </div>

      {sp.erroImportacao && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.erroImportacao}</p>
      )}
      {sp.importado && (
        <div className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <p>
            Importação concluída: {sp.total} unidade(s) reconhecida(s), {sp.criadas} nova(s),{" "}
            {sp.atualizadas} com status alterado desde a última importação.
          </p>
          {desconhecidas.length > 0 && (
            <p className="mt-1 text-amber-700">
              Cores não mapeadas na legenda (unidades ignoradas): {desconhecidas.join(", ")}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {torresTyped.map((torre) => {
            const unidadesDaTorre = unidadesTyped.filter((u) => u.torre_id === torre.id);
            return (
              <div key={torre.id} className="rounded-xl border border-slate-200 bg-white p-6">
                <h2 className="text-sm font-semibold text-slate-900">{torre.nome}</h2>
                <p className="mt-1 text-xs text-slate-400">
                  {unidadesDaTorre.length} unidade(s) cadastrada(s) no espelho de vendas
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {unidadesDaTorre.map((unidade) => {
                    const cliente = clientePorUnidade.get(unidade.id);
                    return (
                      <div
                        key={unidade.id}
                        className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${
                          STATUS_COR[unidade.status] ?? "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                        title={cliente ? `Cliente: ${cliente.nome}` : undefined}
                      >
                        <Link
                          href={`/empreendimentos/${id}/unidades/${unidade.id}`}
                          className="underline decoration-dotted"
                        >
                          {unidade.numero}
                        </Link>
                        <UnidadeStatusForm
                          status={unidade.status}
                          action={atualizarStatusUnidade.bind(null, id, unidade.id)}
                        />
                        {cliente && (
                          <Link href={`/clientes/${cliente.id}`} className="ml-1 underline decoration-dotted">
                            cliente
                          </Link>
                        )}
                      </div>
                    );
                  })}
                  {unidadesDaTorre.length === 0 && (
                    <p className="text-xs text-slate-400">Nenhuma unidade cadastrada ainda.</p>
                  )}
                </div>

                <details className="mt-4">
                  <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-900">
                    + Adicionar unidades em lote
                  </summary>
                  <form
                    action={criarUnidadesEmLote.bind(null, id, torre.id)}
                    className="mt-3 space-y-2"
                  >
                    <textarea
                      name="numeros"
                      rows={3}
                      placeholder={"Números das unidades, um por linha ou separado por vírgula\nEx: 101, 102, 103"}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                    <div className="flex items-center gap-2">
                      <select
                        name="status"
                        defaultValue="DISPONIVEL"
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      >
                        {Object.entries(STATUS_LABEL).map(([valor, label]) => (
                          <option key={valor} value={valor}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
                      >
                        Adicionar
                      </button>
                    </div>
                  </form>
                </details>
              </div>
            );
          })}

          {torresTyped.length === 0 && (
            <p className="text-sm text-slate-400">Nenhuma torre cadastrada ainda.</p>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-slate-900">Nova torre</h2>
            <form action={criarTorre.bind(null, id)} className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">Nome da torre</label>
                <input
                  name="nome"
                  required
                  placeholder="Torre 1"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Adicionar torre
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-slate-900">Legenda de cores</h2>
            <p className="mt-1 text-xs text-slate-500">
              Defina qual status cada cor do espelho de vendas representa. Usado ao importar a planilha.
            </p>
            <ul className="mt-3 space-y-2">
              {legendasTyped.map((legenda) => (
                <li key={legenda.id} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-4 w-4 shrink-0 rounded border border-slate-300"
                    style={{ backgroundColor: legenda.cor }}
                  />
                  <span className="text-slate-600">{legenda.cor}</span>
                  <span className="text-slate-400">→</span>
                  <span className="flex-1 text-slate-900">{STATUS_LABEL[legenda.status] ?? legenda.status}</span>
                  <form action={removerLegendaCor.bind(null, id, legenda.id)}>
                    <button type="submit" className="text-xs text-slate-400 hover:text-red-600">
                      remover
                    </button>
                  </form>
                </li>
              ))}
              {legendasTyped.length === 0 && (
                <p className="text-xs text-slate-400">Nenhuma cor mapeada ainda.</p>
              )}
            </ul>
            <form action={criarLegendaCor.bind(null, id)} className="mt-4 flex items-end gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-700">Cor</label>
                <input
                  type="color"
                  name="cor"
                  defaultValue="#FF0000"
                  className="mt-1 h-9 w-12 rounded-md border border-slate-300"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-700">Status</label>
                <select name="status" className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm">
                  {Object.entries(STATUS_LABEL).map(([valor, label]) => (
                    <option key={valor} value={valor}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Adicionar
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-slate-900">Importar espelho de vendas</h2>
            <p className="mt-1 text-xs text-slate-500">
              Envie a planilha .xlsx colorida. Cada cor é convertida em status conforme a legenda acima;
              torres são identificadas pelo nome da aba da planilha. Pode ser reenviada quantas vezes
              precisar — só as unidades com status ou cor diferentes do último envio geram uma nova
              entrada no histórico.
            </p>
            <form action={importarEspelhoVendas.bind(null, id)} className="mt-4 space-y-3">
              <input
                type="file"
                name="arquivo"
                accept=".xlsx"
                required
                className="w-full text-sm"
              />
              <button
                type="submit"
                className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Importar
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
