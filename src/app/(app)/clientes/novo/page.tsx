import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/database.types";
import { getEmpreendimentosTorresEUnidadesDisponiveis } from "@/lib/unidades";
import { criarCliente } from "../actions";
import { SeletorUnidade } from "../SeletorUnidade";

export default async function NovoClientePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const supabase = await createClient();

  const [{ empreendimentos, torres, unidades }, { data: corretores }] = await Promise.all([
    getEmpreendimentosTorresEUnidadesDisponiveis(),
    supabase.from("profiles").select("*").order("nome"),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-lg font-semibold text-slate-900">Novo cliente</h1>
      <p className="mt-1 text-sm text-slate-500">
        Cadastre um cliente já aprovado para acompanhar o andamento do financiamento. Só aparecem
        unidades com status <strong>Vendida</strong> que ainda não têm cliente vinculado.
      </p>

      {erro && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      )}

      <form action={criarCliente} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700">Nome completo</label>
            <input name="nome" required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">CPF</label>
            <input name="cpf" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Telefone</label>
            <input name="telefone" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700">E-mail</label>
            <input name="email" type="email" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>

          <div className="col-span-2">
            <SeletorUnidade empreendimentos={empreendimentos} torres={torres} unidades={unidades} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Banco financiador</label>
            <input name="banco_financiador" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Valor financiado (R$)</label>
            <input name="valor_financiado" placeholder="250000" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700">Corretor responsável</label>
            <select name="corretor_responsavel_id" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Selecione</option>
              {(corretores as Profile[] | null)?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700">Observações</label>
            <textarea name="observacoes" rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <button type="submit" className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700">
          Cadastrar cliente
        </button>
      </form>
    </div>
  );
}
