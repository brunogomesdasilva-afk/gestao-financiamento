import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/auth";
import { STATUS_VENDIDO, type Empreendimento } from "@/lib/database.types";

export default async function EmpreendimentosPage() {
  await exigirAdmin();
  const supabase = await createClient();

  const [{ data: empreendimentos }, { data: torres }, { data: vendidas }, { data: ocupadas }] =
    await Promise.all([
      supabase.from("empreendimentos").select("*").order("nome"),
      supabase.from("torres").select("id, empreendimento_id"),
      supabase.from("unidades").select("id, torre_id").eq("status", STATUS_VENDIDO),
      supabase.rpc("unidades_ocupadas"),
    ]);

  const lista = (empreendimentos ?? []) as Empreendimento[];

  // Disponíveis = unidades vendidas que nenhum analista assumiu ainda (as que dá para assumir).
  const empreendimentoDaTorre = new Map<string, string>(
    ((torres ?? []) as { id: string; empreendimento_id: string }[]).map((t) => [t.id, t.empreendimento_id])
  );
  const unidadesOcupadas = new Set((ocupadas ?? []) as string[]);
  const disponiveis = new Map<string, number>();
  for (const u of (vendidas ?? []) as { id: string; torre_id: string }[]) {
    if (unidadesOcupadas.has(u.id)) continue;
    const empreendimentoId = empreendimentoDaTorre.get(u.torre_id);
    if (empreendimentoId) disponiveis.set(empreendimentoId, (disponiveis.get(empreendimentoId) ?? 0) + 1);
  }

  const totais = new Map<string, number>(
    await Promise.all(
      lista.map(async (e) => {
        const { count } = await supabase
          .from("unidades")
          .select("id, torres!inner(empreendimento_id)", { count: "exact", head: true })
          .eq("torres.empreendimento_id", e.id);
        return [e.id, count ?? 0] as const;
      })
    )
  );

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Empreendimentos cadastrados</h1>
          <p className="mt-1 text-sm text-slate-500">
            &ldquo;Disponíveis&rdquo; são as unidades vendidas que ainda não foram assumidas por nenhum analista.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/empreendimentos/atualizar-espelho"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Atualizar espelho de vendas
          </Link>
          <Link
            href="/empreendimentos/importar"
            className="rounded-md bg-marca px-4 py-2 text-sm font-medium text-white hover:bg-marca-escuro"
          >
            Cadastrar novo empreendimento
          </Link>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Empreendimento</th>
              <th className="px-4 py-2 text-right font-medium">Unidades</th>
              <th className="px-4 py-2 text-right font-medium">Disponíveis</th>
              <th className="px-4 py-2 font-medium">Última atualização do espelho</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lista.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-900">
                  <Link href={`/empreendimentos/${e.id}`} className="hover:underline">
                    {e.nome}
                  </Link>
                </td>
                <td className="px-4 py-2 text-right text-slate-600">{totais.get(e.id) ?? 0}</td>
                <td className="px-4 py-2 text-right font-medium text-slate-900">{disponiveis.get(e.id) ?? 0}</td>
                <td className="px-4 py-2 text-slate-600">
                  {e.espelho_atualizado_em
                    ? new Date(e.espelho_atualizado_em).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: "America/Sao_Paulo",
                      })
                    : "—"}
                </td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
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
