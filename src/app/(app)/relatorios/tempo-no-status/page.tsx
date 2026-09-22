import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { carregarTempoNoStatus, filtrarConsolidado, lerFiltros } from "@/lib/relatorios";
import { createClient } from "@/lib/supabase/server";
import { FiltrosCarteira } from "@/app/(app)/clientes/FiltrosCarteira";

const DIAS_MINIMO = 5;

function dataCurta(valor: string) {
  return new Date(valor).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export default async function TempoNoStatusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await exigirAdmin();
  const sp = await searchParams;
  const filtros = lerFiltros(sp);

  const supabase = await createClient();
  const [todas, { data: perfis }] = await Promise.all([
    carregarTempoNoStatus(supabase, DIAS_MINIMO),
    supabase.from("profiles").select("id, nome").order("nome"),
  ]);
  const linhas = filtrarConsolidado(todas, filtros);

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900">Tempo no status</h1>
      <p className="mt-1 text-sm text-slate-500">
        Unidades em carteira cujo status não muda há mais de {DIAS_MINIMO} dias. {linhas.length} de{" "}
        {todas.length} unidade(s).
      </p>

      <FiltrosCarteira
        linhas={todas.map((l) => ({
          empreendimentoId: l.empreendimentoId,
          empreendimento: l.empreendimento,
          bloco: l.bloco,
          unidade: l.unidade,
          etapaId: l.etapaId,
          etapa: l.status,
          etapaOrdem: l.etapaOrdem,
        }))}
        selecao={filtros}
        caminho="/relatorios/tempo-no-status"
        analistas={(perfis ?? []) as { id: string; nome: string }[]}
      />

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full whitespace-nowrap text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Empreendimento</th>
              <th className="px-3 py-2 font-medium">Bloco</th>
              <th className="px-3 py-2 font-medium">Unidade</th>
              <th className="px-3 py-2 font-medium">Proprietário</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Nesse status desde</th>
              <th className="px-3 py-2 text-right font-medium">Dias no status</th>
              <th className="px-3 py-2 font-medium">Assumida em</th>
              <th className="px-3 py-2 font-medium">Analista</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map((l) => (
              <tr key={l.clienteId} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-900">{l.empreendimento}</td>
                <td className="px-3 py-2 text-slate-600">{l.bloco}</td>
                <td className="px-3 py-2 font-medium text-slate-900">
                  <Link href={`/clientes/${l.clienteId}`} className="hover:underline">
                    {l.unidade}
                  </Link>
                </td>
                <td className="px-3 py-2 text-slate-600">{l.proprietario || "Proprietário não informado"}</td>
                <td className="px-3 py-2 text-slate-600">{l.status}</td>
                <td className="px-3 py-2 text-slate-600">{dataCurta(l.statusDesde)}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-amber-700">{l.diasNoStatus}</td>
                <td className="px-3 py-2 text-slate-600">{dataCurta(l.assumidaEm)}</td>
                <td className="px-3 py-2 text-slate-600">{l.analista}</td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-slate-400">
                  {todas.length === 0
                    ? `Nenhuma unidade parada no mesmo status há mais de ${DIAS_MINIMO} dias.`
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
