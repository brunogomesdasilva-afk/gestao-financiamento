import { exigirAdmin } from "@/lib/auth";
import { carregarDash, type ContagemStatus } from "@/lib/relatorios";
import { createClient } from "@/lib/supabase/server";

function Barras({ itens, total }: { itens: ContagemStatus[]; total: number }) {
  return (
    <ul className="space-y-3">
      {itens.map((i) => {
        const pct = total > 0 ? (i.qtd / total) * 100 : 0;
        return (
          <li key={i.nome}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-slate-700">{i.nome}</span>
              <span className="tabular-nums text-slate-500">
                <span className="font-medium text-slate-900">{i.qtd}</span> · {pct.toFixed(0)}%
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded bg-slate-100">
              <div
                className="h-2 rounded border border-slate-300"
                style={{ width: `${pct}%`, backgroundColor: i.cor, minWidth: i.qtd > 0 ? 4 : 0 }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default async function DashPage() {
  await exigirAdmin();
  const supabase = await createClient();
  const empreendimentos = await carregarDash(supabase);

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900">Dash por empreendimento</h1>
      <p className="mt-1 text-sm text-slate-500">
        Fechamento de cada empreendimento: quantas unidades estão em cada status.
      </p>

      <div className="mt-6 space-y-6">
        {empreendimentos.map((e) => (
          <section key={e.id} className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">{e.nome}</h2>
              <p className="text-sm text-slate-500">
                {e.totalUnidades} unidade(s) · {e.emAnalise} em análise de financiamento
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Status das unidades (espelho de vendas)
                </h3>
                <Barras itens={e.unidadesPorStatus} total={e.totalUnidades} />
              </div>
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Status da análise de financiamento
                </h3>
                <Barras itens={e.analisePorEtapa} total={e.emAnalise} />
              </div>
            </div>
          </section>
        ))}
        {empreendimentos.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-400">
            Nenhum empreendimento cadastrado ainda.
          </p>
        )}
      </div>
    </div>
  );
}
