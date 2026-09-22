import { exigirAdmin } from "@/lib/auth";
import { emailConfigurado } from "@/lib/email";
import { anosParaSelecao, carregarDash, MESES, type ContagemStatus } from "@/lib/relatorios";
import { createClient } from "@/lib/supabase/server";
import { enviarDashPorEmail } from "./actions";

const CAMPO = "mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm";

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

export default async function DashPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ano?: string; empreendimento?: string; erro?: string; ok?: string }>;
}) {
  await exigirAdmin();
  const sp = await searchParams;
  const mes = sp.mes ? Number(sp.mes) : null;
  const ano = sp.ano ? Number(sp.ano) : null;
  const filtrandoPeriodo = Boolean(mes || ano);

  const supabase = await createClient();
  const todos = await carregarDash(supabase, filtrandoPeriodo ? { ano, mes } : undefined);
  const empreendimentos = sp.empreendimento ? todos.filter((e) => e.id === sp.empreendimento) : todos;
  const rotuloMes = mes ? MESES[mes - 1] : "Todos os meses";
  const rotuloAno = ano ? String(ano) : "Todos os anos";

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900">Dash por empreendimento</h1>
      <p className="mt-1 text-sm text-slate-500">
        Fechamento de cada empreendimento: quantas unidades estão em cada status.
      </p>

      <form method="get" className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-slate-500">Empreendimento</label>
          <select name="empreendimento" defaultValue={sp.empreendimento ?? ""} className={CAMPO}>
            <option value="">Todos</option>
            {todos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Mês</label>
          <select name="mes" defaultValue={mes ?? ""} className={CAMPO}>
            <option value="">Todos os meses</option>
            {MESES.map((nome, i) => (
              <option key={nome} value={i + 1}>
                {nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Ano</label>
          <select name="ano" defaultValue={ano ?? ""} className={CAMPO}>
            <option value="">Todos os anos</option>
            {anosParaSelecao().map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-md bg-marca px-4 py-2 text-sm font-medium text-white hover:bg-marca-escuro">
          Filtrar
        </button>
        {(filtrandoPeriodo || sp.empreendimento) && (
          <a href="/relatorios/dash" className="pb-2 text-sm text-slate-500 underline hover:text-slate-900">
            Limpar filtros
          </a>
        )}
      </form>
      {filtrandoPeriodo && (
        <p className="mt-2 text-xs text-slate-400">
          A análise de financiamento mostra só quem entrou em cada status em {rotuloMes}/{rotuloAno}. O
          espelho de vendas (cores) é sempre a situação atual, não filtra por período.
        </p>
      )}

      {sp.erro && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.erro}</p>}
      {sp.ok && <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{sp.ok}</p>}

      <details className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">Enviar por e-mail</summary>
        {!emailConfigurado() && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            O envio por e-mail ainda não foi configurado. Adicione ao <code>.env.local</code> as linhas{" "}
            <code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code> e{" "}
            <code>SMTP_FROM</code> (veja o modelo em <code>.env.local.example</code>) e reinicie o servidor.
          </p>
        )}
        <form action={enviarDashPorEmail} className="mt-3 flex flex-wrap items-end gap-3">
          <input type="hidden" name="mes" value={mes ?? ""} />
          <input type="hidden" name="ano" value={ano ?? ""} />
          <input type="hidden" name="empreendimento" value={sp.empreendimento ?? ""} />
          <div className="min-w-72 flex-1">
            <label className="block text-xs font-medium text-slate-700">
              Destinatários (separe por vírgula)
            </label>
            <input
              name="destinatarios"
              required
              placeholder="nome@empresa.com, outro@empresa.com"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-marca px-4 py-2 text-sm font-medium text-white hover:bg-marca-escuro"
          >
            Enviar relatório
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-400">
          O e-mail leva o Excel (espelho de vendas e análise de financiamento) e um PDF em anexo, com
          os mesmos filtros escolhidos acima.
        </p>
      </details>

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
            Nenhum empreendimento encontrado com esses filtros.
          </p>
        )}
      </div>
    </div>
  );
}
