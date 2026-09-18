import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/auth";
import { CAMPO_UNIDADE_LABEL, type HistoricoUnidade, type Profile, type Torre, type Unidade } from "@/lib/database.types";

function formatData(data: string) {
  return new Date(data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default async function HistoricoUnidadePage({
  params,
}: {
  params: Promise<{ id: string; unidadeId: string }>;
}) {
  await exigirAdmin();
  const { id, unidadeId } = await params;
  const supabase = await createClient();

  const [{ data: unidade }, { data: historico }, { data: usuarios }] = await Promise.all([
    supabase.from("unidades").select("*").eq("id", unidadeId).single(),
    supabase
      .from("historico_unidades")
      .select("*")
      .eq("unidade_id", unidadeId)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("*"),
  ]);

  if (!unidade) notFound();
  const unidadeTyped = unidade as Unidade;

  const { data: torre } = await supabase.from("torres").select("*").eq("id", unidadeTyped.torre_id).single();
  const torreTyped = torre as Torre | null;
  const usuariosPorId = new Map<string, Profile>((usuarios ?? []).map((u: Profile) => [u.id, u]));

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/empreendimentos/${id}`} className="text-xs text-slate-500 hover:text-slate-900">
        ← Voltar para o empreendimento
      </Link>
      <h1 className="mt-1 text-lg font-semibold text-slate-900">
        Unidade {unidadeTyped.numero}
        {torreTyped ? ` · ${torreTyped.nome}` : ""}
      </h1>
      <p className="text-sm text-slate-500">Status atual: {unidadeTyped.status}</p>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Histórico de alterações</h2>
        <ol className="mt-4 space-y-3">
          {((historico ?? []) as HistoricoUnidade[]).map((item) => {
            const usuario = item.usuario_id ? usuariosPorId.get(item.usuario_id) : null;
            return (
              <li key={item.id} className="border-l-2 border-slate-200 pl-4 text-sm">
                <p className="text-slate-900">
                  <span className="font-medium">{CAMPO_UNIDADE_LABEL[item.campo] ?? item.campo}</span>{" "}
                  alterado de <span className="text-slate-500">&ldquo;{item.valor_anterior ?? "—"}&rdquo;</span> para{" "}
                  <span className="text-slate-700">&ldquo;{item.valor_novo ?? "—"}&rdquo;</span>
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {formatData(item.created_at)}
                  {usuario ? ` · ${usuario.nome}` : " · importação/sistema"}
                </p>
              </li>
            );
          })}
          {(historico ?? []).length === 0 && (
            <p className="text-sm text-slate-400">Nenhuma alteração registrada ainda.</p>
          )}
        </ol>
      </div>
    </div>
  );
}
