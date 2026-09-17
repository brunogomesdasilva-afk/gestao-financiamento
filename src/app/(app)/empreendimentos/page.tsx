import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Empreendimento } from "@/lib/database.types";
import { criarEmpreendimento } from "./actions";

export default async function EmpreendimentosPage() {
  const supabase = await createClient();
  const { data: empreendimentos } = await supabase
    .from("empreendimentos")
    .select("*")
    .order("nome");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h1 className="text-lg font-semibold text-slate-900">Empreendimentos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Obras e lançamentos vinculados aos clientes em acompanhamento.
        </p>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-4 py-2 font-medium">Incorporadora</th>
                <th className="px-4 py-2 font-medium">Endereço</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(empreendimentos as Empreendimento[] | null)?.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-900">
                    <Link href={`/empreendimentos/${e.id}`} className="hover:underline">
                      {e.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{e.incorporadora ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{e.endereco ?? "—"}</td>
                </tr>
              ))}
              {(empreendimentos ?? []).length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                    Nenhum empreendimento cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Novo empreendimento</h2>
        <form action={criarEmpreendimento} className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Nome</label>
            <input name="nome" required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Incorporadora</label>
            <input name="incorporadora" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Endereço</label>
            <input name="endereco" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700">
            Adicionar
          </button>
        </form>
      </div>
    </div>
  );
}
