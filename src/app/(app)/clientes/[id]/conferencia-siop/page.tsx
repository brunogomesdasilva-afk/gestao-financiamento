import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPerfilAtual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Cliente, Empreendimento, Torre, Unidade } from "@/lib/database.types";
import { FormularioUpload } from "./FormularioUpload";

export default async function ConferenciaSiopUnidadePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfilAtual = await getPerfilAtual();
  if (!perfilAtual) redirect("/login");

  const supabase = await createClient();
  const { data: cliente } = await supabase.from("clientes").select("*").eq("id", id).single();
  if (!cliente) notFound();
  const clienteTyped = cliente as Cliente;

  const souAdmin = perfilAtual.perfil === "admin";
  if (!souAdmin && clienteTyped.analista_responsavel_id !== perfilAtual.id) {
    redirect(`/clientes/${id}`);
  }

  const { data: unidadeData } = clienteTyped.unidade_id
    ? await supabase.from("unidades").select("*").eq("id", clienteTyped.unidade_id).single()
    : { data: null };
  const unidade = unidadeData as Unidade | null;
  const { data: torreData } = unidade
    ? await supabase.from("torres").select("*").eq("id", unidade.torre_id).single()
    : { data: null };
  const torre = torreData as Torre | null;
  const { data: empreendimentoData } = clienteTyped.empreendimento_id
    ? await supabase.from("empreendimentos").select("*").eq("id", clienteTyped.empreendimento_id).single()
    : { data: null };
  const empreendimento = empreendimentoData as Empreendimento | null;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/clientes/${id}`} className="text-xs text-slate-500 hover:text-slate-900">
        ← Voltar para a unidade
      </Link>
      <h1 className="mt-1 text-lg font-semibold text-slate-900">Conferência SIOP</h1>
      <p className="mt-1 text-sm text-slate-500">
        {empreendimento?.nome ?? "—"}
        {torre ? ` · ${torre.nome}` : ""}
        {unidade ? ` · Unidade ${unidade.numero}` : ""}
        {clienteTyped.nome ? ` · ${clienteTyped.nome}` : ""}
      </p>
      <p className="mt-2 max-w-2xl text-sm text-slate-500">
        Escolha o PDF do SIOP dessa unidade — não precisa estar na pasta SIOP do empreendimento.
        Compara o item <strong>5 - Valores da operação</strong> do PDF com o cadastro: valor do
        financiamento, FGTS e terreno.
      </p>

      {!unidade ? (
        <p className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Este cadastro não está vinculado a uma unidade — não é possível conferir.
        </p>
      ) : (
        <div className="mt-6">
          <FormularioUpload clienteId={id} />
        </div>
      )}
    </div>
  );
}
