import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { carregarMeta, type Situacao } from "@/lib/relatorios";
import { createClient } from "@/lib/supabase/server";

const ABA = "rounded-md px-3 py-1.5 text-sm font-medium";

export default async function MetaPage({
  searchParams,
}: {
  searchParams: Promise<{ situacao?: string }>;
}) {
  await exigirAdmin();
  const { situacao: situacaoParam } = await searchParams;
  const situacao: Situacao = situacaoParam === "todas" ? "todas" : "carteira";

  const supabase = await createClient();
  const { empreendimentos, etapas } = await carregarMeta(supabase, situacao);

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900">Relatório de meta</h1>
      <p className="mt-1 text-sm text-slate-500">
        Quantas unidades cada analista tem, por empreendimento e por status.
      </p>

      <div className="mt-4 inline-flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
        <Link
          href="/relatorios/meta"
          className={`${ABA} ${situacao === "carteira" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
        >
          Em carteira
        </Link>
        <Link
          href="/relatorios/meta?situacao=todas"
          className={`${ABA} ${situacao === "todas" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
        >
          Todas (inclui encerradas)
        </Link>
      </div>

      <div className="mt-6 space-y-6">
        {empreendimentos.map((e) => {
          const totaisPorEtapa = new Map<string, number>();
          let totalGeral = 0;
          for (const a of e.analistas) {
            totalGeral += a.total;
            for (const [etapaId, qtd] of a.porEtapa) {
              totaisPorEtapa.set(etapaId, (totaisPorEtapa.get(etapaId) ?? 0) + qtd);
            }
          }

          return (
            <section key={e.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900">
                {e.nome}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Analista</th>
                      {etapas.map((et) => (
                        <th key={et.id} className="px-3 py-2 text-right font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: et.cor }} />
                            {et.nome}
                          </span>
                        </th>
                      ))}
                      <th className="px-4 py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {e.analistas.map((a) => (
                      <tr key={a.id}>
                        <td className="px-4 py-2 font-medium text-slate-900">{a.nome}</td>
                        {etapas.map((et) => {
                          const qtd = a.porEtapa.get(et.id) ?? 0;
                          return (
                            <td
                              key={et.id}
                              className={`px-3 py-2 text-right tabular-nums ${qtd > 0 ? "text-slate-900" : "text-slate-300"}`}
                            >
                              {qtd}
                            </td>
                          );
                        })}
                        <td className="px-4 py-2 text-right font-semibold tabular-nums text-slate-900">{a.total}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-semibold text-slate-900">
                      <td className="px-4 py-2">Total</td>
                      {etapas.map((et) => (
                        <td key={et.id} className="px-3 py-2 text-right tabular-nums">
                          {totaisPorEtapa.get(et.id) ?? 0}
                        </td>
                      ))}
                      <td className="px-4 py-2 text-right tabular-nums">{totalGeral}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
        {empreendimentos.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-400">
            Nenhum analista com unidades assumidas ainda.
          </p>
        )}
      </div>
    </div>
  );
}
