import { getUnidadesParaAssumir } from "@/lib/unidades";
import { assumirUnidade } from "../actions";
import { SeletorUnidade } from "../SeletorUnidade";

export default async function AssumirUnidadePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const { empreendimentos, torres, unidades } = await getUnidadesParaAssumir();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-lg font-semibold text-slate-900">Assumir unidade</h1>
      <p className="mt-1 text-sm text-slate-500">
        Escolha o empreendimento, o bloco e a unidade cujo financiamento você vai analisar. Ao assumir,
        a unidade fica com você até ser concluída e nenhum outro analista consegue pegá-la. Só aparecem
        unidades com status <strong>Vendido</strong> que ainda não têm analista.
      </p>

      {erro && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      )}

      {unidades.length === 0 ? (
        <p className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Nenhuma unidade disponível para assumir no momento.
        </p>
      ) : (
        <form
          action={assumirUnidade}
          className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6"
        >
          <SeletorUnidade empreendimentos={empreendimentos} torres={torres} unidades={unidades} />
          <div>
            <label className="block text-sm font-medium text-slate-700">Nome do proprietário</label>
            <input
              name="nome"
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Assumir análise
          </button>
        </form>
      )}
    </div>
  );
}
