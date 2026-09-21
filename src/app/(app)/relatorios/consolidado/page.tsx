import { exigirAdmin } from "@/lib/auth";
import { emailConfigurado } from "@/lib/email";
import { carregarConsolidado, filtrarConsolidado, filtrosParaParams, lerFiltros } from "@/lib/relatorios";
import { createClient } from "@/lib/supabase/server";
import { FiltrosCarteira } from "@/app/(app)/clientes/FiltrosCarteira";
import { enviarConsolidadoPorEmail } from "./actions";

function moeda(valor: number | null) {
  return valor == null ? "—" : valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataCurta(valor: string | null) {
  return valor ? new Date(valor).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
}

const CABECALHOS = [
  "Empreendimento",
  "Bloco",
  "Unidade",
  "Status",
  "Analista",
  "Proprietário",
  "Banco",
  "Agência",
  "Modalidade",
  "Validade",
  "Valor de compra",
  "Financ. contratado",
  "Valor aprovado",
  "Diferença",
  "FGTS contratado",
  "FGTS atualização",
  "Terreno",
  "Seguro",
  "Escritura",
  "Atualizado em",
];

export default async function ConsolidadoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await exigirAdmin();
  const sp = await searchParams;
  const filtros = lerFiltros(sp);

  const supabase = await createClient();
  const [todas, { data: perfis }] = await Promise.all([
    carregarConsolidado(supabase, filtros.situacao),
    supabase.from("profiles").select("id, nome").order("nome"),
  ]);
  const linhas = filtrarConsolidado(todas, filtros);
  const exportar = `/relatorios/consolidado/exportar?${filtrosParaParams(filtros).toString()}`;

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Relatório consolidado</h1>
          <p className="mt-1 text-sm text-slate-500">
            Uma linha por unidade, com a última informação cadastrada. {linhas.length} de {todas.length} unidade(s).
            O Excel traz ainda CPF, telefone, e-mail, situação, data em que foi assumida e observações.
          </p>
        </div>
        <a
          href={exportar}
          className="shrink-0 rounded-md bg-marca px-4 py-2 text-sm font-medium text-white hover:bg-marca-escuro"
        >
          Exportar para Excel
        </a>
      </div>

      {sp.erro && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.erro}</p>}
      {sp.ok && <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{sp.ok}</p>}

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
        caminho="/relatorios/consolidado"
        analistas={(perfis ?? []) as { id: string; nome: string }[]}
        mostrarSituacao
      />

      <details className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">Enviar por e-mail</summary>
        {!emailConfigurado() && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            O envio por e-mail ainda não foi configurado. Adicione ao <code>.env.local</code> as linhas{" "}
            <code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code> e{" "}
            <code>SMTP_FROM</code> (veja o modelo em <code>.env.local.example</code>) e reinicie o servidor.
          </p>
        )}
        <form action={enviarConsolidadoPorEmail} className="mt-3 flex flex-wrap items-end gap-3">
          {Object.entries(Object.fromEntries(filtrosParaParams(filtros))).map(([chave, valor]) => (
            <input key={chave} type="hidden" name={chave} value={valor} />
          ))}
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
          O e-mail leva o Excel em anexo, com os mesmos filtros escolhidos acima.
        </p>
      </details>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full whitespace-nowrap text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              {CABECALHOS.map((c) => (
                <th key={c} className="px-3 py-2 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map((l) => (
              <tr key={l.clienteId} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-900">{l.empreendimento}</td>
                <td className="px-3 py-2 text-slate-600">{l.bloco}</td>
                <td className="px-3 py-2 font-medium text-slate-900">{l.unidade}</td>
                <td className="px-3 py-2 text-slate-600">{l.status}</td>
                <td className="px-3 py-2 text-slate-600">{l.analista}</td>
                <td className="px-3 py-2 text-slate-600">{l.proprietario || "—"}</td>
                <td className="px-3 py-2 text-slate-600">{l.banco || "—"}</td>
                <td className="px-3 py-2 text-slate-600">{l.agencia || "—"}</td>
                <td className="px-3 py-2 text-slate-600">{l.modalidade || "—"}</td>
                <td className="px-3 py-2 text-slate-600">{dataCurta(l.validade)}</td>
                <td className="px-3 py-2 text-right text-slate-600">{moeda(l.valorCompra)}</td>
                <td className="px-3 py-2 text-right text-slate-600">{moeda(l.financiamentoContratado)}</td>
                <td className="px-3 py-2 text-right text-slate-600">{moeda(l.valorAprovado)}</td>
                <td className="px-3 py-2 text-right text-slate-600">{moeda(l.diferenca)}</td>
                <td className="px-3 py-2 text-right text-slate-600">{moeda(l.fgtsContratado)}</td>
                <td className="px-3 py-2 text-right text-slate-600">{moeda(l.fgtsAtualizacao)}</td>
                <td className="px-3 py-2 text-right text-slate-600">{moeda(l.terreno)}</td>
                <td className="px-3 py-2 text-right text-slate-600">{moeda(l.seguro)}</td>
                <td className="px-3 py-2 text-right text-slate-600">{moeda(l.escritura)}</td>
                <td className="px-3 py-2 text-slate-600">{dataCurta(l.atualizadoEm)}</td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={CABECALHOS.length} className="px-4 py-6 text-center text-slate-400">
                  Nenhuma unidade encontrada com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
