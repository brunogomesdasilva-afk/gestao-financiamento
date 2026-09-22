import { exigirAdmin } from "@/lib/auth";
import { carregarMetaRepassados } from "@/lib/relatorios";
import { createClient } from "@/lib/supabase/server";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const CAMPO = "mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm";

function agoraSaoPaulo(): { ano: number; mes: number } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  return {
    ano: Number(partes.find((p) => p.type === "year")?.value),
    mes: Number(partes.find((p) => p.type === "month")?.value),
  };
}

export default async function MetaPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ano?: string }>;
}) {
  await exigirAdmin();
  const sp = await searchParams;
  const padrao = agoraSaoPaulo();
  const mes = Number(sp.mes) || padrao.mes;
  const ano = Number(sp.ano) || padrao.ano;

  const supabase = await createClient();
  const { empreendimentos, totalGeral } = await carregarMetaRepassados(supabase, { ano, mes });

  const totalPorAnalista = new Map<string, { nome: string; total: number }>();
  for (const e of empreendimentos) {
    for (const a of e.analistas) {
      const atual = totalPorAnalista.get(a.id);
      totalPorAnalista.set(a.id, { nome: a.nome, total: (atual?.total ?? 0) + a.unidades.length });
    }
  }
  const ranking = Array.from(totalPorAnalista.values()).sort((x, y) => y.total - x.total);

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900">Relatório de meta</h1>
      <p className="mt-1 text-sm text-slate-500">
        Unidades que viraram <strong>REPASSADO</strong> no mês escolhido, por analista — contando a
        data em que cada unidade entrou nesse status.
      </p>

      <form method="get" className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-slate-500">Mês</label>
          <select name="mes" defaultValue={mes} className={CAMPO}>
            {MESES.map((nome, i) => (
              <option key={nome} value={i + 1}>
                {nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Ano</label>
          <input
            name="ano"
            type="number"
            defaultValue={ano}
            min={2020}
            max={padrao.ano + 1}
            className={`${CAMPO} w-24`}
          />
        </div>
        <button type="submit" className="rounded-md bg-marca px-4 py-2 text-sm font-medium text-white hover:bg-marca-escuro">
          Filtrar
        </button>
      </form>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900">
          Total por analista — {MESES[mes - 1]}/{ano}
        </h2>
        {ranking.length > 0 ? (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {ranking.map((a) => (
                <tr key={a.nome}>
                  <td className="px-4 py-2 font-medium text-slate-900">{a.nome}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-900">{a.total}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold text-slate-900">
                <td className="px-4 py-2">Total geral</td>
                <td className="px-4 py-2 text-right tabular-nums">{totalGeral}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="px-4 py-6 text-center text-sm text-slate-400">
            Nenhuma unidade repassada em {MESES[mes - 1]}/{ano}.
          </p>
        )}
      </div>

      <div className="mt-6 space-y-6">
        {empreendimentos.map((e) => (
          <section key={e.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
              <h2 className="text-sm font-semibold text-slate-900">{e.nome}</h2>
              <span className="text-xs text-slate-500">{e.total} unidade(s)</span>
            </div>
            <div className="divide-y divide-slate-100">
              {e.analistas.map((a) => (
                <div key={a.id} className="px-4 py-3">
                  <p className="text-sm font-medium text-slate-900">
                    {a.nome} <span className="font-normal text-slate-500">({a.unidades.length})</span>
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                    {a.unidades.map((u) => (
                      <li key={u.clienteId}>
                        {u.bloco} · Unidade {u.unidade} — {u.proprietario} ·{" "}
                        {new Date(u.repassadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
