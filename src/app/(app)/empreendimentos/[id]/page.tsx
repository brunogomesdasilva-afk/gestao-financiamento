import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/auth";
import { corDoTexto } from "@/lib/cores";
import type { Cliente, Empreendimento, StatusUnidadeConfig, Torre, Unidade } from "@/lib/database.types";
import { atualizarStatusUnidade, criarUnidadesEmLote, importarEspelhoVendas } from "../actions";
import { UnidadeStatusForm } from "../UnidadeStatusForm";

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
    resumo?: string;
    desconhecidas?: string;
    erroImportacao?: string;
  }>;
}) {
  await exigirAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const [
    { data: empreendimento },
    { data: torres },
    { data: unidades },
    { data: clientes },
    { data: statusUnidade },
  ] = await Promise.all([
    supabase.from("empreendimentos").select("*").eq("id", id).single(),
    supabase.from("torres").select("*").eq("empreendimento_id", id).order("nome"),
    supabase
      .from("unidades")
      .select("*, torres!inner(empreendimento_id)")
      .eq("torres.empreendimento_id", id)
      .order("numero"),
    supabase.from("clientes").select("*").eq("empreendimento_id", id),
    supabase.from("status_unidade").select("*").order("ordem"),
  ]);

  if (!empreendimento) notFound();
  const empreendimentoTyped = empreendimento as Empreendimento;
  const torresTyped = (torres ?? []) as Torre[];
  const unidadesTyped = (unidades ?? []) as Unidade[];
  const statusOpcoes = (statusUnidade ?? []) as StatusUnidadeConfig[];
  const statusPorNome = new Map<string, StatusUnidadeConfig>(statusOpcoes.map((s) => [s.nome, s]));
  const clientePorUnidade = new Map<string, Cliente>(
    ((clientes ?? []) as Cliente[])
      .filter((c) => c.unidade_id)
      .map((c) => [c.unidade_id as string, c])
  );

  const totalPorStatus = new Map<string, number>();
  for (const u of unidadesTyped) totalPorStatus.set(u.status, (totalPorStatus.get(u.status) ?? 0) + 1);
  // Legenda igual à da foto; "Não informado" só aparece enquanto houver unidades sem status.
  const legenda = statusOpcoes.filter((s) => s.nome !== "Não informado" || (totalPorStatus.get(s.nome) ?? 0) > 0);

  const resumo = (sp.resumo ?? "")
    .split(",")
    .filter(Boolean)
    .map((par) => par.split(":"));
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
            Importação concluída: {sp.total} unidade(s) lida(s), {sp.criadas} nova(s), {sp.atualizadas} com
            status alterado desde a última importação.
          </p>
          {resumo.length > 0 && (
            <p className="mt-1 text-emerald-700">
              Leitura: {resumo.map(([nome, qtd]) => `${nome} ${qtd}`).join(" · ")}
            </p>
          )}
          {desconhecidas.length > 0 && (
            <p className="mt-1 text-amber-700">
              Não reconhecidos na legenda (ignorados): {desconhecidas.join(", ")}
            </p>
          )}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {legenda.map((s) => (
          <span
            key={s.nome}
            className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium"
            style={{ backgroundColor: s.cor, color: corDoTexto(s.cor) }}
          >
            {s.nome}: {totalPorStatus.get(s.nome) ?? 0}
          </span>
        ))}
      </div>

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
                    const cor = statusPorNome.get(unidade.status)?.cor ?? "#94A3B8";
                    return (
                      <div
                        key={unidade.id}
                        className="flex items-center gap-1.5 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium"
                        style={{ backgroundColor: cor, color: corDoTexto(cor) }}
                        title={cliente ? `Cliente: ${cliente.nome ?? "não informado"}` : undefined}
                      >
                        <Link
                          href={`/empreendimentos/${id}/unidades/${unidade.id}`}
                          className="underline decoration-dotted"
                        >
                          {unidade.numero}
                        </Link>
                        {unidade.area_m2 != null && <span className="opacity-80">{unidade.area_m2}m²</span>}
                        <UnidadeStatusForm
                          status={unidade.status}
                          opcoes={statusOpcoes}
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
                        defaultValue={statusOpcoes[0]?.nome}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      >
                        {statusOpcoes.map((opcao) => (
                          <option key={opcao.nome} value={opcao.nome}>
                            {opcao.nome}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-md bg-marca px-3 py-2 text-sm font-medium text-white hover:bg-marca-escuro"
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

        <div className="rounded-xl border border-slate-200 bg-white p-6 self-start">
          <h2 className="text-sm font-semibold text-slate-900">Importar espelho de vendas</h2>
          <p className="mt-1 text-xs text-slate-500">
            Escolha a <strong>foto (.png)</strong> do espelho ou a <strong>planilha (.xlsx / .xltx)</strong>.
            Na foto, o status de cada unidade vem da cor, conforme a legenda acima. Na planilha, vem da
            coluna <strong>Status</strong> (ou das cores das células). Pode ser reenviado quantas vezes
            precisar: só o que mudou desde a última importação entra no histórico da unidade.
          </p>
          <form action={importarEspelhoVendas.bind(null, id)} className="mt-4 space-y-3">
            <input type="file" name="arquivo" accept=".png,.xlsx,.xltx" required className="w-full text-sm" />
            <button
              type="submit"
              className="w-full rounded-md bg-marca px-3 py-2 text-sm font-medium text-white hover:bg-marca-escuro"
            >
              Importar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
