import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Empreendimento } from "@/lib/database.types";

export default async function EmpreendimentosPage() {
  const supabase = await createClient();
  const { data: empreendimentos } = await supabase
    .from("empreendimentos")
    .select("*")
    .order("nome");

  return (
    <div>
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
  );
}
