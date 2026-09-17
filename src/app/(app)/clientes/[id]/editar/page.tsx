import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Cliente, Profile } from "@/lib/database.types";
import { getEmpreendimentosTorresEUnidadesDisponiveis } from "@/lib/unidades";
import { atualizarCliente } from "../../actions";
import { SeletorUnidade } from "../../SeletorUnidade";

export default async function EditarClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const supabase = await createClient();

  const [{ data: cliente }, { data: corretores }] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).single(),
    supabase.from("profiles").select("*").order("nome"),
  ]);

  if (!cliente) notFound();
  const clienteTyped = cliente as Cliente;
  const { empreendimentos, torres, unidades } = await getEmpreendimentosTorresEUnidadesDisponiveis(
    clienteTyped.unidade_id ?? undefined
  );
  const atualizarComId = atualizarCliente.bind(null, id);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-lg font-semibold text-slate-900">Editar cliente</h1>

      {erro && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      )}

      <form action={atualizarComId} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700">Nome completo</label>
            <input name="nome" required defaultValue={clienteTyped.nome} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">CPF</label>
            <input name="cpf" defaultValue={clienteTyped.cpf ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Telefone</label>
            <input name="telefone" defaultValue={clienteTyped.telefone ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700">E-mail</label>
            <input name="email" type="email" defaultValue={clienteTyped.email ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>

          <div className="col-span-2">
            <SeletorUnidade
              empreendimentos={empreendimentos}
              torres={torres}
              unidades={unidades}
              unidadeSelecionadaId={clienteTyped.unidade_id}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Banco financiador</label>
            <input name="banco_financiador" defaultValue={clienteTyped.banco_financiador ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Valor financiado (R$)</label>
            <input name="valor_financiado" defaultValue={clienteTyped.valor_financiado ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-700">Corretor responsável</label>
            <select name="corretor_responsavel_id" defaultValue={clienteTyped.corretor_responsavel_id ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
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
            <textarea name="observacoes" rows={3} defaultValue={clienteTyped.observacoes ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <button type="submit" className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700">
          Salvar alterações
        </button>
      </form>
    </div>
  );
}
