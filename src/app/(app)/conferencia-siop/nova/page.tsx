import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Empreendimento } from "@/lib/database.types";

export default async function NovaConferenciaPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("empreendimentos").select("*").order("nome");
  const empreendimentos = (data ?? []) as Empreendimento[];

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/conferencia-siop" className="text-xs text-slate-500 hover:text-slate-900">
        ← Conferência SIOP
      </Link>
      <h1 className="mt-1 text-lg font-semibold text-slate-900">Nova conferência</h1>
      <p className="mt-1 text-sm text-slate-500">
        Escolha o empreendimento que você quer conferir com o SIOP.
      </p>

      {empreendimentos.length === 0 ? (
        <p className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Nenhum empreendimento cadastrado ainda.
        </p>
      ) : (
        <form
          action="/conferencia-siop/resultado"
          method="get"
          className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700">Empreendimento</label>
            <select
              name="empreendimento"
              required
              defaultValue=""
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Selecione
              </option>
              {empreendimentos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-marca px-3 py-2 text-sm font-medium text-white hover:bg-marca-escuro"
          >
            Conferir
          </button>
        </form>
      )}
    </div>
  );
}
